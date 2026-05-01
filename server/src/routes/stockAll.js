const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/', async (req, res) => {
  const { start_date, end_date, vehicle_id, category_id, page = 1, page_size = 20 } = req.query;
  const isCustomer = req.user.role === 'customer';
  const custId = req.user.customer_id;

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
  if (isCustomer) {
    outQuery = outQuery.where('stock_out.customer_id', custId || 0);
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
      if (isCustomer) qb.where('customer_id', custId || 0);
    })
    .select(
      db.raw('COALESCE(SUM(liters), 0) AS total_liters'),
      db.raw('COALESCE(SUM(total_amount), 0) AS total_amount')
    )
    .first();

  // 每日小结查询
  const inDaily = db('stock_in')
    .where('stock_in.deletestatus', 0)
    .modify((qb) => {
      if (start_date) qb.where('stock_date', '>=', start_date);
      if (end_date) qb.where('stock_date', '<=', end_date);
      if (vehicle_id) qb.where('vehicle_id', vehicle_id);
      if (category_id) qb.where('oil_category_id', category_id);
    })
    .select(
      'stock_date as date',
      db.raw('COALESCE(SUM(liters), 0) AS liters'),
      db.raw('COALESCE(SUM(total_amount), 0) AS amount'),
      db.raw('COUNT(*) AS count')
    )
    .groupBy('stock_date');

  const outDaily = db('stock_out')
    .where('stock_out.deletestatus', 0)
    .modify((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
      if (vehicle_id) qb.where('vehicle_id', vehicle_id);
      if (category_id) qb.where('oil_category_id', category_id);
      if (isCustomer) qb.where('customer_id', custId || 0);
    })
    .select(
      'purchase_date as date',
      db.raw('COALESCE(SUM(liters), 0) AS liters'),
      db.raw('COALESCE(SUM(total_amount), 0) AS amount'),
      db.raw('COUNT(*) AS count')
    )
    .groupBy('purchase_date');

  const [inRecords, outRecords, inSum, outSum, inDailyRows, outDailyRows] = await Promise.all([
    inQuery, outQuery, inSummary, outSummary, inDaily, outDaily,
  ]);

  // 合并每日小结
  const dailyMap = new Map();
  for (const r of inDailyRows) {
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    dailyMap.set(d, { date: d, in_liters: +r.liters, in_amount: +r.amount, in_count: r.count, out_liters: 0, out_amount: 0, out_count: 0 });
  }
  for (const r of outDailyRows) {
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    const existing = dailyMap.get(d);
    if (existing) {
      existing.out_liters = +r.liters;
      existing.out_amount = +r.amount;
      existing.out_count = r.count;
    } else {
      dailyMap.set(d, { date: d, in_liters: 0, in_amount: 0, in_count: 0, out_liters: +r.liters, out_amount: +r.amount, out_count: r.count });
    }
  }
  const dailySummary = [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  const allRecords = [...inRecords, ...outRecords].sort((a, b) => {
    const d = new Date(b.date) - new Date(a.date);
    if (d !== 0) return d;
    return b.id - a.id;
  });

  const total = allRecords.length;
  const ps = +page_size;
  const list = ps > 0 ? allRecords.slice((+page - 1) * ps, +page * ps) : allRecords;

  res.json({
    code: 0,
    data: {
      list,
      total,
      page: +page,
      page_size: ps,
      summary: {
        total_in_liters: +inSum.total_liters,
        total_in_amount: +inSum.total_amount,
        total_out_liters: +outSum.total_liters,
        total_out_amount: +outSum.total_amount,
      },
      net_summary: {
        net_liters: +(+inSum.total_liters - +outSum.total_liters).toFixed(2),
        net_amount: +(+outSum.total_amount - +inSum.total_amount).toFixed(2),
      },
      daily_summary: dailySummary,
    },
  });
});

module.exports = router;
