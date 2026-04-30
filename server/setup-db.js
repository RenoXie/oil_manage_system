const mysql = require('mysql2/promise');

async function setup() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS `oilms` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('数据库 oilms 已就绪');
  await connection.end();
}

setup().catch((err) => {
  console.error('数据库创建失败:', err.message);
  process.exit(1);
});
