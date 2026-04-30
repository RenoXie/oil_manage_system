require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

const app = express();

app.use(cors());
app.use(express.json());

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

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ code: 500, msg: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
