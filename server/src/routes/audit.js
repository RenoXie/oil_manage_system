const express = require('express');
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth);
router.use(adminOnly);

router.get('/', async (req, res) => {
  try {
    const { table_name, action, start_date, end_date, page = 1, page_size = 20 } = req.query;

    let query = db('audit_logs')
      .join('users', 'audit_logs.operator_id', 'users.id')
      .select(
        'audit_logs.*',
        'users.real_name as operator_name'
      );

    if (table_name) query = query.where('audit_logs.table_name', table_name);
    if (action) query = query.where('audit_logs.action', action);
    if (start_date) query = query.where('audit_logs.created_at', '>=', start_date);
    if (end_date) query = query.where('audit_logs.created_at', '<=', end_date + ' 23:59:59');

    const total = await query.clone().count('* as count').first();
    const list = await query
      .orderBy('audit_logs.id', 'desc')
      .limit(+page_size)
      .offset((+page - 1) * +page_size);

    res.json({
      code: 0,
      data: { list, total: total.count, page: +page, page_size: +page_size },
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/audit |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

module.exports = router;
