const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, msg: '用户名和密码不能为空' });
  }
  const user = await db('users').where({ username }).first();
  if (!user) {
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ code: 401, msg: '用户名或密码错误' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, real_name: user.real_name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  res.json({
    code: 0,
    data: {
      token,
      user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role },
    },
  });
});

router.post('/register', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '仅管理员可创建用户' });
  }
  const { username, password, real_name, role } = req.body;
  if (!username || !password || !real_name) {
    return res.status(400).json({ code: 400, msg: '请填写完整信息' });
  }
  const exists = await db('users').where({ username }).first();
  if (exists) {
    return res.status(400).json({ code: 400, msg: '用户名已存在' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    username,
    password: hashed,
    real_name,
    role: role || 'operator',
  });
  res.json({ code: 0, data: { id } });
});

router.get('/me', auth, async (req, res) => {
  const user = await db('users').select('id', 'username', 'real_name', 'role').where({ id: req.user.id }).first();
  res.json({ code: 0, data: user });
});

module.exports = router;
