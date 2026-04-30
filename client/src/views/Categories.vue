<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>油品类别管理</span>
        <el-button type="primary" @click="openDialog()">添加类别</el-button>
      </div>
    </template>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="name" label="类别名称" width="200" />
      <el-table-column prop="created_at" label="创建时间" width="200">
        <template #default="{ row }">{{ formatDate(row.created_at, true) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑类别' : '添加类别'" width="400px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="类别名称" prop="name">
          <el-input v-model="form.name" placeholder="如 92#汽油" />
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
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories'
import { formatDate } from '../utils/date'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ name: '' })
const rules = { name: [{ required: true, message: '请输入类别名称' }] }

function resetForm() {
  editId.value = null
  form.name = ''
  formRef.value?.resetFields()
}

function openDialog(row) {
  if (row) { editId.value = row.id; form.name = row.name }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editId.value) { await updateCategory(editId.value, form) }
    else { await createCategory(form) }
    dialogVisible.value = false
    fetchData()
  } finally { saving.value = false }
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确定删除该类别吗？', '提示', { type: 'warning' })
  await deleteCategory(row.id)
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getCategories()
    list.value = res.data
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>
