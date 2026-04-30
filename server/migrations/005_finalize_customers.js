exports.up = function (knex) {
  return knex.schema
    .alterTable('stock_out', (t) => {
      t.dropColumn('buyer_name');
    })
    .then(() =>
      knex.raw(
        'ALTER TABLE stock_out MODIFY customer_id INT UNSIGNED NOT NULL, ADD FOREIGN KEY (customer_id) REFERENCES customers(id)'
      )
    );
};

exports.down = function (knex) {
  return knex.raw(
    'ALTER TABLE stock_out DROP FOREIGN KEY stock_out_customer_id_foreign, MODIFY customer_id INT UNSIGNED NULL'
  ).then(() =>
    knex.schema.alterTable('stock_out', (t) => {
      t.string('buyer_name', 100).defaultTo('');
    })
  );
};
