const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/', async (req, res) => {
  const { start_date, end_date, category_id, vehicle_id, page = 1, page_size = 20 } = req.query;
  let query = db('stock_in')
    .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_in.vehicle_id', 'vehicles.id')
    .join('users', 'stock_in.operator_id', 'users.id')
    .select(
      'stock_in.*',
      'oil_categories.name as category_name',
      'vehicles.plate_number',
      'users.real_name as operator_name'
    )
    .where('stock_in.deletestatus', 0);

  if (start_date) query = query.where('stock_in.stock_date', '>=', start_date);
  if (end_date) query = query.where('stock_in.stock_date', '<=', end_date);
  if (category_id) query = query.where('stock_in.oil_category_id', category_id);
  if (vehicle_id) query = query.where('stock_in.vehicle_id', vehicle_id);

  const total = await query.clone().count('* as count').first();
  const list = await query
    .orderBy('stock_in.stock_date', 'desc')
    .orderBy('stock_in.id', 'desc')
    .limit(+page_size)
    .offset((+page - 1) * +page_size);

  res.json({ code: 0, data: { list, total: total.count, page: +page, page_size: +page_size } });
});

router.post('/', requirePermission('stock-in'), async (req, res) => {
  const { oil_category_id, vehicle_id, price_per_liter, liters, stock_date, remark } = req.body;
  if (!oil_category_id || !vehicle_id || !price_per_liter || !liters || !stock_date) {
    return res.status(400).json({ code: 400, msg: '请填写完整的入库信息' });
  }
  if (isNaN(price_per_liter) || +price_per_liter <= 0) {
    return res.status(400).json({ code: 400, msg: '单价必须大于0' });
  }
  if (isNaN(liters) || +liters <= 0) {
    return res.status(400).json({ code: 400, msg: '数量必须大于0' });
  }
  if (remark && typeof remark === 'string' && remark.length > 500) {
    return res.status(400).json({ code: 400, msg: '备注最长500字符' });
  }
  const total_amount = +(price_per_liter * liters).toFixed(2);
  const [id] = await db('stock_in').insert({
    oil_category_id,
    vehicle_id,
    price_per_liter,
    liters,
    total_amount,
    stock_date,
    operator_id: req.user.id,
    remark: remark || '',
  });
  res.json({ code: 0, data: { id } });
  auditLog('stock_in', id, 'create', req.user.id, null, { oil_category_id, vehicle_id, price_per_liter, liters, total_amount, stock_date, remark });
});

router.get('/:id', async (req, res) => {
  const record = await db('stock_in')
    .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_in.vehicle_id', 'vehicles.id')
    .join('users', 'stock_in.operator_id', 'users.id')
    .select(
      'stock_in.*',
      'oil_categories.name as category_name',
      'vehicles.plate_number',
      'users.real_name as operator_name'
    )
    .where('stock_in.id', req.params.id)
    .where('stock_in.deletestatus', 0)
    .first();
  if (!record) return res.status(404).json({ code: 404, msg: '记录不存在' });
  res.json({ code: 0, data: record });
});

router.put('/:id', requirePermission('stock-in'), async (req, res) => {
  const oldRecord = await db('stock_in').where({ id: req.params.id, deletestatus: 0 }).first();
  if (!oldRecord) return res.status(404).json({ code: 404, msg: '记录不存在' });

  const { oil_category_id, vehicle_id, price_per_liter, liters, stock_date, remark } = req.body;
  const update = { operator_id: req.user.id };
  if (oil_category_id !== undefined) update.oil_category_id = oil_category_id;
  if (vehicle_id !== undefined) update.vehicle_id = vehicle_id;
  if (price_per_liter !== undefined) {
    if (isNaN(price_per_liter) || +price_per_liter <= 0) {
      return res.status(400).json({ code: 400, msg: '单价必须大于0' });
    }
    update.price_per_liter = price_per_liter;
  }
  if (liters !== undefined) {
    if (isNaN(liters) || +liters <= 0) {
      return res.status(400).json({ code: 400, msg: '数量必须大于0' });
    }
    update.liters = liters;
  }
  if (stock_date !== undefined) update.stock_date = stock_date;
  if (remark !== undefined) {
    if (typeof remark === 'string' && remark.length > 500) {
      return res.status(400).json({ code: 400, msg: '备注最长500字符' });
    }
    update.remark = remark;
  }
  const p = price_per_liter || oldRecord.price_per_liter;
  const l = liters || oldRecord.liters;
  update.total_amount = +(+p * +l).toFixed(2);
  await db('stock_in').where({ id: req.params.id }).update(update);
  res.json({ code: 0, msg: '更新成功' });
  const newRecord = { ...oldRecord, ...update };
  auditLog('stock_in', req.params.id, 'update', req.user.id, oldRecord, newRecord);
});

router.delete('/:id', requirePermission('stock-in'), async (req, res) => {
  const oldRecord = await db('stock_in').where({ id: req.params.id }).first();
  if (!oldRecord) return res.status(404).json({ code: 404, msg: '记录不存在' });
  await db('stock_in').where({ id: req.params.id }).update({ deletestatus: 1 });
  res.json({ code: 0, msg: '删除成功' });
  auditLog('stock_in', req.params.id, 'delete', req.user.id, oldRecord, null);
});

module.exports = router;
