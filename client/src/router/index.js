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
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'stock-in', name: 'StockIn', component: () => import('../views/StockIn.vue') },
      { path: 'stock-out', name: 'StockOut', component: () => import('../views/StockOut.vue') },
      { path: 'vehicles', name: 'Vehicles', component: () => import('../views/Vehicles.vue') },
      { path: 'categories', name: 'Categories', component: () => import('../views/Categories.vue') },
      { path: 'inventory', name: 'Inventory', component: () => import('../views/Inventory.vue') },
      { path: 'statistics', name: 'Statistics', component: () => import('../views/Statistics.vue') },
      { path: 'users', name: 'Users', component: () => import('../views/Users.vue') },
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
