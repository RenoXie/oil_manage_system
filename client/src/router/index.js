import { createRouter, createWebHistory } from 'vue-router'

function getToken() {
  return localStorage.getItem('token') || ''
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return atob(str)
}

function isTokenExpired() {
  const token = getToken()
  if (!token) return true
  try {
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch { return null }
}

const adminOnly = ['Users', 'AuditLog']
const customerBlocked = ['StockIn', 'StockAll', 'Inventory', 'Statistics', 'Vehicles', 'Categories', 'Customers']

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
      { path: 'requirements', name: 'Requirements', component: () => import('../views/Requirements.vue'), meta: { title: '需求管理' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    return next()
  }
  if (isTokenExpired()) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return next('/login')
  }
  const user = getUser()
  if (!user) return next('/login')

  // admin-only pages
  if (adminOnly.includes(to.name) && user.role !== 'admin') {
    return next('/dashboard')
  }
  // customer-blocked pages
  if (user.role === 'customer' && customerBlocked.includes(to.name)) {
    return next('/stock-out')
  }

  next()
})

export default router
