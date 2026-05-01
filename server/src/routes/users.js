const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', adminOnly, async (req, res) => {
  const users = await db('users').select('id', 'username', 'real_name', 'role', 'permissions', 'customer_id', 'created_at').where({ deletestatus: 0 });
  const data = users.map((u) => {
    if (u.permissions) {
      if (typeof u.permissions === 'string') {
        try { u.permissions = JSON.parse(u.permissions); } catch { u.permissions = []; }
      }
      if (!Array.isArray(u.permissions)) u.permissions = [];
    }
    return u;
  });
  res.json({ code: 0, data });
});

router.post('/', adminOnly, async (req, res) => {
  const { username, password, real_name, role, permissions, customer_id } = req.body;
  if (!username || !password || !real_name) {
    return res.status(400).json({ code: 400, msg: '请填写完整信息' });
  }
  const exists = await db('users').where({ username, deletestatus: 0 }).first();
  if (exists) {
    return res.status(400).json({ code: 400, msg: '用户名已存在' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    username,
    password: hashed,
    real_name,
    role: role || 'employee',
    permissions: JSON.stringify(permissions || []),
    customer_id: customer_id || null,
  });
  res.json({ code: 0, data: { id } });
});

router.put('/:id', adminOnly, async (req, res) => {
  const { real_name, role, password, permissions, customer_id } = req.body;
  const update = {};
  if (real_name) update.real_name = real_name;
  if (role) update.role = role;
  if (password) update.password = await bcrypt.hash(password, 10);
  if (permissions !== undefined) update.permissions = JSON.stringify(permissions);
  if (customer_id !== undefined) update.customer_id = customer_id || null;
  update.updated_at = db.fn.now();
  await db('users').where({ id: req.params.id, deletestatus: 0 }).update(update);
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', adminOnly, async (req, res) => {
  if (+req.params.id === req.user.id) {
    return res.status(400).json({ code: 400, msg: '不能删除自己' });
  }
  await db('users').where({ id: req.params.id }).update({ deletestatus: 1 });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
