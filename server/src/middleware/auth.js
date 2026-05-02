const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, msg: '未登录或 token 已过期' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ code: 401, msg: 'token 无效或已过期' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '仅管理员可操作' });
  }
  next();
}

function hasPermission(user, key) {
  if (user.role === 'admin') return true;
  const perms = user.permissions || [];
  return perms.includes(key);
}

// 增删改权限中间件：admin 全通过，customer 全拒绝，employee 按权限 key 判断
function requirePermission(key) {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();
    if (req.user.role === 'customer') {
      return res.status(403).json({ code: 403, msg: '客户无此操作权限' });
    }
    const perms = req.user.permissions || [];
    if (!perms.includes(key)) {
      return res.status(403).json({ code: 403, msg: '无权限，请联系管理员授权' });
    }
    next();
  };
}

module.exports = { auth, adminOnly, hasPermission, requirePermission };
