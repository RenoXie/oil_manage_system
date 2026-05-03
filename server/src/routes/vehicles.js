const express = require('express');
const db = require('../config/db');
const { auth, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const list = await db('vehicles').where({ deletestatus: 0 }).orderBy('created_at', 'desc');
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/vehicles |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', requirePermission('vehicles'), async (req, res) => {
  try {
    const { plate_number, notes } = req.body;
    if (!plate_number) return res.status(400).json({ code: 400, msg: '车牌号不能为空' });
    if (typeof plate_number !== 'string' || plate_number.length > 20) return res.status(400).json({ code: 400, msg: '车牌号最长20字符' });
    if (notes && typeof notes === 'string' && notes.length > 500) return res.status(400).json({ code: 400, msg: '备注最长500字符' });

    const exists = await db('vehicles').where({ plate_number, deletestatus: 0 }).first();
    if (exists) return res.status(400).json({ code: 400, msg: '车牌号已存在' });

    const [id] = await db('vehicles').insert({ plate_number, notes: notes || '' });
    res.json({ code: 0, data: { id } });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/vehicles |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', requirePermission('vehicles'), async (req, res) => {
  try {
    const record = await db('vehicles').where({ id: req.params.id, deletestatus: 0 }).first();
    if (!record) return res.status(404).json({ code: 404, msg: '车辆不存在' });

    const { plate_number, notes } = req.body;
    const update = {};
    if (plate_number !== undefined) {
      if (typeof plate_number !== 'string' || plate_number.length > 20) return res.status(400).json({ code: 400, msg: '车牌号最长20字符' });
      const exists = await db('vehicles').where({ plate_number, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
      if (exists) return res.status(400).json({ code: 400, msg: '车牌号已存在' });
      update.plate_number = plate_number;
    }
    if (notes !== undefined) {
      if (typeof notes === 'string' && notes.length > 500) return res.status(400).json({ code: 400, msg: '备注最长500字符' });
      update.notes = notes;
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ code: 400, msg: '没有要更新的字段' });
    await db('vehicles').where({ id: req.params.id }).update(update);
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] PUT /api/vehicles/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', requirePermission('vehicles'), async (req, res) => {
  try {
    const record = await db('vehicles').where({ id: req.params.id, deletestatus: 0 }).first();
    if (!record) return res.status(404).json({ code: 404, msg: '车辆不存在' });

    const hasStock = await db('stock_in').where({ vehicle_id: req.params.id, deletestatus: 0 }).first()
      || await db('stock_out').where({ vehicle_id: req.params.id, deletestatus: 0 }).first();
    if (hasStock) return res.status(400).json({ code: 400, msg: '该车辆有关联的出入库记录，无法删除' });

    await db('vehicles').where({ id: req.params.id }).update({ deletestatus: 1 });
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] DELETE /api/vehicles/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
