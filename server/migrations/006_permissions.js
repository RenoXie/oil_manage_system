exports.up = function (knex) {
  return knex.raw(
    "UPDATE users SET role = 'employee' WHERE role = 'operator'"
  ).then(() =>
    knex.raw(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin','employee','customer') NOT NULL DEFAULT 'employee'"
    )
  ).then(async () => {
    const hasPerms = await knex.schema.hasColumn('users', 'permissions');
    const hasCustId = await knex.schema.hasColumn('users', 'customer_id');

    if (!hasPerms && !hasCustId) {
      // 两个列都不存在，一次加完
      return knex.schema.alterTable('users', (t) => {
        t.json('permissions').comment('页面权限key数组');
        t.integer('customer_id').unsigned().nullable().references('id').inTable('customers').comment('关联客户(仅customer角色)');
      }).then(() =>
        knex.raw("UPDATE users SET permissions = '[]'")
      );
    }
    if (!hasPerms) {
      await knex.schema.alterTable('users', (t) => {
        t.json('permissions').comment('页面权限key数组');
      });
      await knex.raw("UPDATE users SET permissions = '[]'");
    }
    if (!hasCustId) {
      await knex.schema.alterTable('users', (t) => {
        t.integer('customer_id').unsigned().nullable().references('id').inTable('customers').comment('关联客户(仅customer角色)');
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (t) => {
    t.dropForeign('customer_id');
    t.dropColumn('customer_id');
    t.dropColumn('permissions');
  }).then(() =>
    knex.raw(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin','operator') NOT NULL DEFAULT 'operator'"
    )
  ).then(() =>
    knex.raw(
      "UPDATE users SET role = 'operator' WHERE role IN ('employee','customer')"
    )
  );
};
