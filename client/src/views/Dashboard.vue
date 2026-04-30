<template>
  <div>
    <el-row :gutter="20">
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
    </el-row>

    <el-card style="margin-top:20px">
      <template #header>车辆当前库存</template>
      <el-table :data="inventory" size="small">
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
import { ref, onMounted } from 'vue'
import { getOverview } from '../api/statistics'
import { getInventory } from '../api/inventory'

const overview = ref({
  stock_in: { total_liters: 0, total_amount: 0, record_count: 0 },
  stock_out: { total_liters: 0, total_amount: 0, record_count: 0 },
})
const inventory = ref([])

function getMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const lastDay = new Date(y, m, 0).getDate() // 自动获取当月实际天数
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

onMounted(async () => {
  const { start, end } = getMonthRange()
  try {
    const [over, inv] = await Promise.all([
      getOverview({ start_date: start, end_date: end }),
      getInventory(),
    ])
    overview.value = over.data
    inventory.value = inv.data
  } catch {
    // 接口异常时保留空数据展示
  }
})
</script>

<style>
.stat-card { text-align: center; }
.stat-label { font-size: 14px; color: #909399; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin: 8px 0; }
.stat-sub { font-size: 13px; color: #606266; }
</style>
