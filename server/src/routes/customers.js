const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { keyword } = req.query;
  let query = db('customers').where('deletestatus', 0);
  if (keyword) query = query.where('name', 'like', `%${keyword}%`);
  const list = await query.orderBy('id', 'desc');
  res.json({ code: 0, data: list });
});

router.post('/', async (req, res) => {
  const { name, phone, bank_name, bank_account } = req.body;
  if (!name) return res.status(400).json({ code: 400, msg: '请填写客户名称' });

  const existing = await db('customers').where({ name, deletestatus: 0 }).first();
  if (existing) return res.status(400).json({ code: 400, msg: '该客户名称已存在' });

  const [id] = await db('customers').insert({
    name,
    phone: phone || '',
    bank_name: bank_name || '',
    bank_account: bank_account || '',
  });
  res.json({ code: 0, data: { id } });
});

router.put('/:id', async (req, res) => {
  const customer = await db('customers').where({ id: req.params.id, deletestatus: 0 }).first();
  if (!customer) return res.status(404).json({ code: 404, msg: '客户不存在' });

  const { name, phone, bank_name, bank_account } = req.body;
  const update = {};
  if (name !== undefined) {
    const dup = await db('customers').where({ name, deletestatus: 0 }).whereNot({ id: req.params.id }).first();
    if (dup) return res.status(400).json({ code: 400, msg: '该客户名称已存在' });
    update.name = name;
  }
  if (phone !== undefined) update.phone = phone;
  if (bank_name !== undefined) update.bank_name = bank_name;
  if (bank_account !== undefined) update.bank_account = bank_account;

  await db('customers').where({ id: req.params.id }).update(update);
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', async (req, res) => {
  const customer = await db('customers').where({ id: req.params.id, deletestatus: 0 }).first();
  if (!customer) return res.status(404).json({ code: 404, msg: '客户不存在' });

  const hasRecords = await db('stock_out').where({ customer_id: req.params.id, deletestatus: 0 }).first();
  if (hasRecords) return res.status(400).json({ code: 400, msg: '该客户有关联的出库记录，无法删除' });

  await db('customers').where({ id: req.params.id }).update({ deletestatus: 1 });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
