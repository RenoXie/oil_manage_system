const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

const VALID_ROLES = ['admin', 'employee', 'customer'];
const VALID_PERMISSIONS = [
  'dashboard', 'stock-in', 'stock-out', 'stock-all',
  'inventory', 'statistics', 'vehicles', 'categories', 'customers', 'users',
];
const MIN_PASSWORD_LENGTH = 6;

function validatePermissions(perms) {
  if (!Array.isArray(perms)) return [];
  return perms.filter(p => VALID_PERMISSIONS.includes(p));
}

router.get('/', adminOnly, async (req, res) => {
  try {
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
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/users |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, password, real_name, role, permissions, customer_id } = req.body;
    if (!username || !password || !real_name) {
      return res.status(400).json({ code: 400, msg: '请填写完整信息' });
    }
    if (typeof username !== 'string' || username.length > 50) {
      return res.status(400).json({ code: 400, msg: '用户名最长50字符' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 100) {
      return res.status(400).json({ code: 400, msg: `密码长度需在${MIN_PASSWORD_LENGTH}-100字符之间` });
    }
    if (typeof real_name !== 'string' || real_name.length > 50) {
      return res.status(400).json({ code: 400, msg: '姓名最长50字符' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ code: 400, msg: '角色值无效' });
    }
    const exists = await db('users').where({ username, deletestatus: 0 }).first();
    if (exists) return res.status(400).json({ code: 400, msg: '用户名已存在' });

    const hashed = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username, password: hashed, real_name,
      role: role || 'employee',
      permissions: JSON.stringify(validatePermissions(permissions)),
      customer_id: customer_id || null,
    });
    res.json({ code: 0, data: { id } });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/users |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id, deletestatus: 0 }).first();
    if (!user) return res.status(404).json({ code: 404, msg: '用户不存在' });

    const { real_name, role, password, permissions, customer_id } = req.body;
    const update = {};
    if (real_name !== undefined) {
      if (typeof real_name !== 'string' || real_name.length > 50) return res.status(400).json({ code: 400, msg: '姓名最长50字符' });
      update.real_name = real_name;
    }
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ code: 400, msg: '角色值无效' });
      update.role = role;
    }
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 100) {
        return res.status(400).json({ code: 400, msg: `密码长度需在${MIN_PASSWORD_LENGTH}-100字符之间` });
      }
      update.password = await bcrypt.hash(password, 10);
    }
    if (permissions !== undefined) {
      update.permissions = JSON.stringify(validatePermissions(permissions));
    }
    if (customer_id !== undefined) update.customer_id = customer_id || null;
    if (Object.keys(update).length === 0) return res.status(400).json({ code: 400, msg: '没有要更新的字段' });
    update.updated_at = db.fn.now();
    await db('users').where({ id: req.params.id }).update(update);
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] PUT /api/users/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    if (+req.params.id === req.user.id) {
      return res.status(400).json({ code: 400, msg: '不能删除自己' });
    }
    const user = await db('users').where({ id: req.params.id, deletestatus: 0 }).first();
    if (!user) return res.status(404).json({ code: 404, msg: '用户不存在' });

    await db('users').where({ id: req.params.id }).update({ deletestatus: 1 });
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] DELETE /api/users/:id |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
