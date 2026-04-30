<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>用户管理</span>
        <el-button type="primary" @click="openDialog()">添加用户</el-button>
      </div>
    </template>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="real_name" label="姓名" width="120" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role==='admin'?'danger':'info'">{{ row.role==='admin'?'管理员':'操作员' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at, true) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '添加用户'" width="450px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="!!editId" />
        </el-form-item>
        <el-form-item label="姓名" prop="real_name">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%">
            <el-option label="管理员" value="admin" />
            <el-option label="操作员" value="operator" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码" :prop="editId ? '' : 'password'">
          <el-input v-model="form.password" :placeholder="editId ? '留空则不修改' : '请输入密码'" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '../stores/user'
import { getUsers, createUser, updateUser, deleteUser } from '../api/users'
import { formatDate } from '../utils/date'

const userStore = useUserStore()
const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ username: '', real_name: '', role: 'operator', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  real_name: [{ required: true, message: '请输入姓名' }],
  password: [{ required: true, message: '请输入密码' }],
}

function resetForm() {
  editId.value = null
  Object.assign(form, { username: '', real_name: '', role: 'operator', password: '' })
  formRef.value?.resetFields()
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    form.username = row.username
    form.real_name = row.real_name
    form.role = row.role
    form.password = ''
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const data = { real_name: form.real_name, role: form.role }
    if (form.password) data.password = form.password
    if (editId.value) {
      await updateUser(editId.value, data)
    } else {
      data.username = form.username
      await createUser(data)
    }
    dialogVisible.value = false
    fetchData()
  } finally { saving.value = false }
}

async function handleDelete(row) {
  if (row.id === userStore.user?.id) return
  await ElMessageBox.confirm('确定删除该用户吗？', '提示', { type: 'warning' })
  await deleteUser(row.id)
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getUsers()
    list.value = res.data
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>
