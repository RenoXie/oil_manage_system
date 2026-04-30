<template>
  <div>
    <el-card style="margin-bottom:20px">
      <el-form :inline="true" size="small">
        <el-form-item label="时间范围">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
            start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" @change="fetchAll" />
        </el-form-item>
        <el-form-item>
          <el-button @click="exportOverview">导出概览</el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="20" style="margin-bottom:20px">
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">入库总量</div>
            <div class="stat-value">{{ overview.stock_in.total_liters.toFixed(2) }} L</div>
            <div class="stat-sub">¥{{ overview.stock_in.total_amount.toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">出库总量</div>
            <div class="stat-value">{{ overview.stock_out.total_liters.toFixed(2) }} L</div>
            <div class="stat-sub">¥{{ overview.stock_out.total_amount.toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">入库记录</div>
            <div class="stat-value">{{ overview.stock_in.record_count }} 笔</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">出库记录</div>
            <div class="stat-value">{{ overview.stock_out.record_count }} 笔</div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-table :data="overview.stock_in.by_category" size="small">
            <template #empty>暂无入库数据</template>
            <el-table-column prop="name" label="入库分类" />
            <el-table-column prop="liters" label="数量(L)">
              <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额">
              <template #default="{ row }">{{ (+row.amount).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-col>
        <el-col :span="12">
          <el-table :data="overview.stock_out.by_category" size="small">
            <template #empty>暂无出库数据</template>
            <el-table-column prop="name" label="出库分类" />
            <el-table-column prop="liters" label="数量(L)">
              <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额">
              <template #default="{ row }">{{ (+row.amount).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>购买人统计排行</span>
          <el-button size="small" @click="exportBuyers">导出排行</el-button>
        </div>
      </template>
      <el-table :data="buyers.list" stripe>
        <el-table-column prop="buyer_name" label="购买人/单位" width="200" />
        <el-table-column prop="total_liters" label="购买总量(L)" sortable>
          <template #default="{ row }">{{ (+row.total_liters).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="购买金额(元)" sortable>
          <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="times" label="购买次数" sortable />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="showBuyerDetail(row.customer_id)">查看明细</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px;color:#909399">
        合计：{{ buyers.total.liters.toFixed(2) }} L / ¥{{ buyers.total.amount.toFixed(2) }} / {{ buyers.total.times }} 次
      </div>
    </el-card>

    <!-- 购买人明细弹窗 -->
    <el-dialog v-model="buyerDialog" title="购买人明细" width="700px">
      <div style="margin-bottom:12px">
        购买人：<strong>{{ buyerDetail.buyer }}</strong>
        &nbsp; 合计 {{ buyerDetail.summary.total_liters.toFixed(2) }} L / ¥{{ buyerDetail.summary.total_amount.toFixed(2) }} / {{ buyerDetail.summary.times }} 次
      </div>
      <el-table :data="buyerDetail.records" stripe size="small">
        <el-table-column prop="purchase_date" label="日期" width="120">
          <template #default="{ row }">{{ formatDate(row.purchase_date) }}</template>
        </el-table-column>
        <el-table-column prop="category_name" label="油品" width="100" />
        <el-table-column prop="plate_number" label="车辆" width="120" />
        <el-table-column prop="liters" label="数量(L)">
          <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="unit_price" label="单价" />
        <el-table-column prop="total_amount" label="金额">
          <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getOverview, getBuyer, getBuyers } from '../api/statistics'
import { formatDate } from '../utils/date'
import * as XLSX from 'xlsx'
import { exportToExcel } from '../utils/export'

const dateRange = ref([])
const overview = ref({
  stock_in: { total_liters: 0, total_amount: 0, record_count: 0, by_category: [] },
  stock_out: { total_liters: 0, total_amount: 0, record_count: 0, by_category: [] },
})
const buyers = reactive({ list: [], total: { liters: 0, amount: 0, times: 0 } })

const buyerDialog = ref(false)
const buyerDetail = reactive({
  buyer: '',
  summary: { total_liters: 0, total_amount: 0, times: 0 },
  records: [],
})

async function fetchAll() {
  const params = {}
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  const [overRes, buyerRes] = await Promise.all([
    getOverview(params),
    getBuyers(params),
  ])
  overview.value = overRes.data
  buyers.list = buyerRes.data.list
  buyers.total = buyerRes.data.total
}

async function showBuyerDetail(customer_id) {
  const params = { customer_id }
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  const res = await getBuyer(params)
  buyerDetail.buyer = res.data.buyer
  buyerDetail.summary = res.data.summary
  buyerDetail.records = res.data.records
  buyerDialog.value = true
}

function exportOverview() {
  const si = overview.value.stock_in
  const so = overview.value.stock_out
  const data = [
    { '类别': '入库', '总量(L)': si.total_liters.toFixed(2), '总金额(元)': si.total_amount.toFixed(2), '记录数': si.record_count },
    { '类别': '出库', '总量(L)': so.total_liters.toFixed(2), '总金额(元)': so.total_amount.toFixed(2), '记录数': so.record_count },
  ]
  const catData = []
  si.by_category.forEach((c) => catData.push({ '类别': `入库-${c.name}`, '总量(L)': (+c.liters).toFixed(2), '总金额(元)': (+c.amount).toFixed(2), '记录数': '' }))
  so.by_category.forEach((c) => catData.push({ '类别': `出库-${c.name}`, '总量(L)': (+c.liters).toFixed(2), '总金额(元)': (+c.amount).toFixed(2), '记录数': '' }))
  const all = [...data, {}, ...catData]
  const sheet = XLSX.utils.json_to_sheet(all)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '概览')
  XLSX.writeFile(wb, '统计概览.xlsx')
  ElMessage.success('导出成功')
}

function exportBuyers() {
  if (!buyers.list.length) { ElMessage.warning('没有数据可导出'); return }
  exportToExcel([
    { label: '购买人', key: 'buyer_name', width: 20 },
    { label: '购买总量(L)', key: 'total_liters', width: 15 },
    { label: '购买金额(元)', key: 'total_amount', width: 15 },
    { label: '购买次数', key: 'times', width: 12 },
  ], buyers.list, '购买人排行')
  ElMessage.success('导出成功')
}

onMounted(fetchAll)
</script>

<style>
.stat-card { text-align: center; }
.stat-label { font-size: 14px; color: #909399; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin: 8px 0; }
.stat-sub { font-size: 13px; color: #606266; }
</style>
