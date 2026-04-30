require('dotenv').config();
const db = require('./src/config/db');

(async () => {
  console.log('开始迁移客户数据...');

  // 1. 获取所有不重复的 buyer_name
  const names = await db('stock_out')
    .distinct('buyer_name')
    .where('deletestatus', 0)
    .whereNotNull('buyer_name')
    .where('buyer_name', '!=', '');

  console.log(`找到 ${names.length} 个不同的购买人名称`);

  for (const row of names) {
    const name = row.buyer_name;
    // 检查是否已存在
    let customer = await db('customers').where({ name }).first();
    if (!customer) {
      const [id] = await db('customers').insert({ name });
      console.log(`  创建客户: ${name} (id=${id})`);
      customer = { id };
    } else {
      console.log(`  客户已存在: ${name} (id=${customer.id})`);
    }
    // 更新 stock_out 中的 customer_id
    const updated = await db('stock_out')
      .where({ buyer_name: name })
      .update({ customer_id: customer.id });
    console.log(`  更新 ${updated} 条出库记录`);
  }

  console.log('数据迁移完成');
  process.exit(0);
})().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
