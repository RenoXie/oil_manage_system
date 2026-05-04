const express = require('express');
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth);
router.use(adminOnly);

const ARCHIVE_MONTHS = 12;

function buildWhere(query, { table_name, action, operator_id, start_date, end_date }) {
  if (table_name) query = query.where('table_name', table_name);
  if (action) query = query.where('action', action);
  if (operator_id) query = query.where('operator_id', +operator_id);
  if (start_date) query = query.where('created_at', '>=', start_date);
  if (end_date) query = query.where('created_at', '<=', end_date + ' 23:59:59');
  return query;
}

function mainQuery() {
  return db('audit_logs')
    .join('users', 'audit_logs.operator_id', 'users.id')
    .select('audit_logs.*', 'users.real_name as operator_name', db.raw('0 as archived'));
}

function archiveQuery() {
  return db('audit_logs_archive')
    .join('users', 'audit_logs_archive.operator_id', 'users.id')
    .select('audit_logs_archive.*', 'users.real_name as operator_name', db.raw('1 as archived'));
}

router.get('/', async (req, res) => {
  try {
    const { table_name, action, operator_id, start_date, end_date, page = 1, page_size = 20, include_archived } = req.query;
    const includeArchived = include_archived === '1' || include_archived === 'true';
    const filters = { table_name, action, operator_id, start_date, end_date };
    const limit = +page_size;
    const offset = (+page - 1) * +page_size;

    let total, list;

    if (includeArchived) {
      const mQ = buildWhere(mainQuery(), filters);
      const aQ = buildWhere(archiveQuery(), filters);
      const [mainCount, mainList, archCount, archList] = await Promise.all([
        mQ.clone().count('* as count').first(),
        mQ.clone().orderBy('created_at', 'desc'),
        aQ.clone().count('* as count').first(),
        aQ.clone().orderBy('created_at', 'desc'),
      ]);
      total = (mainCount.count || 0) + (archCount.count || 0);
      const merged = [...mainList, ...archList].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      list = merged.slice(offset, offset + limit);
    } else {
      const mQ = buildWhere(mainQuery(), filters);
      const [count, rows] = await Promise.all([
        mQ.clone().count('* as count').first(),
        mQ.orderBy('created_at', 'desc').limit(limit).offset(offset),
      ]);
      total = count.count;
      list = rows;
    }

    res.json({
      code: 0,
      data: { list, total, page: +page, page_size: +page_size },
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/audit |`, err.message);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
});

router.post('/archive', async (req, res) => {
  try {
    const months = req.body.months || ARCHIVE_MONTHS;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const oldLogs = await db('audit_logs')
      .where('created_at', '<', cutoff)
      .select();

    if (oldLogs.length === 0) {
      return res.json({ code: 0, msg: '没有需要归档的数据', archived: 0 });
    }

    const archiveRows = oldLogs.map(({ id, ...rest }) => rest);
    const ids = oldLogs.map((r) => r.id);

    await db.transaction(async (trx) => {
      await db('audit_logs_archive').transacting(trx).insert(archiveRows);
      await db('audit_logs').transacting(trx).whereIn('id', ids).del();
    });

    res.json({ code: 0, msg: '归档完成', archived: ids.length });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/audit/archive |`, err.message);
    res.status(500).json({ code: 500, msg: '归档失败' });
  }
});

module.exports = router;
