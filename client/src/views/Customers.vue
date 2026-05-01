<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>客户管理</span>
        <el-button type="primary" @click="openDialog()">新增客户</el-button>
      </div>
    </template>

    <el-form :inline="true" :model="filter" size="small" @submit.prevent>
      <el-form-item label="搜索">
        <el-input v-model="filter.keyword" placeholder="客户名称" clearable style="width:200px" @keyup.enter="fetchData" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="name" label="客户名称" width="180" />
      <el-table-column prop="phone" label="电话" width="150" />
      <el-table-column prop="bank_name" label="开户银行" width="180" />
      <el-table-column prop="bank_account" label="银行账号" width="200" />
      <el-table-column prop="created_at" label="创建时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at, true) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑客户' : '新增客户'" width="500px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="form.name" placeholder="必填" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="开户银行">
          <el-input v-model="form.bank_name" placeholder="选填" />
        </el-form-item>
        <el-form-item label="银行账号">
          <el-input v-model="form.bank_account" placeholder="选填" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api/customers'
import { formatDate } from '../utils/date'

const list = ref([])
const loading = ref(false)
const filter = reactive({ keyword: '' })
const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ name: '', phone: '', bank_name: '', bank_account: '' })
const rules = {
  name: [{ required: true, message: '请输入客户名称' }],
}

function resetForm() {
  editId.value = null
  Object.assign(form, { name: '', phone: '', bank_name: '', bank_account: '' })
  formRef.value?.resetFields()
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    Object.assign(form, {
      name: row.name,
      phone: row.phone || '',
      bank_name: row.bank_name || '',
      bank_account: row.bank_account || '',
    })
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editId.value) {
      await updateCustomer(editId.value, form)
      ElMessage.success('更新成功')
    } else {
      await createCustomer(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  } finally {
    saving.value = false
  }
}

async function fetchData() {
  loading.value = true
  try {
    const params = {}
    if (filter.keyword) params.keyword = filter.keyword
    const res = await getCustomers(params)
    list.value = res.data
  } finally {
    loading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定删除该客户吗？', '提示', { type: 'warning' })
    await deleteCustomer(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (err) {
    if (err.response) ElMessage.error(err.response.data.msg)
  }
}

onMounted(fetchData)
</script>
