const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

router.get('/overview', async (req, res) => {
  const { start_date, end_date } = req.query;
  const isCustomer = req.user.role === 'customer';
  const custId = req.user.customer_id;
  const dateFilter = (qb) => {
    if (start_date) qb.where('stock_date', '>=', start_date);
    if (end_date) qb.where('stock_date', '<=', end_date);
  };

  let inStats = { total_liters: 0, total_amount: 0, record_count: 0 };
  let inByCategory = [];

  if (!isCustomer) {
    inStats = await db('stock_in')
      .where({ deletestatus: 0 })
      .andWhere(dateFilter)
      .sum('liters as total_liters')
      .sum('total_amount as total_amount')
      .count('* as record_count')
      .first();

    inByCategory = await db('stock_in')
      .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
      .where('stock_in.deletestatus', 0)
      .andWhere(dateFilter)
      .select('oil_categories.name')
      .sum('stock_in.liters as liters')
      .sum('stock_in.total_amount as amount')
      .groupBy('stock_in.oil_category_id', 'oil_categories.name');
  }

  const outQuery = db('stock_out')
    .where({ deletestatus: 0 })
    .andWhere((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
    });

  // 客户只看自己的出库数据
  if (isCustomer) {
    outQuery.where('customer_id', custId || 0);
  }

  const outStats = await outQuery.clone()
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .count('* as record_count')
    .first();

  const outByCategory = await outQuery.clone()
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .select('oil_categories.name')
    .sum('stock_out.liters as liters')
    .sum('stock_out.total_amount as amount')
    .groupBy('stock_out.oil_category_id', 'oil_categories.name');

  res.json({
    code: 0,
    data: {
      stock_in: {
        total_liters: +inStats.total_liters || 0,
        total_amount: +inStats.total_amount || 0,
        record_count: inStats.record_count,
        by_category: inByCategory,
      },
      stock_out: {
        total_liters: +outStats.total_liters || 0,
        total_amount: +outStats.total_amount || 0,
        record_count: outStats.record_count,
        by_category: outByCategory,
      },
    },
  });
});

router.get('/buyer', async (req, res) => {
  const { start_date, end_date, customer_id } = req.query;
  if (!customer_id) return res.status(400).json({ code: 400, msg: '请提供客户ID' });

  const customer = await db('customers').where({ id: customer_id, deletestatus: 0 }).first();
  if (!customer) return res.status(404).json({ code: 404, msg: '客户不存在' });

  const query = db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
    .where('stock_out.customer_id', customer_id)
    .where('stock_out.deletestatus', 0);

  if (start_date) query.where('stock_out.purchase_date', '>=', start_date);
  if (end_date) query.where('stock_out.purchase_date', '<=', end_date);

  const records = await query
    .select(
      'stock_out.*',
      'oil_categories.name as category_name',
      'vehicles.plate_number'
    )
    .orderBy('stock_out.purchase_date', 'desc');

  const summary = await db('stock_out')
    .where({ customer_id, deletestatus: 0 })
    .andWhere((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
    })
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .count('* as times')
    .first();

  res.json({
    code: 0,
    data: {
      buyer: customer.name,
      summary: {
        total_liters: +summary.total_liters || 0,
        total_amount: +summary.total_amount || 0,
        times: summary.times,
      },
      records,
    },
  });
});

router.get('/buyers', async (req, res) => {
  const { start_date, end_date } = req.query;

  const query = db('stock_out')
    .join('customers', 'stock_out.customer_id', 'customers.id')
    .where('stock_out.deletestatus', 0)
    .select('stock_out.customer_id', 'customers.name as buyer_name')
    .sum('stock_out.liters as total_liters')
    .sum('stock_out.total_amount as total_amount')
    .count('* as times')
    .groupBy('stock_out.customer_id', 'customers.name')
    .orderBy('total_amount', 'desc');

  if (start_date) query.where('stock_out.purchase_date', '>=', start_date);
  if (end_date) query.where('stock_out.purchase_date', '<=', end_date);

  const list = await query;

  const total = list.reduce(
    (acc, item) => {
      acc.liters += +item.total_liters;
      acc.amount += +item.total_amount;
      acc.times += item.times;
      return acc;
    },
    { liters: 0, amount: 0, times: 0 }
  );

  res.json({ code: 0, data: { list, total } });
});

module.exports = router;
