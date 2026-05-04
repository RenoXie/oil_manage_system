require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vehicleRoutes = require('./routes/vehicles');
const categoryRoutes = require('./routes/categories');
const customerRoutes = require('./routes/customers');
const stockInRoutes = require('./routes/stockIn');
const stockOutRoutes = require('./routes/stockOut');
const stockAllRoutes = require('./routes/stockAll');
const inventoryRoutes = require('./routes/inventory');
const statisticsRoutes = require('./routes/statistics');
const auditRoutes = require('./routes/audit');
const supplierRoutes = require('./routes/suppliers');

const app = express();

app.use(helmet());

if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Check your .env file.');
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, msg: '请求过于频繁，请稍后再试' },
});
app.use(limiter);
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stock-in', stockInRoutes);
app.use('/api/stock-out', stockOutRoutes);
app.use('/api/stock-all', stockAllRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/suppliers', supplierRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ${req.method} ${req.originalUrl} | user=${req.user?.id || 'anon'} |`, err.stack || err.message);
  if (err.status) {
    return res.status(err.status).json({ code: err.status, msg: err.message });
  }
  res.status(500).json({ code: 500, msg: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
