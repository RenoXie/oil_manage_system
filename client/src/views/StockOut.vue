<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>出库管理</span>
        <div>
          <el-button @click="handleExport">导出Excel</el-button>
          <el-button type="primary" @click="openDialog()">新增出库</el-button>
        </div>
      </div>
    </template>

    <el-form :inline="true" :model="filter" size="small">
      <el-form-item label="日期">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
          start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="客户">
        <el-select v-model="filter.customer_id" placeholder="全部" clearable filterable style="width:180px"
          :filter-method="(val) => customerFilter = val">
          <el-option v-for="c in filteredCustomers" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="车辆">
        <el-select v-model="filter.vehicle_id" placeholder="全部" clearable style="width:150px">
          <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </el-form-item>
    </el-form>

    <!-- 汇总卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总出库量(L)</div>
          <div style="font-size:22px;font-weight:600;color:#e6a23c">{{ summary.total_liters.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">总金额(元)</div>
          <div style="font-size:22px;font-weight:600;color:#e6a23c">{{ summary.total_amount.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="color:#909399;font-size:13px">记录数</div>
          <div style="font-size:22px;font-weight:600">{{ summary.record_count }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="purchase_date" label="购买日期" width="120">
        <template #default="{ row }">{{ formatDate(row.purchase_date) }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="操作时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at, true) }}</template>
      </el-table-column>
      <el-table-column prop="customer_name" label="客户" width="150" />
      <el-table-column prop="plate_number" label="出油车辆" width="120" />
      <el-table-column prop="category_name" label="油品类别" width="100" />
      <el-table-column prop="liters" label="数量(L)" width="100">
        <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="unit_price" label="单价(元/L)" width="100" />
      <el-table-column prop="total_amount" label="总金额(元)" width="120">
        <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination style="margin-top:16px;justify-content:flex-end"
      v-model:current-page="filter.page" v-model:page-size="filter.page_size"
      :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="fetchData" />

    <!-- 每日小结 -->
    <el-card shadow="never" style="margin-top:16px" v-if="dailySummary.length">
      <template #header>
        <span style="font-weight:600">每日小结</span>
      </template>
      <el-table :data="dailySummary" stripe size="small">
        <el-table-column prop="date" label="日期" width="140" />
        <el-table-column prop="liters" label="出库量(L)" width="140">
          <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额(元)" width="140">
          <template #default="{ row }">{{ (+row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="count" label="笔数" width="100" />
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑出库' : '新增出库'" width="500px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="购买日期" prop="purchase_date">
          <el-date-picker v-model="form.purchase_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="客户" prop="customer_id">
          <el-select v-model="form.customer_id" style="width:100%" filterable
            :filter-method="(val) => dialogCustomerFilter = val"
            placeholder="搜索或选择客户">
            <el-option v-for="c in dialogFilteredCustomers" :key="c.id" :label="c.name" :value="c.id" />
            <template #empty>
              <div style="padding:8px;text-align:center">
                <span style="color:#909399">无匹配客户</span>
                <el-button text type="primary" size="small" style="margin-left:8px" @click="openCustomerCreate">
                  新建客户
                </el-button>
              </div>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="出油车辆" prop="vehicle_id">
          <el-select v-model="form.vehicle_id" style="width:100%">
            <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="油品类别" prop="oil_category_id">
          <el-select v-model="form.oil_category_id" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单价(元/L)" prop="unit_price">
          <el-input-number v-model="form.unit_price" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="数量(L)" prop="liters">
          <el-input-number v-model="form.liters" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 快速新建客户弹窗 -->
    <el-dialog v-model="customerDialogVisible" title="新建客户" width="400px">
      <el-form ref="customerFormRef" :model="customerForm" :rules="customerRules" label-width="90px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="customerForm.name" placeholder="必填" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="customerForm.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="开户银行">
          <el-input v-model="customerForm.bank_name" placeholder="选填" />
        </el-form-item>
        <el-form-item label="银行账号">
          <el-input v-model="customerForm.bank_account" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customerDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="creatingCustomer" @click="handleCustomerCreate">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStockOutList, createStockOut, updateStockOut, deleteStockOut } from '../api/stockOut'
import { getVehicles } from '../api/vehicles'
import { getCategories } from '../api/categories'
import { getCustomers, createCustomer } from '../api/customers'
import { formatDate, getCurrentMonthRange } from '../utils/date'
import { exportToExcel } from '../utils/export'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const vehicles = ref([])
const categories = ref([])
const customers = ref([])
const dateRange = ref(getCurrentMonthRange())
const customerFilter = ref('')
const dialogCustomerFilter = ref('')
const dailySummary = ref([])
const summary = reactive({ total_liters: 0, total_amount: 0, record_count: 0 })
const filter = reactive({ customer_id: '', vehicle_id: '', page: 1, page_size: 20 })

const filteredCustomers = computed(() => {
  if (!customerFilter.value) return customers.value
  const kw = customerFilter.value.toLowerCase()
  return customers.value.filter((c) => c.name.toLowerCase().includes(kw))
})

const dialogFilteredCustomers = computed(() => {
  if (!dialogCustomerFilter.value) return customers.value
  const kw = dialogCustomerFilter.value.toLowerCase()
  return customers.value.filter((c) => c.name.toLowerCase().includes(kw))
})

const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({
  purchase_date: '', customer_id: '', vehicle_id: '', oil_category_id: '',
  unit_price: 0, liters: 0, remark: '',
})
const rules = {
  purchase_date: [{ required: true, message: '请选择日期' }],
  customer_id: [{ required: true, message: '请选择客户' }],
  vehicle_id: [{ required: true, message: '请选择车辆' }],
  oil_category_id: [{ required: true, message: '请选择油品' }],
  unit_price: [{ required: true, message: '请输入单价' }],
  liters: [{ required: true, message: '请输入数量' }],
}

const customerDialogVisible = ref(false)
const creatingCustomer = ref(false)
const customerFormRef = ref(null)
const customerForm = reactive({ name: '', phone: '', bank_name: '', bank_account: '' })
const customerRules = {
  name: [{ required: true, message: '请输入客户名称' }],
}

async function loadCustomers() {
  try {
    const res = await getCustomers()
    customers.value = res.data
  } catch { /* ignore */ }
}

function resetForm() {
  editId.value = null
  dialogCustomerFilter.value = ''
  Object.assign(form, { purchase_date: '', customer_id: '', vehicle_id: '', oil_category_id: '', unit_price: 0, liters: 0, remark: '' })
  formRef.value?.resetFields()
}

async function openDialog(row) {
  if (!customers.value.length) await loadCustomers()
  if (row) {
    editId.value = row.id
    Object.assign(form, {
      purchase_date: row.purchase_date,
      customer_id: row.customer_id,
      vehicle_id: row.vehicle_id,
      oil_category_id: row.oil_category_id,
      unit_price: +row.unit_price,
      liters: +row.liters,
      remark: row.remark || '',
    })
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editId.value) {
      await updateStockOut(editId.value, form)
    } else {
      await createStockOut(form)
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    saving.value = false
  }
}

async function fetchData() {
  loading.value = true
  try {
    const params = { ...filter }
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await getStockOutList(params)
    list.value = res.data.list
    total.value = res.data.total
    Object.assign(summary, res.data.summary)
    dailySummary.value = res.data.daily_summary || []
  } finally {
    loading.value = false
  }
}

async function fetchAllForExport() {
  const params = { page_size: 0 }
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  if (filter.customer_id) params.customer_id = filter.customer_id
  if (filter.vehicle_id) params.vehicle_id = filter.vehicle_id
  const res = await getStockOutList(params)
  return res.data
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定删除该出库记录吗？', '提示', { type: 'warning' })
    await deleteStockOut(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* 取消 */ }
}

async function handleExport() {
  try {
    const result = await fetchAllForExport()
    if (!result.list.length) { ElMessage.warning('没有数据可导出'); return }
    const columns = [
      { label: '购买日期', key: 'purchase_date', width: 15 },
      { label: '客户', key: 'customer_name', width: 15 },
      { label: '出油车辆', key: 'plate_number', width: 15 },
      { label: '油品类别', key: 'category_name', width: 12 },
      { label: '数量(L)', key: 'liters', width: 12 },
      { label: '单价(元/L)', key: 'unit_price', width: 12 },
      { label: '总金额(元)', key: 'total_amount', width: 12 },
      { label: '操作人', key: 'operator_name', width: 12 },
      { label: '备注', key: 'remark', width: 20 },
    ]
    // 按日期分组，插入每日小结
    const dailyMap = {}
    if (result.daily_summary) {
      for (const d of result.daily_summary) dailyMap[d.date] = d
    }
    const sorted = [...result.list].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date) || b.id - a.id)
    // 插入每日小结行
    const rowsWithSummary = []
    let prevDate = ''
    for (let i = 0; i < sorted.length; i++) {
      const date = sorted[i].purchase_date
      if (date !== prevDate && prevDate !== '') {
        const ds = dailyMap[prevDate]
        if (ds && ds.count > 1) {
          rowsWithSummary.push({
            purchase_date: `小结: ${prevDate}`,
            customer_name: '', plate_number: '', category_name: '',
            liters: +ds.liters,
            unit_price: '',
            total_amount: +ds.amount,
            operator_name: '', remark: `${ds.count}笔`,
          })
        }
      }
      rowsWithSummary.push(sorted[i])
      prevDate = date
    }
    // 最后一组的小结
    if (prevDate) {
      const ds = dailyMap[prevDate]
      if (ds && ds.count > 1) {
        rowsWithSummary.push({
          purchase_date: `小结: ${prevDate}`,
          customer_name: '', plate_number: '', category_name: '',
          liters: +ds.liters,
          unit_price: '',
          total_amount: +ds.amount,
          operator_name: '', remark: `${ds.count}笔`,
        })
      }
    }
    // 合计行
    if (result.summary) {
      rowsWithSummary.push({
        purchase_date: '合计',
        customer_name: '', plate_number: '', category_name: '',
        liters: +result.summary.total_liters,
        unit_price: '',
        total_amount: +result.summary.total_amount,
        operator_name: '', remark: `共${result.summary.record_count}笔`,
      })
    }
    let filename = '出库记录'
    if (dateRange.value?.length === 2) {
      filename += dateRange.value[0] === dateRange.value[1]
        ? `_${dateRange.value[0]}`
        : `_${dateRange.value[0]}至${dateRange.value[1]}`
    }
    exportToExcel(columns, rowsWithSummary, filename)
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}

function openCustomerCreate() {
  Object.assign(customerForm, { name: dialogCustomerFilter.value || '', phone: '', bank_name: '', bank_account: '' })
  customerDialogVisible.value = true
}

async function handleCustomerCreate() {
  const valid = await customerFormRef.value.validate().catch(() => false)
  if (!valid) return
  creatingCustomer.value = true
  try {
    const res = await createCustomer(customerForm)
    ElMessage.success('客户创建成功')
    customerDialogVisible.value = false
    await loadCustomers()
    form.customer_id = res.data.id
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '创建失败')
  } finally {
    creatingCustomer.value = false
  }
}

onMounted(async () => {
  const [v, c, cu] = await Promise.all([getVehicles(), getCategories(), getCustomers()])
  vehicles.value = v.data
  categories.value = c.data
  customers.value = cu.data
  fetchData()
})
</script>
