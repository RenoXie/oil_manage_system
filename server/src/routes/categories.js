const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const list = await db('oil_categories').orderBy('created_at', 'desc');
  res.json({ code: 0, data: list });
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ code: 400, msg: '类别名称不能为空' });
  }
  const exists = await db('oil_categories').where({ name }).first();
  if (exists) {
    return res.status(400).json({ code: 400, msg: '类别已存在' });
  }
  const [id] = await db('oil_categories').insert({ name });
  res.json({ code: 0, data: { id } });
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (name) {
    const exists = await db('oil_categories').where({ name }).whereNot({ id: req.params.id }).first();
    if (exists) {
      return res.status(400).json({ code: 400, msg: '类别名已存在' });
    }
  }
  await db('oil_categories').where({ id: req.params.id }).update({ name });
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', async (req, res) => {
  const inUse = await db('stock_in').where({ oil_category_id: req.params.id }).first();
  const outUse = await db('stock_out').where({ oil_category_id: req.params.id }).first();
  if (inUse || outUse) {
    return res.status(400).json({ code: 400, msg: '该类别已有出入库记录，无法删除' });
  }
  await db('oil_categories').where({ id: req.params.id }).del();
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
