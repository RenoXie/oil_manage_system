<template>
  <el-card>
    <template #header>
      <span>审计日志</span>
    </template>

    <el-form :inline="true" :model="filter" size="small">
      <el-form-item label="日期">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
          start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="操作表">
        <el-select v-model="filter.table_name" placeholder="全部" clearable style="width:130px">
          <el-option v-for="t in tableOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="操作人">
        <el-select v-model="filter.operator_id" placeholder="全部" clearable filterable style="width:130px">
          <el-option v-for="u in userList" :key="u.id" :label="u.real_name" :value="u.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="动作">
        <el-select v-model="filter.action" placeholder="全部" clearable style="width:100px">
          <el-option label="新增" value="create" />
          <el-option label="修改" value="update" />
          <el-option label="删除" value="delete" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchData">查询</el-button>
        <el-button @click="clearFilters">清除筛选</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="created_at" label="时间" width="160" />
      <el-table-column prop="table_name" label="操作表" width="90">
        <template #default="{ row }">
          <el-tag size="small">{{ tableLabel(row.table_name) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="record_id" label="记录ID" width="80" />
      <el-table-column prop="action" label="动作" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="actionType(row.action)">{{ actionLabel(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column label="变更详情" min-width="350">
        <template #default="{ row }">
          <div class="change-detail">
            <template v-if="getChanges(row).length">
              <div v-for="(item, i) in getChanges(row)" :key="i" class="change-field">
                <span class="field-label">{{ item.label }}</span>
                <span v-if="row.action === 'update'">
                  <span class="old-val">{{ item.old }}</span>
                  <span class="arrow">→</span>
                  <span class="new-val">{{ item.new }}</span>
                </span>
                <span v-else-if="row.action === 'create'" class="new-val">{{ item.new }}</span>
                <span v-else class="old-val">{{ item.old }}</span>
              </div>
            </template>
            <span v-else style="color:#c0c4cc">-</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination style="margin-top:16px;justify-content:center"
      v-model:current-page="filter.page" v-model:page-size="filter.page_size"
      :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next,jumper"
      @change="fetchData" />
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAuditLogs } from '../api/audit'
import { getUsers } from '../api/users'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const dateRange = ref([])
const userList = ref([])
const filter = reactive({ table_name: '', action: '', operator_id: '', page: 1, page_size: 20 })

const tableOptions = [
  { label: '入库', value: 'stock_in' },
  { label: '出库', value: 'stock_out' },
  { label: '油品类别', value: 'oil_categories' },
  { label: '客户', value: 'customers' },
  { label: '车辆', value: 'vehicles' },
  { label: '供应商', value: 'suppliers' },
  { label: '用户', value: 'users' },
]

function tableLabel(name) {
  const t = tableOptions.find((x) => x.value === name)
  return t ? t.label : name
}

const fieldLabels = {
  stock_date: '入库日期',
  purchase_date: '购买日期',
  vehicle_id: '车辆',
  oil_category_id: '油品',
  customer_id: '客户',
  price_per_liter: '单价',
  unit_price: '单价',
  liters: '数量(L)',
  total_amount: '总金额(元)',
  remark: '备注',
}

function actionType(action) {
  return action === 'create' ? 'success' : action === 'delete' ? 'danger' : 'warning'
}

function actionLabel(action) {
  return action === 'create' ? '新增' : action === 'delete' ? '删除' : '修改'
}

function parseData(data) {
  if (!data) return {}
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return {} }
  }
  return data
}

function getChanges(row) {
  const oldData = parseData(row.old_data)
  const newData = parseData(row.new_data)

  if (row.action === 'update') {
    const changes = []
    for (const key of Object.keys(newData)) {
      const oldVal = oldData[key]
      const newVal = newData[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          label: fieldLabels[key] || key,
          old: oldVal != null ? oldVal : '-',
          new: newVal != null ? newVal : '-',
        })
      }
    }
    return changes
  }

  if (row.action === 'create') {
    return Object.entries(newData).map(([key, val]) => ({
      label: fieldLabels[key] || key,
      new: val != null ? val : '-',
    }))
  }

  return Object.entries(oldData).map(([key, val]) => ({
    label: fieldLabels[key] || key,
    old: val != null ? val : '-',
  }))
}

function clearFilters() {
  dateRange.value = []
  filter.table_name = ''
  filter.action = ''
  filter.operator_id = ''
  filter.page = 1
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const params = { ...filter }
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await getAuditLogs(params)
    list.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

async function loadUsers() {
  try {
    const res = await getUsers()
    userList.value = res.data
  } catch { userList.value = [] }
}

onMounted(() => {
  loadUsers()
  fetchData()
})
</script>

<style scoped>
.change-detail { font-size: 13px; }
.change-field {
  display: flex;
  align-items: center;
  padding: 2px 0;
  gap: 6px;
}
.field-label {
  color: #909399;
  min-width: 80px;
  flex-shrink: 0;
}
.field-label::after { content: ':'; }
.old-val {
  color: #f56c6c;
  text-decoration: line-through;
  padding: 0 4px;
}
.arrow { color: #c0c4cc; }
.new-val {
  color: #67c23a;
  font-weight: 500;
  padding: 0 4px;
}
</style>
