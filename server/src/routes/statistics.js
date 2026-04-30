const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

// 总进出库概览统计
router.get('/overview', async (req, res) => {
  const { start_date, end_date } = req.query;
  const dateFilter = (qb) => {
    if (start_date) qb.where('stock_date', '>=', start_date);
    if (end_date) qb.where('stock_date', '<=', end_date);
  };

  const inStats = await db('stock_in')
    .andWhere(dateFilter)
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .count('* as record_count')
    .first();

  const outStats = await db('stock_out')
    .andWhere((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
    })
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .count('* as record_count')
    .first();

  // 按油品分类统计
  const inByCategory = await db('stock_in')
    .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
    .andWhere(dateFilter)
    .select('oil_categories.name')
    .sum('stock_in.liters as liters')
    .sum('stock_in.total_amount as amount')
    .groupBy('stock_in.oil_category_id', 'oil_categories.name');

  const outByCategory = await db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .andWhere((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
    })
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

// 某购买人在时间段内的购买汇总
router.get('/buyer', async (req, res) => {
  const { start_date, end_date, buyer } = req.query;
  if (!buyer) return res.status(400).json({ code: 400, msg: '请提供购买人名称' });

  const query = db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('vehicles', 'stock_out.vehicle_id', 'vehicles.id')
    .where('stock_out.buyer_name', buyer);

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
    .where('buyer_name', buyer)
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
      buyer,
      summary: {
        total_liters: +summary.total_liters || 0,
        total_amount: +summary.total_amount || 0,
        times: summary.times,
      },
      records,
    },
  });
});

// 所有购买人分单位统计排行
router.get('/buyers', async (req, res) => {
  const { start_date, end_date } = req.query;

  const query = db('stock_out')
    .select('buyer_name')
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .count('* as times')
    .groupBy('buyer_name')
    .orderBy('total_amount', 'desc');

  if (start_date) query.where('purchase_date', '>=', start_date);
  if (end_date) query.where('purchase_date', '<=', end_date);

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
