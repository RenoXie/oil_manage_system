<template>
  <el-container style="height:100vh">
    <el-aside width="220px" style="background:#304156">
      <div class="logo">
        <span>宁波慧和晟供应链管理</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        style="border-right:none"
      >
        <el-menu-item v-for="item in menuItems" :key="item.key" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;border-bottom:1px solid #dcdfe6;display:flex;align-items:center;justify-content:space-between;padding:0 20px">
        <el-breadcrumb>
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item v-if="$route.meta.title">{{ $route.meta.title }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div>
          <span style="margin-right:12px;color:#606266">{{ userStore.user?.real_name }}</span>
          <el-button text type="danger" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main style="background:#f0f2f5">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { DataAnalysis, Download, Upload, List, Odometer, TrendCharts, Van, Collection, User, UserFilled } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const allMenuItems = [
  { key: 'dashboard',  path: '/dashboard',  label: '首页概览', icon: DataAnalysis },
  { key: 'stock-in',   path: '/stock-in',   label: '入库管理', icon: Download },
  { key: 'stock-out',  path: '/stock-out',  label: '出库管理', icon: Upload },
  { key: 'stock-all',  path: '/stock-all',  label: '进出明细', icon: List },
  { key: 'inventory',  path: '/inventory',  label: '车辆库存', icon: Odometer },
  { key: 'statistics', path: '/statistics', label: '统计报表', icon: TrendCharts },
  { key: 'vehicles',   path: '/vehicles',   label: '车辆管理', icon: Van },
  { key: 'categories', path: '/categories', label: '油品类别', icon: Collection },
  { key: 'customers',  path: '/customers',  label: '客户管理', icon: User },
  { key: 'users',      path: '/users',      label: '用户管理', icon: UserFilled },
]

function hasPermission(key) {
  const u = userStore.user
  if (!u) return false
  if (u.role === 'admin') return true
  return (u.permissions || []).includes(key)
}

const menuItems = computed(() => allMenuItems.filter((item) => hasPermission(item.key)))

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style>
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo span {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
}
.el-main {
  padding: 20px;
}
</style>
