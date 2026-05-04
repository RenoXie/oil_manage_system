<template>
  <div class="login-container">
    <div class="theme-toggle">
      <el-button text style="font-size:22px" @click="toggleTheme">
        <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
      </el-button>
    </div>
    <div class="login-card">
      <h1>宁波慧和晟供应链管理有限公司<br/>油品进出库管理系统</h1>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width:100%" @click="handleLogin">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { Sunny, Moon } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const isDark = ref(document.documentElement.classList.contains('dark'))
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
const formRef = ref(null)
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(function () { return false })
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    router.push('/')
  } catch (_e) {
    // 错误在 request 拦截器中统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style>
.theme-toggle {
  position: fixed;
  top: 16px;
  right: 24px;
}
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--main-bg, #f0f2f5);
}
.login-card {
  width: 420px;
  padding: 40px;
  background: var(--header-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
html.dark .login-card {
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
}
.login-card h1 {
  text-align: center;
  font-size: 16px;
  color: var(--el-text-color-primary, #303133);
  margin-bottom: 30px;
  font-weight: 600;
  line-height: 1.6;
}
</style>
