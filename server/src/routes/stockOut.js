const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/', async (req, res) => {
  const { start_date, end_date, buyer, vehicle_id, page = 1, page_size = 20 } = req.query;
  let query = db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
    .join('users', 'stock_out.operator_id', 'users.id')
    .select(
      'stock_out.*',
      'oil_categories.name as category_name',
      'vehicles.plate_number',
      'users.real_name as operator_name'
    )
    .where('stock_out.deletestatus', 0);

  if (start_date) query = query.where('stock_out.purchase_date', '>=', start_date);
  if (end_date) query = query.where('stock_out.purchase_date', '<=', end_date);
  if (buyer) query = query.where('stock_out.buyer_name', 'like', `%${buyer}%`);
  if (vehicle_id) query = query.where('stock_out.vehicle_id', vehicle_id);

  const total = await query.clone().count('* as count').first();
  const list = await query
    .orderBy('stock_out.purchase_date', 'desc')
    .orderBy('stock_out.id', 'desc')
    .limit(+page_size)
    .offset((+page - 1) * +page_size);

  res.json({ code: 0, data: { list, total: total.count, page: +page, page_size: +page_size } });
});

router.post('/', async (req, res) => {
  const { oil_category_id, vehicle_id, buyer_name, unit_price, liters, purchase_date, remark } = req.body;
  if (!oil_category_id || !vehicle_id || !buyer_name || !unit_price || !liters || !purchase_date) {
    return res.status(400).json({ code: 400, msg: '请填写完整的出库信息' });
  }
  const total_amount = +(unit_price * liters).toFixed(2);
  const [id] = await db('stock_out').insert({
    oil_category_id,
    vehicle_id,
    buyer_name,
    unit_price,
    liters,
    total_amount,
    purchase_date,
    operator_id: req.user.id,
    remark: remark || '',
  });
  res.json({ code: 0, data: { id } });
  auditLog('stock_out', id, 'create', req.user.id, null, { oil_category_id, vehicle_id, buyer_name, unit_price, liters, total_amount, purchase_date, remark });
});

router.get('/:id', async (req, res) => {
  const record = await db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
    .join('users', 'stock_out.operator_id', 'users.id')
    .select(
      'stock_out.*',
      'oil_categories.name as category_name',
      'vehicles.plate_number',
      'users.real_name as operator_name'
    )
    .where('stock_out.id', req.params.id)
    .where('stock_out.deletestatus', 0)
    .first();
  if (!record) return res.status(404).json({ code: 404, msg: '记录不存在' });
  res.json({ code: 0, data: record });
});

router.put('/:id', async (req, res) => {
  const oldRecord = await db('stock_out').where({ id: req.params.id, deletestatus: 0 }).first();
  if (!oldRecord) return res.status(404).json({ code: 404, msg: '记录不存在' });

  const { oil_category_id, vehicle_id, buyer_name, unit_price, liters, purchase_date, remark } = req.body;
  const update = { operator_id: req.user.id };
  if (oil_category_id !== undefined) update.oil_category_id = oil_category_id;
  if (vehicle_id !== undefined) update.vehicle_id = vehicle_id;
  if (buyer_name !== undefined) update.buyer_name = buyer_name;
  if (unit_price !== undefined) update.unit_price = unit_price;
  if (liters !== undefined) update.liters = liters;
  if (purchase_date !== undefined) update.purchase_date = purchase_date;
  if (remark !== undefined) update.remark = remark;
  if (unit_price && liters) {
    update.total_amount = +(unit_price * liters).toFixed(2);
  } else if (unit_price || liters) {
    const p = unit_price || oldRecord.unit_price;
    const l = liters || oldRecord.liters;
    update.total_amount = +(p * l).toFixed(2);
  }
  await db('stock_out').where({ id: req.params.id }).update(update);
  res.json({ code: 0, msg: '更新成功' });
  const newRecord = { ...oldRecord, ...update };
  auditLog('stock_out', req.params.id, 'update', req.user.id, oldRecord, newRecord);
});

router.delete('/:id', async (req, res) => {
  const oldRecord = await db('stock_out').where({ id: req.params.id }).first();
  if (!oldRecord) return res.status(404).json({ code: 404, msg: '记录不存在' });
  await db('stock_out').where({ id: req.params.id }).update({ deletestatus: 1 });
  res.json({ code: 0, msg: '删除成功' });
  auditLog('stock_out', req.params.id, 'delete', req.user.id, oldRecord, null);
});

module.exports = router;
