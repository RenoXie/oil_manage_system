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
          <el-tag :type="roleType(row.role)">{{ roleLabel(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限" min-width="200">
        <template #default="{ row }">
          <template v-if="row.role === 'admin'">
            <span style="color:#909399">全部权限</span>
          </template>
          <template v-else-if="row.permissions?.length">
            <el-tag v-for="p in row.permissions" :key="p" size="small" style="margin-right:4px;margin-bottom:2px">{{ permLabel(p) }}</el-tag>
          </template>
          <template v-else>
            <span style="color:#f56c6c">无权限</span>
          </template>
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

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '添加用户'" width="500px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="!!editId" />
        </el-form-item>
        <el-form-item label="姓名" prop="real_name">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%" @change="onRoleChange">
            <el-option label="管理员" value="admin" />
            <el-option label="员工" value="employee" />
            <el-option label="客户" value="customer" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码" :prop="editId ? '' : 'password'">
          <el-input v-model="form.password" :placeholder="editId ? '留空则不修改' : '请输入密码'" show-password />
        </el-form-item>
        <!-- 权限：非管理员时显示 -->
        <el-form-item v-if="form.role !== 'admin'" label="页面权限">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="p in permOptions" :key="p.key" :value="p.key" :label="p.key">{{ p.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <!-- 客户关联：客户角色时显示 -->
        <el-form-item v-if="form.role === 'customer'" label="关联客户" prop="customer_id" :rules="[{ required: true, message: '请选择关联客户' }]">
          <el-select v-model="form.customer_id" style="width:100%" filterable placeholder="选择客户">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <div style="color:#909399;font-size:12px;margin-top:4px">如无所需客户，请先到"客户管理"页面添加</div>
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
import { getCustomers } from '../api/customers'
import { formatDate } from '../utils/date'

const userStore = useUserStore()
const list = ref([])
const loading = ref(false)
const customers = ref([])
const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ username: '', real_name: '', role: 'employee', password: '', permissions: [], customer_id: null })
const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  real_name: [{ required: true, message: '请输入姓名' }],
  password: [{ required: true, message: '请输入密码' }],
}

const permOptions = [
  { key: 'dashboard', label: '首页概览' },
  { key: 'stock-in', label: '入库管理' },
  { key: 'stock-out', label: '出库管理' },
  { key: 'stock-all', label: '进出明细' },
  { key: 'inventory', label: '车辆库存' },
  { key: 'statistics', label: '统计报表' },
  { key: 'vehicles', label: '车辆管理' },
  { key: 'categories', label: '油品类别' },
  { key: 'customers', label: '客户管理' },
]
const permLabelMap = Object.fromEntries(permOptions.map((p) => [p.key, p.label]))

function permLabel(key) { return permLabelMap[key] || key }
function roleType(r) { return { admin: 'danger', employee: 'primary', customer: 'warning' }[r] || 'info' }
function roleLabel(r) { return { admin: '管理员', employee: '员工', customer: '客户' }[r] || r }

function onRoleChange() {
  if (form.role === 'admin') {
    form.permissions = []
    form.customer_id = null
  }
}

function resetForm() {
  editId.value = null
  Object.assign(form, { username: '', real_name: '', role: 'employee', password: '', permissions: [], customer_id: null })
  formRef.value?.resetFields()
}

async function openDialog(row) {
  if (!customers.value.length) {
    try { const res = await getCustomers(); customers.value = res.data } catch { /* ignore */ }
  }
  if (row) {
    editId.value = row.id
    form.username = row.username
    form.real_name = row.real_name
    form.role = row.role
    form.permissions = [...(row.permissions || [])]
    form.customer_id = row.customer_id || null
    form.password = ''
  } else {
    form.customer_id = null
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
    if (form.role !== 'admin') {
      data.permissions = form.permissions
    } else {
      data.permissions = []
    }
    if (form.role === 'customer') {
      data.customer_id = form.customer_id || null
    } else {
      data.customer_id = null
    }
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
