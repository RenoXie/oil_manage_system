const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  const adminExists = await knex('users').where('username', 'admin').first();
  if (adminExists) return;

  await knex('stock_out').del();
  await knex('stock_in').del();
  await knex('oil_categories').del();
  await knex('vehicles').del();
  await knex('users').del();

  const hashedPassword = await bcrypt.hash('admin123', 10);

  await knex('users').insert([
    {
      username: 'admin',
      password: hashedPassword,
      real_name: '系统管理员',
      role: 'admin',
    },
  ]);
};
