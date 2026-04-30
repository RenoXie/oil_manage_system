<template>
  <div>
    <el-card style="margin-bottom:20px">
      <template #header>车辆实时库存</template>
      <el-table :data="inventory" stripe v-loading="loading">
        <el-table-column prop="plate_number" label="车牌号" width="150" />
        <el-table-column prop="category_name" label="油品类别" width="120" />
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
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="showDetail(row.vehicle_id)">查看明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 单车明细 -->
    <el-card v-if="detail.vehicle">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>{{ detail.vehicle.plate_number }} - 进出明细</span>
          <div>
            <el-date-picker v-model="detailDate" type="daterange" range-separator="至"
              start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" size="small" />
            <el-button type="primary" size="small" style="margin-left:8px" @click="fetchDetail">查询</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom:16px">
        <el-col :span="6">
          <el-statistic title="入库总量" :value="detail.summary.total_in_liters.toFixed(2)" suffix="L" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="入库金额" :value="detail.summary.total_in_amount.toFixed(2)" prefix="¥" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="出库总量" :value="detail.summary.total_out_liters.toFixed(2)" suffix="L" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="出库金额" :value="detail.summary.total_out_amount.toFixed(2)" prefix="¥" />
        </el-col>
      </el-row>

      <el-table :data="detail.records" stripe size="small">
        <el-table-column prop="type" label="类型" width="70">
          <template #default="{ row }">
            <el-tag :type="row.type==='入库'?'success':'danger'" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="category_name" label="油品" width="100" />
        <el-table-column prop="liters" label="数量(L)">
          <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="unit_price" label="单价" width="100" />
        <el-table-column prop="total_amount" label="金额" width="120">
          <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getInventory, getVehicleDetail } from '../api/inventory'

const inventory = ref([])
const loading = ref(false)
const detailDate = ref([])
const detail = reactive({
  vehicle: null,
  records: [],
  summary: { total_in_liters: 0, total_in_amount: 0, total_out_liters: 0, total_out_amount: 0 },
})

async function fetchInventory() {
  loading.value = true
  try { const res = await getInventory(); inventory.value = res.data }
  finally { loading.value = false }
}

async function showDetail(vehicleId) {
  const params = {}
  if (detailDate.value?.length === 2) {
    params.start_date = detailDate.value[0]
    params.end_date = detailDate.value[1]
  }
  const res = await getVehicleDetail(vehicleId, params)
  detail.vehicle = res.data.vehicle
  detail.records = res.data.records
  detail.summary = res.data.summary
}

async function fetchDetail() {
  if (detail.vehicle) showDetail(detail.vehicle.id)
}

onMounted(fetchInventory)
</script>
