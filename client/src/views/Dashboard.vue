<template>
  <div>
    <el-row :gutter="20" v-loading="loading">
      <template v-if="loading">
        <el-col v-for="n in (isCustomer ? 2 : 4)" :key="n" :span="6">
          <el-card shadow="hover" class="stat-card">
            <el-skeleton :rows="3" animated />
          </el-card>
        </el-col>
      </template>
      <template v-else-if="!isCustomer">
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">本月入库总量</div>
            <div class="stat-value">{{ (overview.stock_in?.total_liters || 0).toFixed(2) }} L</div>
            <div class="stat-sub">金额 ¥{{ (overview.stock_in?.total_amount || 0).toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">本月出库总量</div>
            <div class="stat-value">{{ (overview.stock_out?.total_liters || 0).toFixed(2) }} L</div>
            <div class="stat-sub">金额 ¥{{ (overview.stock_out?.total_amount || 0).toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">入库记录数</div>
            <div class="stat-value">{{ overview.stock_in?.record_count || 0 }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">出库记录数</div>
            <div class="stat-value">{{ overview.stock_out?.record_count || 0 }}</div>
          </el-card>
        </el-col>
      </template>
      <template v-else>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">本月出库总量</div>
            <div class="stat-value">{{ (overview.stock_out?.total_liters || 0).toFixed(2) }} L</div>
            <div class="stat-sub">金额 ¥{{ (overview.stock_out?.total_amount || 0).toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">出库记录数</div>
            <div class="stat-value">{{ overview.stock_out?.record_count || 0 }}</div>
          </el-card>
        </el-col>
      </template>
    </el-row>

    <el-card v-if="isCustomer && dailyChartData.length" style="margin-top:20px">
      <template #header>本月出库趋势</template>
      <div ref="chartRef" style="height:300px"></div>
    </el-card>

    <el-card v-if="!isCustomer" style="margin-top:20px" v-loading="loading">
      <template #header>车辆当前库存</template>
      <el-table :data="inventory" size="small">
        <template #empty><el-empty description="暂无库存数据" /></template>
        <el-table-column prop="plate_number" label="车牌号" />
        <el-table-column prop="category_name" label="油品类别" />
        <el-table-column prop="total_in" label="总入库(L)">
          <template #default="{ row }">{{ (+row.total_in).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="total_out" label="总出库(L)">
          <template #default="{ row }">{{ (+row.total_out).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="remaining" label="剩余量(L)">
          <template #default="{ row }">
            <el-tag :type="+row.remaining > 0 ? 'success' : +row.remaining < 0 ? 'danger' : 'warning'">
              {{ (+row.remaining).toFixed(2) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getOverview } from '../api/statistics'
import { getInventory } from '../api/inventory'
import { getStockOutList } from '../api/stockOut'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const isCustomer = computed(() => userStore.user?.role === 'customer')

const loading = ref(true)
const overview = ref({
  stock_in: { total_liters: 0, total_amount: 0, record_count: 0 },
  stock_out: { total_liters: 0, total_amount: 0, record_count: 0 },
})
const inventory = ref([])
const dailyChartData = ref([])
const chartRef = ref(null)
let chartInstance = null

function getMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const lastDay = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function renderChart() {
  if (!chartRef.value || !dailyChartData.value.length) return
  if (!chartInstance) chartInstance = echarts.init(chartRef.value)
  const dates = dailyChartData.value.map((d) => d.date)
  const liters = dailyChartData.value.map((d) => +d.liters)
  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: 'L' },
    series: [{ name: '出库量', type: 'line', data: liters, smooth: true, areaStyle: { opacity: 0.15 } }],
  })
}

onMounted(async () => {
  const { start, end } = getMonthRange()
  try {
    const promises = [getOverview({ start_date: start, end_date: end })]
    if (!isCustomer.value) {
      promises.push(getInventory())
    } else {
      promises.push(getStockOutList({ start_date: start, end_date: end, page_size: 0 }))
    }
    const results = await Promise.all(promises)
    overview.value = results[0].data
    if (!isCustomer.value) {
      inventory.value = results[1].data
    } else {
      dailyChartData.value = results[1].data.daily_summary || []
      await nextTick()
      renderChart()
    }
  } catch (err) {
    console.error('Dashboard fetch failed:', err)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style>
.stat-card { text-align: center; }
.stat-label { font-size: 14px; color: #909399; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin: 8px 0; }
.stat-sub { font-size: 13px; color: #606266; }
</style>
