<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>需求管理</span>
        <el-button type="primary" @click="openDialog()">新增需求</el-button>
      </div>
    </template>

    <el-table :data="list" stripe>
      <template #empty><el-empty description="暂无需求记录" /></template>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '已完成' ? 'success' : row.status === '进行中' ? 'warning' : 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="90">
        <template #default="{ row }">
          <el-tag :type="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : row.priority === 'P2' ? 'primary' : 'info'" size="small">
            {{ row.priority }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="需求标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="description" label="详细描述" min-width="300" show-overflow-tooltip />
      <el-table-column prop="created_at" label="创建时间" width="160" />
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <template v-if="row.status === '待处理'">
            <el-button text type="warning" size="small" @click="changeStatus(row, '进行中')">开始处理</el-button>
          </template>
          <template v-else-if="row.status === '进行中'">
            <el-button text type="success" size="small" @click="changeStatus(row, '已完成')">标记完成</el-button>
          </template>
          <template v-else>
            <el-button text type="info" size="small" @click="changeStatus(row, '待处理')">重新打开</el-button>
          </template>
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editId != null ? '编辑需求' : '新增需求'" width="600px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="需求标题" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-select v-model="form.priority" style="width:200px">
            <el-option label="P0 紧急" value="P0" />
            <el-option label="P1 重要" value="P1" />
            <el-option label="P2 一般" value="P2" />
            <el-option label="P3 低优" value="P3" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'

const STORAGE_KEY = 'oilms_requirements'

const list = ref([])
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref(null)
const form = reactive({ title: '', priority: 'P2', description: '' })
const rules = {
  title: [{ required: true, message: '请输入需求标题' }],
}

function loadData() {
  try {
    list.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    list.value = []
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.value))
}

function formatTime() {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d} ${h}:${mi}`
}

function resetForm() {
  editId.value = null
  Object.assign(form, { title: '', priority: 'P2', description: '' })
  formRef.value?.resetFields()
}

function changeStatus(row, newStatus) {
  const item = list.value.find((x) => x.id === row.id)
  if (item) {
    item.status = newStatus
    item.updated_at = formatTime()
    saveData()
  }
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    form.title = row.title
    form.priority = row.priority
    form.description = row.description
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (editId.value != null) {
    const item = list.value.find((x) => x.id === editId.value)
    if (item) {
      item.title = form.title
      item.priority = form.priority
      item.description = form.description
      item.updated_at = formatTime()
    }
  } else {
    list.value.push({
      id: Date.now(),
      title: form.title,
      priority: form.priority,
      status: '待处理',
      description: form.description,
      created_at: formatTime(),
    })
  }
  saveData()
  dialogVisible.value = false
  loadData()
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定删除该需求吗？', '提示', { type: 'warning' })
    list.value = list.value.filter((x) => x.id !== row.id)
    saveData()
    loadData()
  } catch { /* cancel */ }
}

// 首次加载时注入示例需求
function seedDefaults() {
  if (list.value.length > 0) return
  const now = formatTime()
  list.value = [
    { id: 1, title: '并发出库超卖防护', priority: 'P2', status: '待处理', description: '高并发出库时可能出现超卖。方案：数据库事务内 SELECT ... FOR UPDATE 对库存汇总行加排他锁，读取→校验→扣减在同一事务内完成。当前暂不需要，出库不强制拦截库存。', created_at: now },
    { id: 2, title: '供应商管理', priority: 'P1', status: '已完成', description: '增加供应商表（suppliers），记录油品供应商信息。入库时非必填关联供应商。已通过 007 migration 实现。', created_at: now },
    { id: 3, title: '油品标密/温度/VCF计算', priority: 'P3', status: '待处理', description: '油品体积随温度变化。需记录标准密度、实测温度、VCF系数，自动计算标准体积 V20。当前业务不需要此精度。', created_at: now },
    { id: 4, title: '批号/批次质量管理', priority: 'P3', status: '待处理', description: '不同批次同种油品可能有不同质量指标（辛烷值、硫含量等）。需批次号追踪和质检记录。当前业务不需要。', created_at: now },
    { id: 5, title: '油品损耗/盈亏管理', priority: 'P3', status: '待处理', description: '存储和运输中的油品损耗（蒸发、泄漏）。需盘库功能（账面vs实际对比）、损耗记录、盘盈盘亏审批。当前业务不需要。', created_at: now },
    { id: 6, title: '预警通知功能', priority: 'P2', status: '待处理', description: '低库存预警（库存低于安全阈值）、大额异常出库预警、价格异常波动预警。当前业务不需要。', created_at: now },
    { id: 7, title: '计量单位换算', priority: 'P3', status: '待处理', description: '目前只有升(L)。油品行业常用吨(质量)、桶(bbl)。需密度换算支持。当前业务不需要。', created_at: now },
  ]
  saveData()
}

onMounted(() => {
  loadData()
  seedDefaults()
})
</script>
