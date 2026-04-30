const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const list = await db('vehicles').where({ deletestatus: 0 }).orderBy('created_at', 'desc');
  res.json({ code: 0, data: list });
});

router.post('/', async (req, res) => {
  const { plate_number, notes } = req.body;
  if (!plate_number) {
    return res.status(400).json({ code: 400, msg: '车牌号不能为空' });
  }
  const exists = await db('vehicles').where({ plate_number, deletestatus: 0 }).first();
  if (exists) {
    return res.status(400).json({ code: 400, msg: '车牌号已存在' });
  }
  const [id] = await db('vehicles').insert({ plate_number, notes });
  res.json({ code: 0, data: { id } });
});

router.put('/:id', async (req, res) => {
  const { plate_number, notes } = req.body;
  if (plate_number) {
    const exists = await db('vehicles').where({ plate_number, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
    if (exists) {
      return res.status(400).json({ code: 400, msg: '车牌号已存在' });
    }
  }
  await db('vehicles').where({ id: req.params.id, deletestatus: 0 }).update({ plate_number, notes });
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', async (req, res) => {
  await db('vehicles').where({ id: req.params.id }).update({ deletestatus: 1 });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
