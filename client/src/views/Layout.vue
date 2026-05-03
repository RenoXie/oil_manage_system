<template>
  <el-container style="height:100vh">
    <el-aside :width="collapsed ? '64px' : '220px'" style="background:#304156;transition:width 0.3s">
      <div class="logo" :style="collapsed ? 'height:56px' : ''">
        <span v-if="!collapsed">慧和晟<br/>油品进出库管理系统</span>
        <span v-else style="font-size:14px">慧和晟</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        style="border-right:none"
        :collapse="collapsed"
      >
        <el-menu-item v-for="item in menuItems" :key="item.key" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;border-bottom:1px solid #dcdfe6;display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:56px">
        <div style="display:flex;align-items:center">
          <el-icon style="cursor:pointer;font-size:20px;margin-right:16px" @click="collapsed = !collapsed">
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb>
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="$route.meta?.title">{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div style="display:flex;align-items:center">
          <el-button v-if="userStore.user?.role==='customer'" text type="primary" style="margin-right:12px" @click="openProfile">个人信息</el-button>
          <span style="margin-right:12px;color:#606266">{{ userStore.user?.real_name }}</span>
          <el-button text type="danger" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main style="background:#f0f2f5">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <el-dialog v-model="profileVisible" title="个人信息" width="450px" :close-on-click-modal="false">
    <el-form ref="profileFormRef" :model="profileForm" :rules="profileRules" label-width="80px">
      <el-form-item label="客户名称" prop="name">
        <el-input v-model="profileForm.name" />
      </el-form-item>
      <el-form-item label="联系电话" prop="phone">
        <el-input v-model="profileForm.phone" placeholder="手机或固话均可" />
      </el-form-item>
      <el-form-item label="开户行">
        <el-input v-model="profileForm.bank_name" />
      </el-form-item>
      <el-form-item label="银行账号">
        <el-input v-model="profileForm.bank_account" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="profileVisible = false">取消</el-button>
      <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox } from 'element-plus'
import { getCustomers, updateCustomer } from '../api/customers'
import { DataAnalysis, Download, Upload, List, Odometer, TrendCharts, Van, Collection, User, UserFilled, Document, Fold, Expand } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const collapsed = ref(false)

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
  { key: 'audit',      path: '/audit',      label: '审计日志', icon: Document },
]

// customer profile dialog
const profileVisible = ref(false)
const profileSaving = ref(false)
const profileFormRef = ref(null)
const profileForm = reactive({ name: '', phone: '', bank_name: '', bank_account: '' })
const profileRules = {
  name: [{ required: true, message: '请输入客户名称' }],
}

async function openProfile() {
  try {
    const res = await getCustomers()
    const c = res.data.find((x) => x.id === userStore.user.customer_id)
    if (c) {
      profileForm.name = c.name
      profileForm.phone = c.phone || ''
      profileForm.bank_name = c.bank_name || ''
      profileForm.bank_account = c.bank_account || ''
    }
  } catch { /* ignore */ }
  profileVisible.value = true
}

async function saveProfile() {
  const valid = await profileFormRef.value.validate().catch(() => false)
  if (!valid) return
  profileSaving.value = true
  try {
    await updateCustomer(userStore.user.customer_id, {
      name: profileForm.name,
      phone: profileForm.phone,
      bank_name: profileForm.bank_name,
      bank_account: profileForm.bank_account,
    })
    profileVisible.value = false
  } finally { profileSaving.value = false }
}

function hasPermission(key) {
  const u = userStore.user
  if (!u) return false
  if (u.role === 'admin') return true
  return (u.permissions || []).includes(key)
}

const menuItems = computed(() => allMenuItems.filter((item) => hasPermission(item.key)))

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  userStore.logout()
  router.push('/login')
}
</script>

<style>
.logo {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  transition: height 0.3s;
}
.logo span {
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.6;
  text-align: center;
}
.el-main {
  padding: 20px;
}
</style>
