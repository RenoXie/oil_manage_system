<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>进出明细</span>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </template>

    <el-form :inline="true" :model="filter" size="small">
      <el-form-item label="日期">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
          start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="车辆">
        <el-select v-model="filter.vehicle_id" placeholder="全部" clearable style="width:150px">
          <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="油品">
        <el-select v-model="filter.category_id" placeholder="全部" clearable style="width:150px">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总入库量(L)</div>
          <div style="font-size:22px;font-weight:600;color:#67c23a">{{ summary.total_in_liters.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总入库金额(元)</div>
          <div style="font-size:22px;font-weight:600;color:#67c23a">{{ summary.total_in_amount.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总出库量(L)</div>
          <div style="font-size:22px;font-weight:600;color:#e6a23c">{{ summary.total_out_liters.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总出库金额(元)</div>
          <div style="font-size:22px;font-weight:600;color:#e6a23c">{{ summary.total_out_amount.toFixed(2) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="date" label="日期" width="120">
        <template #default="{ row }">{{ formatDate(row.date) }}</template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === '入库' ? 'success' : 'warning'" size="small">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="plate_number" label="车牌号" width="120" />
      <el-table-column prop="category_name" label="油品类别" width="100" />
      <el-table-column prop="customer_name" label="客户" width="150">
        <template #default="{ row }">{{ row.customer_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="liters" label="数量(L)" width="100">
        <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="unit_price" label="单价(元/L)" width="100" />
      <el-table-column prop="total_amount" label="总金额(元)" width="120">
        <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
    </el-table>

    <el-pagination style="margin-top:16px;justify-content:flex-end"
      v-model:current-page="filter.page" v-model:page-size="filter.page_size"
      :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="fetchData" />
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getStockAllList } from '../api/stockAll'
import { getVehicles } from '../api/vehicles'
import { getCategories } from '../api/categories'
import { formatDate, getCurrentMonthRange } from '../utils/date'
import { exportToExcel } from '../utils/export'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const vehicles = ref([])
const categories = ref([])
const dateRange = ref(getCurrentMonthRange())
const summary = reactive({
  total_in_liters: 0,
  total_in_amount: 0,
  total_out_liters: 0,
  total_out_amount: 0,
})
const filter = reactive({ vehicle_id: '', category_id: '', page: 1, page_size: 20 })

async function fetchData() {
  loading.value = true
  try {
    const params = { ...filter }
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await getStockAllList(params)
    list.value = res.data.list
    total.value = res.data.total
    Object.assign(summary, res.data.summary)
  } finally {
    loading.value = false
  }
}

async function fetchAllForExport() {
  const params = { page: 1, page_size: 10000 }
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  if (filter.vehicle_id) params.vehicle_id = filter.vehicle_id
  if (filter.category_id) params.category_id = filter.category_id
  const res = await getStockAllList(params)
  return res.data
}

async function handleExport() {
  try {
    const result = await fetchAllForExport()
    if (!result.list.length) { ElMessage.warning('没有数据可导出'); return }
    exportToExcel([
      { label: '日期', key: 'date', width: 15 },
      { label: '类型', key: 'type', width: 8 },
      { label: '车牌号', key: 'plate_number', width: 15 },
      { label: '油品类别', key: 'category_name', width: 12 },
      { label: '客户', key: 'customer_name', width: 15 },
      { label: '数量(L)', key: 'liters', width: 12 },
      { label: '单价(元/L)', key: 'unit_price', width: 12 },
      { label: '总金额(元)', key: 'total_amount', width: 12 },
      { label: '操作人', key: 'operator_name', width: 12 },
      { label: '备注', key: 'remark', width: 20 },
    ], result.list, '进出明细', { sumColumns: ['liters', 'total_amount'] })
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}

onMounted(async () => {
  const [v, c] = await Promise.all([getVehicles(), getCategories()])
  vehicles.value = v.data
  categories.value = c.data
  fetchData()
})
</script>
