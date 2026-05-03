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
          <el-option label="入库" value="stock_in" />
          <el-option label="出库" value="stock_out" />
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
          <el-tag size="small">{{ row.table_name === 'stock_in' ? '入库' : '出库' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="record_id" label="记录ID" width="80" />
      <el-table-column prop="action" label="动作" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="actionType(row.action)">{{ actionLabel(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column prop="old_data" label="修改前" min-width="200" show-overflow-tooltip />
      <el-table-column prop="new_data" label="修改后" min-width="200" show-overflow-tooltip />
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

const list = ref([])
const total = ref(0)
const loading = ref(false)
const dateRange = ref([])
const filter = reactive({ table_name: '', action: '', page: 1, page_size: 20 })

function actionType(action) {
  return action === 'create' ? 'success' : action === 'delete' ? 'danger' : 'warning'
}

function actionLabel(action) {
  return action === 'create' ? '新增' : action === 'delete' ? '删除' : '修改'
}

function clearFilters() {
  dateRange.value = []
  filter.table_name = ''
  filter.action = ''
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

onMounted(fetchData)
</script>
