# CLAUDE.md — 慧和晟油品进出库管理系统

## 项目概述

宁波慧和晟供应链管理有限公司的油品进出库管理系统。全栈 Web 应用：Vue 3 前端 + Express 5 后端 + MySQL 数据库。管理车辆油品入库（采购）、出库（销售）、库存统计、用户权限、操作审计。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 (`<script setup>`), Element Plus 2.x (中文), Pinia, Vue Router 4, ECharts 6, Vite 8 |
| 后端 | Express 5, Knex 3 (mysql2), JWT (jsonwebtoken 9), bcryptjs, helmet, express-rate-limit |
| 数据库 | MySQL, utf8mb4_unicode_ci |
| 其他 | xlsx (Excel 导出), dotenv, cors |

## 目录结构

```
D:\dmx\oil_manager_system\
├── server/                  # Express 后端 (端口 3000)
│   ├── src/
│   │   ├── app.js           # 入口，挂载所有路由
│   │   ├── config/db.js     # Knex 实例
│   │   ├── middleware/       # auth.js (JWT+角色), auditLog.js (审计), dateValidate.js
│   │   ├── routes/           # 12 个路由模块 (auth, users, vehicles, categories, customers, suppliers, stockIn, stockOut, stockAll, inventory, statistics, audit)
│   │   └── utils/            # captcha.js, money.js
│   ├── migrations/           # 8 个迁移文件 (001~008)
│   ├── seeds/                # admin 账号种子
│   ├── knexfile.js
│   ├── .env / .env.prod
│   └── setup-db.js           # 建库脚本
├── client/                  # Vue 前端 (端口 5173)
│   └── src/
│       ├── api/              # 14 个 API 模块 + request.js (Axios 拦截器+自动刷新 token)
│       ├── views/            # 13 个页面 (Login, Layout, Dashboard, StockIn/Out/All, Vehicles, Categories, Customers, Inventory, Statistics, Users, AuditLog, Requirements)
│       ├── stores/user.js    # Pinia 用户状态
│       ├── router/index.js   # 路由+守卫
│       └── utils/            # money.js, date.js, export.js, debounce.js
├── update.bat               # 客户增量更新脚本 (停服→拉代码→装依赖→迁移→补JWT→启动)
├── setup.bat / start.bat    # 首次安装/日常启动
└── stop.bat                 # 停止所有服务
```

## 数据库表

| 表 | 说明 | 关键字段 |
|---|---|---|
| `users` | 用户 | username, password(bcrypt), role(admin/employee/customer), permissions(JSON), customer_id, refresh_token |
| `vehicles` | 车辆 | plate_number, notes |
| `oil_categories` | 油品类别 | name |
| `customers` | 客户 | name, phone, bank_name, bank_account |
| `suppliers` | 供应商 | name, contact_person, phone, address, notes |
| `stock_in` | 入库记录 | vehicle_id, oil_category_id, supplier_id, price_per_liter, liters, total_amount, stock_date, operator_id, last_modified_by |
| `stock_out` | 出库记录 | vehicle_id, oil_category_id, customer_id, unit_price, liters, total_amount, purchase_date, operator_id, last_modified_by |
| `audit_logs` | 审计日志(主表，近12月) | table_name, record_id, action(create/update/delete), old_data(TEXT JSON), new_data(TEXT JSON), operator_id, created_at |
| `audit_logs_archive` | 审计日志(归档) | 同 audit_logs + archived_at |

**所有主表均使用软删除** (`deletestatus` TINYINT DEFAULT 0)，查询时统一过滤 `WHERE deletestatus = 0`，删除时只标记不真删。被 stock_in/stock_out 引用的记录阻止删除并返回错误。

## 认证与权限

### JWT 流程
- 登录返回 30 分钟 access_token + 7 天 refresh_token
- 前端 Axios 拦截器自动刷新：收到 401 → 排队并发请求 → 静默刷新 → 重放
- Token 过期检测在路由守卫中（base64url 解码，注意需要补 `=` 填充和替换 `-`/`_`）

### 三种角色
| 角色 | 权限范围 |
|---|---|
| `admin` | 全部权限（代码中硬编码绕过所有权限检查） |
| `employee` | 细粒度权限，按 `users.permissions` JSON 数组中存的 key 控制（如 `["dashboard","stock-in","stock-out"]`） |
| `customer` | 只能看出库页和首页概览，数据自动过滤到自己的 customer_id |

### 权限 Key 列表
`dashboard, stock-in, stock-out, stock-all, inventory, statistics, vehicles, categories, customers, audit, users`

### 中间件层级
- `auth` → 验证 JWT，挂载 `req.user`
- `adminOnly` → 检查 `req.user.role === 'admin'`
- `requirePermission(key)` → admin 放行、customer 拒绝、employee 检查 permissions 数组
- `validateDateRange` → 校验 start/end 日期格式并确保范围 ≤ 31 天

## 核心编码模式

### 1. 写操作必须加审计日志 + 事务
```js
const trx = await db.transaction();
try {
  // 数据操作使用 .transacting(trx)
  await db('table').transacting(trx).where(...).update(...);
  // 审计日志也加入同一事务
  await auditLog(tableName, recordId, action, operatorId, oldData, newData, trx);
  await trx.commit();
} catch (err) {
  await trx.rollback();
  // 错误处理
}
```
`auditLog()` 在 `server/src/middleware/auditLog.js`。审计数据中排除密码字段，密码变更记录为 `password_changed: true`。

**新增任何涉及数据写操作的新模块，必须同步加 auditLog。**

### 2. 审计日志归档
- 主表 `audit_logs` 保留近 12 个月数据
- `POST /api/audit/archive` 将老数据移入 `audit_logs_archive`
- 前端查询通过 `include_archived` 参数联合查两表（JS 侧合并排序分页）
- 前端页面有提示栏 + 勾选框 + 归档行标签

### 3. 金额计算
前后端共用的 `toMoney(n)`：`Math.round((+n + Number.EPSILON) * 100) / 100`，防止 IEEE 754 浮点误差。

### 4. API 响应格式
```json
{ "code": 0, "data": {...} }           // 成功
{ "code": 400/401/403/404/429/500, "msg": "..." }  // 错误
```
列表接口统一 `{ list, total, page, page_size }` 分页格式。

### 5. 前端风格
- Element Plus 中文 locale
- 所有图标全局注册（`@element-plus/icons-vue`）
- 支持深浅色模式：`document.documentElement.classList.toggle('dark')`，偏好存 localStorage key `theme`
- 主题切换按钮在 Layout 头部和 Login 页面

### 6. 已完成的改进（注意不要回退）
- 所有 7 个业务模块均有完整审计日志覆盖（categories, customers, vehicles, suppliers, users, stockIn, stockOut）
- 登录按钮无响应 → JWT base64url vs atob 兼容问题已修复
- 审计页面支持 7 种操作表 + 操作人下拉筛选（filterable）
- DELETE 操作双重防御（`WHERE id = ? AND deletestatus = 0`）
- update.bat 自动补 JWT_SECRET

## 开发环境

- 默认账号：`admin` / `admin123`
- 默认数据库：`oilms` (dev) / `oilms_prod` (prod)
- Git：`D:\dev\Git\bin\git.exe`
- 修改完代码必须测试后再提交，提交前必须询问用户

## 启动命令

- 后端：`node src/app.js`（Node ≥18 用 `--watch` 自动重载）
- 前端：`npx vite --host`
- 首次安装：`setup.bat`
- 日常启动：`start.bat`
- 客户更新：`update.bat`
