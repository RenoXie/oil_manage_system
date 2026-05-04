const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');
const { auditLog } = require('../middleware/auditLog');
const { toMoney } = require('../utils/money');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, category_id, vehicle_id, supplier_id, page = 1, page_size = 20 } = req.query;
    let query = db('stock_in')
      .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
      .join('vehicles', 'stock_in.vehicle_id', 'vehicles.id')
      .join('users', 'stock_in.operator_id', 'users.id')
      .leftJoin('suppliers', 'stock_in.supplier_id', 'suppliers.id')
      .select(
        'stock_in.*',
        'oil_categories.name as category_name',
        'vehicles.plate_number',
        'users.real_name as operator_name',
        'suppliers.name as supplier_name'
      )
      .where('stock_in.deletestatus', 0);

    if (start_date) query = query.where('stock_in.stock_date', '>=', start_date);
    if (end_date) query = query.where('stock_in.stock_date', '<=', end_date);
    if (category_id) query = query.where('stock_in.oil_category_id', category_id);
    if (vehicle_id) query = query.where('stock_in.vehicle_id', vehicle_id);
    if (supplier_id) query = query.where('stock_in.supplier_id', supplier_id);

    const total = await query.clone().count('* as count').first();
    const list = await query
      .orderBy('stock_in.stock_date', 'desc')
      .orderBy('stock_in.id', 'desc')
      .limit(+page_size)
      .offset((+page - 1) * +page_size);

    res.json({ code: 0, data: { list, total: total.count, page: +page, page_size: +page_size } });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stock-in |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('stock-in'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { oil_category_id, vehicle_id, supplier_id, price_per_liter, liters, stock_date, remark } = req.body;
    if (!oil_category_id || !vehicle_id || !price_per_liter || !liters || !stock_date) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写完整的入库信息' });
    }
    if (isNaN(price_per_liter) || +price_per_liter <= 0) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '单价必须大于0' });
    }
    if (isNaN(liters) || +liters <= 0) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '数量必须大于0' });
    }
    if (remark && typeof remark === 'string' && remark.length > 500) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '备注最长500字符' });
    }
    if (supplier_id && isNaN(supplier_id)) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '供应商ID无效' });
    }
    const total_amount = toMoney(price_per_liter * liters);
    const [id] = await db('stock_in').transacting(trx).insert({
      oil_category_id,
      vehicle_id,
      supplier_id: supplier_id || null,
      price_per_liter,
      liters,
      total_amount,
      stock_date,
      operator_id: req.user.id,
      remark: remark || '',
    });
    await auditLog('stock_in', id, 'create', req.user.id, null, { oil_category_id, vehicle_id, supplier_id: supplier_id || null, price_per_liter, liters, total_amount, stock_date, remark }, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/stock-in |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await db('stock_in')
      .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
      .join('vehicles', 'stock_in.vehicle_id', 'vehicles.id')
      .join('users', 'stock_in.operator_id', 'users.id')
      .leftJoin('suppliers', 'stock_in.supplier_id', 'suppliers.id')
      .select(
        'stock_in.*',
        'oil_categories.name as category_name',
        'vehicles.plate_number',
        'users.real_name as operator_name',
        'suppliers.name as supplier_name'
      )
      .where('stock_in.id', req.params.id)
      .where('stock_in.deletestatus', 0)
      .first();
    if (!record) return res.status(404).json({ code: 404, msg: '记录不存在' });
    res.json({ code: 0, data: record });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stock-in/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('stock-in'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const oldRecord = await db('stock_in').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!oldRecord) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '记录不存在' });
    }

    const { oil_category_id, vehicle_id, supplier_id, price_per_liter, liters, stock_date, remark } = req.body;
    const update = { last_modified_by: req.user.id };
    if (oil_category_id !== undefined) update.oil_category_id = oil_category_id;
    if (vehicle_id !== undefined) update.vehicle_id = vehicle_id;
    if (supplier_id !== undefined) update.supplier_id = supplier_id || null;
    if (price_per_liter !== undefined) {
      if (isNaN(price_per_liter) || +price_per_liter <= 0) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '单价必须大于0' });
      }
      update.price_per_liter = price_per_liter;
    }
    if (liters !== undefined) {
      if (isNaN(liters) || +liters <= 0) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '数量必须大于0' });
      }
      update.liters = liters;
    }
    if (stock_date !== undefined) update.stock_date = stock_date;
    if (remark !== undefined) {
      if (typeof remark === 'string' && remark.length > 500) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '备注最长500字符' });
      }
      update.remark = remark;
    }
    const p = price_per_liter !== undefined ? price_per_liter : oldRecord.price_per_liter;
    const l = liters !== undefined ? liters : oldRecord.liters;
    update.total_amount = toMoney(p * l);
    await db('stock_in').transacting(trx).where({ id: req.params.id }).update(update);
    const newRecord = { ...oldRecord, ...update };
    await auditLog('stock_in', req.params.id, 'update', req.user.id, oldRecord, newRecord, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/stock-in/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('stock-in'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const oldRecord = await db('stock_in').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!oldRecord) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '记录不存在或已删除' });
    }
    await db('stock_in').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('stock_in', req.params.id, 'delete', req.user.id, oldRecord, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/stock-in/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
