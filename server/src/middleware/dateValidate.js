function isValidDate(str) {
  if (!str) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return false;
  const y = +m[1]; const mo = +m[2]; const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const lastDay = new Date(y, mo, 0).getDate();
  return d <= lastDay;
}

function validateDateRange(req, res, next) {
  const { start_date, end_date } = req.query;
  if (start_date && !isValidDate(start_date)) {
    return res.status(400).json({ code: 400, msg: '起始日期格式无效' });
  }
  if (end_date && !isValidDate(end_date)) {
    return res.status(400).json({ code: 400, msg: '结束日期格式无效' });
  }
  next();
}

module.exports = { isValidDate, validateDateRange };
