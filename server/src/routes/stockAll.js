const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/', async (req, res) => {
  const { start_date, end_date, vehicle_id, category_id, page = 1, page_size = 20 } = req.query;

  let inQuery = db('stock_in')
    .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_in.vehicle_id', 'vehicles.id')
    .join('users', 'stock_in.operator_id', 'users.id')
    .select(
      db.raw("'入库' AS type"),
      'stock_in.id',
      'stock_in.stock_date AS date',
      'stock_in.oil_category_id',
      'oil_categories.name AS category_name',
      'stock_in.vehicle_id',
      'vehicles.plate_number',
      'stock_in.price_per_liter AS unit_price',
      'stock_in.liters',
      'stock_in.total_amount',
      'stock_in.operator_id',
      'users.real_name AS operator_name',
      'stock_in.remark',
      'stock_in.created_at',
      db.raw("'' AS customer_name")
    )
    .where('stock_in.deletestatus', 0);

  let outQuery = db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
    .join('users', 'stock_out.operator_id', 'users.id')
    .join('customers', 'stock_out.customer_id', 'customers.id')
    .select(
      db.raw("'出库' AS type"),
      'stock_out.id',
      'stock_out.purchase_date AS date',
      'stock_out.oil_category_id',
      'oil_categories.name AS category_name',
      'stock_out.vehicle_id',
      'vehicles.plate_number',
      'stock_out.unit_price',
      'stock_out.liters',
      'stock_out.total_amount',
      'stock_out.operator_id',
      'users.real_name AS operator_name',
      'stock_out.remark',
      'stock_out.created_at',
      'customers.name AS customer_name'
    )
    .where('stock_out.deletestatus', 0);

  if (start_date) {
    inQuery = inQuery.where('stock_in.stock_date', '>=', start_date);
    outQuery = outQuery.where('stock_out.purchase_date', '>=', start_date);
  }
  if (end_date) {
    inQuery = inQuery.where('stock_in.stock_date', '<=', end_date);
    outQuery = outQuery.where('stock_out.purchase_date', '<=', end_date);
  }
  if (vehicle_id) {
    inQuery = inQuery.where('stock_in.vehicle_id', vehicle_id);
    outQuery = outQuery.where('stock_out.vehicle_id', vehicle_id);
  }
  if (category_id) {
    inQuery = inQuery.where('stock_in.oil_category_id', category_id);
    outQuery = outQuery.where('stock_out.oil_category_id', category_id);
  }

  // summary queries
  const inSummary = db('stock_in')
    .where('stock_in.deletestatus', 0)
    .modify((qb) => {
      if (start_date) qb.where('stock_date', '>=', start_date);
      if (end_date) qb.where('stock_date', '<=', end_date);
      if (vehicle_id) qb.where('vehicle_id', vehicle_id);
      if (category_id) qb.where('oil_category_id', category_id);
    })
    .select(
      db.raw('COALESCE(SUM(liters), 0) AS total_liters'),
      db.raw('COALESCE(SUM(total_amount), 0) AS total_amount')
    )
    .first();

  const outSummary = db('stock_out')
    .where('stock_out.deletestatus', 0)
    .modify((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
      if (vehicle_id) qb.where('vehicle_id', vehicle_id);
      if (category_id) qb.where('oil_category_id', category_id);
    })
    .select(
      db.raw('COALESCE(SUM(liters), 0) AS total_liters'),
      db.raw('COALESCE(SUM(total_amount), 0) AS total_amount')
    )
    .first();

  const [inRecords, outRecords, inSum, outSum] = await Promise.all([inQuery, outQuery, inSummary, outSummary]);

  const allRecords = [...inRecords, ...outRecords].sort((a, b) => {
    const d = new Date(b.date) - new Date(a.date);
    if (d !== 0) return d;
    return b.id - a.id;
  });

  const total = allRecords.length;
  const p = +page;
  const ps = +page_size;
  const list = allRecords.slice((p - 1) * ps, p * ps);

  res.json({
    code: 0,
    data: {
      list,
      total,
      page: p,
      page_size: ps,
      summary: {
        total_in_liters: +inSum.total_liters,
        total_in_amount: +inSum.total_amount,
        total_out_liters: +outSum.total_liters,
        total_out_amount: +outSum.total_amount,
      },
    },
  });
});

module.exports = router;
