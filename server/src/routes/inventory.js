const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/dateValidate');
const { toMoney } = require('../utils/money');

const router = express.Router();
router.use(auth);
router.use(validateDateRange);

// 所有车辆当前库存（按车辆+油品分组）
router.get('/', async (req, res) => {
  const result = await db.raw(`
    SELECT
      v.id AS vehicle_id,
      v.plate_number,
      COALESCE(oc.id, 0) AS category_id,
      COALESCE(oc.name, '未知') AS category_name,
      COALESCE(SUM(si.total_liters), 0) AS total_in,
      COALESCE(SUM(so.total_liters), 0) AS total_out,
      COALESCE(SUM(si.total_liters), 0) - COALESCE(SUM(so.total_liters), 0) AS remaining
    FROM vehicles v
    LEFT JOIN (
      SELECT vehicle_id, oil_category_id, SUM(liters) AS total_liters
      FROM stock_in
      WHERE deletestatus = 0
      GROUP BY vehicle_id, oil_category_id
    ) si ON v.id = si.vehicle_id
    LEFT JOIN (
      SELECT vehicle_id, oil_category_id, SUM(liters) AS total_liters
      FROM stock_out
      WHERE deletestatus = 0
      GROUP BY vehicle_id, oil_category_id
    ) so ON v.id = so.vehicle_id AND si.oil_category_id = so.oil_category_id
    LEFT JOIN oil_categories oc ON (oc.id = si.oil_category_id OR oc.id = so.oil_category_id)
    WHERE v.deletestatus = 0
    GROUP BY v.id, v.plate_number, oc.id, oc.name
    HAVING remaining != 0 OR (total_in IS NULL AND total_out IS NULL)
    ORDER BY v.id, oc.id
  `);

  res.json({ code: 0, data: result[0] });
});

// 某辆车时间段内进出明细
router.get('/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const { start_date, end_date } = req.query;

  const vehicle = await db('vehicles').where({ id: vehicleId, deletestatus: 0 }).first();
  if (!vehicle) return res.status(404).json({ code: 404, msg: '车辆不存在' });

  let inQuery = db('stock_in')
    .join('oil_categories', 'stock_in.oil_category_id', 'oil_categories.id')
    .join('users', 'stock_in.operator_id', 'users.id')
    .select(
      db.raw("'入库' AS type"),
      'stock_in.id',
      'stock_in.stock_date AS date',
      'oil_categories.name AS category_name',
      'stock_in.liters',
      'stock_in.price_per_liter AS unit_price',
      'stock_in.total_amount',
      'users.real_name AS operator_name',
      'stock_in.remark'
    )
    .where('stock_in.vehicle_id', vehicleId)
    .where('stock_in.deletestatus', 0);

  let outQuery = db('stock_out')
    .join('oil_categories', 'stock_out.oil_category_id', 'oil_categories.id')
    .join('users', 'stock_out.operator_id', 'users.id')
    .select(
      db.raw("'出库' AS type"),
      'stock_out.id',
      'stock_out.purchase_date AS date',
      'oil_categories.name AS category_name',
      'stock_out.liters',
      'stock_out.unit_price',
      'stock_out.total_amount',
      'users.real_name AS operator_name',
      'stock_out.remark'
    )
    .where('stock_out.vehicle_id', vehicleId)
    .where('stock_out.deletestatus', 0);

  if (start_date) {
    inQuery = inQuery.where('stock_in.stock_date', '>=', start_date);
    outQuery = outQuery.where('stock_out.purchase_date', '>=', start_date);
  }
  if (end_date) {
    inQuery = inQuery.where('stock_in.stock_date', '<=', end_date);
    outQuery = outQuery.where('stock_out.purchase_date', '<=', end_date);
  }

  const [inRecords, outRecords] = await Promise.all([inQuery, outQuery]);
  const records = [...inRecords, ...outRecords].sort((a, b) => new Date(a.date) - new Date(b.date));

  // 汇总
  const inSummary = await db('stock_in')
    .where({ vehicle_id: vehicleId, deletestatus: 0 })
    .andWhere((qb) => {
      if (start_date) qb.where('stock_date', '>=', start_date);
      if (end_date) qb.where('stock_date', '<=', end_date);
    })
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .first();

  const outSummary = await db('stock_out')
    .where({ vehicle_id: vehicleId, deletestatus: 0 })
    .andWhere((qb) => {
      if (start_date) qb.where('purchase_date', '>=', start_date);
      if (end_date) qb.where('purchase_date', '<=', end_date);
    })
    .sum('liters as total_liters')
    .sum('total_amount as total_amount')
    .first();

  res.json({
    code: 0,
    data: {
      vehicle,
      records,
      summary: {
        total_in_liters: +inSummary.total_liters || 0,
        total_in_amount: toMoney(inSummary.total_amount || 0),
        total_out_liters: +outSummary.total_liters || 0,
        total_out_amount: toMoney(outSummary.total_amount || 0),
      },
    },
  });
});

module.exports = router;
