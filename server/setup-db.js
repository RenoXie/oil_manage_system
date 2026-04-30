require('dotenv').config();
const mysql = require('mysql2/promise');

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database ${process.env.DB_NAME} is ready.`);
  await connection.end();
}

setup().catch((err) => {
  console.error('Database creation failed:', err.message);
  process.exit(1);
});
