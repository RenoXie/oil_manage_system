const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');
const { auditLog } = require('../middleware/auditLog');
const { toMoney } = require('../utils/money');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

function applyFilters(qb, { start_date, end_date, customer_id, vehicle_id }) {
  if (start_date) qb.where('stock_out.purchase_date', '>=', start_date);
  if (end_date) qb.where('stock_out.purchase_date', '<=', end_date);
  if (customer_id) qb.where('stock_out.customer_id', customer_id);
  if (vehicle_id) qb.where('stock_out.vehicle_id', vehicle_id);
}

router.get('/', async (req, res) => {
  try {
    let { start_date, end_date, customer_id, vehicle_id, page = 1, page_size = 20 } = req.query;

    if (req.user.role === 'customer') {
      customer_id = req.user.customer_id;
      if (!customer_id) return res.json({ code: 0, data: { list: [], total: 0, page: 1, page_size: 20, summary: { total_liters: 0, total_amount: 0, record_count: 0 }, daily_summary: [] } });
    }

    let query = db('stock_out')
      .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
      .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
      .join('users', 'stock_out.operator_id', 'users.id')
      .join('customers', 'stock_out.customer_id', 'customers.id')
      .select(
        'stock_out.*',
        'oil_categories.name as category_name',
        'vehicles.plate_number',
        'users.real_name as operator_name',
        'customers.name as customer_name'
      )
      .where('stock_out.deletestatus', 0);

    applyFilters(query, { start_date, end_date, customer_id, vehicle_id });

    const summaryQuery = db('stock_out')
      .where('stock_out.deletestatus', 0)
      .modify((qb) => applyFilters(qb, { start_date, end_date, customer_id, vehicle_id }))
      .select(
        db.raw('COALESCE(SUM(liters), 0) AS total_liters'),
        db.raw('COALESCE(SUM(total_amount), 0) AS total_amount'),
        db.raw('COUNT(*) AS record_count')
      )
      .first();

    const dailyQuery = db('stock_out')
      .where('stock_out.deletestatus', 0)
      .modify((qb) => applyFilters(qb, { start_date, end_date, customer_id, vehicle_id }))
      .select(
        'purchase_date as date',
        db.raw('COALESCE(SUM(liters), 0) AS liters'),
        db.raw('COALESCE(SUM(total_amount), 0) AS amount'),
        db.raw('COUNT(*) AS count')
      )
      .groupBy('purchase_date')
      .orderBy('purchase_date', 'desc');

    const listQuery = query
      .orderBy('stock_out.purchase_date', 'desc')
      .orderBy('stock_out.id', 'desc');
    if (+page_size > 0) {
      listQuery.limit(+page_size).offset((+page - 1) * +page_size);
    }

    const [total, list, summary, dailySummary] = await Promise.all([
      query.clone().count('* as count').first(),
      listQuery,
      summaryQuery,
      dailyQuery,
    ]);

    res.json({
      code: 0,
      data: {
        list,
        total: total.count,
        page: +page,
        page_size: +page_size,
        summary: {
          total_liters: +summary.total_liters,
          total_amount: toMoney(summary.total_amount),
          record_count: summary.record_count,
        },
        daily_summary: dailySummary,
      },
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stock-out |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('stock-out'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { oil_category_id, vehicle_id, customer_id, unit_price, liters, purchase_date, remark } = req.body;
    if (!oil_category_id || !vehicle_id || !customer_id || !unit_price || !liters || !purchase_date) {
      await trx.rollback();
      return res.status(400).json({ code: 400, msg: '请填写完整的出库信息' });
    }
    if (isNaN(unit_price) || +unit_price <= 0) {
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
    const total_amount = toMoney(unit_price * liters);
    const [id] = await db('stock_out').transacting(trx).insert({
      oil_category_id,
      vehicle_id,
      customer_id,
      unit_price,
      liters,
      total_amount,
      purchase_date,
      operator_id: req.user.id,
      remark: remark || '',
    });
    await auditLog('stock_out', id, 'create', req.user.id, null, { oil_category_id, vehicle_id, customer_id, unit_price, liters, total_amount, purchase_date, remark }, trx);
    await trx.commit();
    res.json({ code: 0, data: { id } });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] POST /api/stock-out |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await db('stock_out')
      .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
      .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
      .join('users', 'stock_out.operator_id', 'users.id')
      .join('customers', 'stock_out.customer_id', 'customers.id')
      .select(
        'stock_out.*',
        'oil_categories.name as category_name',
        'vehicles.plate_number',
        'users.real_name as operator_name',
        'customers.name as customer_name'
      )
      .where('stock_out.id', req.params.id)
      .where('stock_out.deletestatus', 0)
      .first();
    if (!record) return res.status(404).json({ code: 404, msg: '记录不存在' });
    res.json({ code: 0, data: record });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stock-out/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('stock-out'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const oldRecord = await db('stock_out').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!oldRecord) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '记录不存在' });
    }

    const { oil_category_id, vehicle_id, customer_id, unit_price, liters, purchase_date, remark } = req.body;
    const update = { last_modified_by: req.user.id };
    if (oil_category_id !== undefined) update.oil_category_id = oil_category_id;
    if (vehicle_id !== undefined) update.vehicle_id = vehicle_id;
    if (customer_id !== undefined) update.customer_id = customer_id;
    if (unit_price !== undefined) {
      if (isNaN(unit_price) || +unit_price <= 0) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '单价必须大于0' });
      }
      update.unit_price = unit_price;
    }
    if (liters !== undefined) {
      if (isNaN(liters) || +liters <= 0) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '数量必须大于0' });
      }
      update.liters = liters;
    }
    if (purchase_date !== undefined) update.purchase_date = purchase_date;
    if (remark !== undefined) {
      if (typeof remark === 'string' && remark.length > 500) {
        await trx.rollback();
        return res.status(400).json({ code: 400, msg: '备注最长500字符' });
      }
      update.remark = remark;
    }
    const p = unit_price !== undefined ? unit_price : oldRecord.unit_price;
    const l = liters !== undefined ? liters : oldRecord.liters;
    update.total_amount = toMoney(p * l);
    await db('stock_out').transacting(trx).where({ id: req.params.id }).update(update);
    const newRecord = { ...oldRecord, ...update };
    await auditLog('stock_out', req.params.id, 'update', req.user.id, oldRecord, newRecord, trx);
    await trx.commit();
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] PUT /api/stock-out/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('stock-out'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const oldRecord = await db('stock_out').transacting(trx).where({ id: req.params.id, deletestatus: 0 }).first();
    if (!oldRecord) {
      await trx.rollback();
      return res.status(404).json({ code: 404, msg: '记录不存在或已删除' });
    }
    await db('stock_out').transacting(trx).where({ id: req.params.id }).update({ deletestatus: 1 });
    await auditLog('stock_out', req.params.id, 'delete', req.user.id, oldRecord, null, trx);
    await trx.commit();
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    await trx.rollback();
    console.error(`[${new Date().toISOString()}] DELETE /api/stock-out/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
