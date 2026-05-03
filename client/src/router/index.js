import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '首页概览' } },
      { path: 'stock-in', name: 'StockIn', component: () => import('../views/StockIn.vue'), meta: { title: '入库管理' } },
      { path: 'stock-out', name: 'StockOut', component: () => import('../views/StockOut.vue'), meta: { title: '出库管理' } },
      { path: 'stock-all', name: 'StockAll', component: () => import('../views/StockAll.vue'), meta: { title: '进出明细' } },
      { path: 'vehicles', name: 'Vehicles', component: () => import('../views/Vehicles.vue'), meta: { title: '车辆管理' } },
      { path: 'categories', name: 'Categories', component: () => import('../views/Categories.vue'), meta: { title: '油品类别' } },
      { path: 'customers', name: 'Customers', component: () => import('../views/Customers.vue'), meta: { title: '客户管理' } },
      { path: 'inventory', name: 'Inventory', component: () => import('../views/Inventory.vue'), meta: { title: '车辆库存' } },
      { path: 'statistics', name: 'Statistics', component: () => import('../views/Statistics.vue'), meta: { title: '统计报表' } },
      { path: 'users', name: 'Users', component: () => import('../views/Users.vue'), meta: { title: '用户管理' } },
      { path: 'audit', name: 'AuditLog', component: () => import('../views/AuditLog.vue'), meta: { title: '审计日志' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.public || token) {
    next()
  } else {
    next('/login')
  }
})

export default router
