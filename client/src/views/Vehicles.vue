<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>车辆管理</span>
        <el-button type="primary" @click="openDialog()">添加车辆</el-button>
      </div>
    </template>

    <el-table :data="list" stripe v-loading="loading">
      <template #empty><el-empty description="暂无车辆数据" /></template>
      <el-table-column prop="plate_number" label="车牌号" width="180" />
      <el-table-column prop="notes" label="备注" min-width="200" show-overflow-tooltip />
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

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑车辆' : '添加车辆'" width="450px" :before-close="beforeCloseDialog" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="车牌号" prop="plate_number">
          <el-input v-model="form.plate_number" placeholder="如 京A12345" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" />
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
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '../api/vehicles'
import { formatDate } from '../utils/date'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const originalFormJson = ref('')
const form = reactive({ plate_number: '', notes: '' })
const rules = { plate_number: [{ required: true, message: '请输入车牌号' }] }

function resetForm() {
  editId.value = null
  form.plate_number = ''
  form.notes = ''
  formRef.value?.resetFields()
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    form.plate_number = row.plate_number
    form.notes = row.notes
  }
  dialogVisible.value = true
  originalFormJson.value = JSON.stringify(form)
}

function beforeCloseDialog(done) {
  if (JSON.stringify(form) !== originalFormJson.value) {
    ElMessageBox.confirm('有未保存的修改，确定关闭吗？', '提示', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' })
      .then(() => done())
      .catch(() => {})
  } else {
    done()
  }
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editId.value) {
      await updateVehicle(editId.value, form)
    } else {
      await createVehicle(form)
    }
    dialogVisible.value = false
    fetchData()
  } finally { saving.value = false }
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确定删除该车辆吗？', '提示', { type: 'warning' })
  await deleteVehicle(row.id)
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getVehicles()
    list.value = res.data
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>
