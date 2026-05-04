<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>入库管理</span>
        <div>
          <el-button @click="handleExport">导出Excel</el-button>
          <el-button type="primary" @click="openDialog()">新增入库</el-button>
        </div>
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
      <el-form-item label="供应商">
        <el-select v-model="filter.supplier_id" placeholder="全部" clearable style="width:150px">
          <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="clearFilters">清除筛选</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" stripe v-loading="loading">
        <template #empty><el-empty description="暂无入库记录" /></template>
      <el-table-column prop="stock_date" label="入库日期" width="120">
        <template #default="{ row }">{{ formatDate(row.stock_date) }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="操作时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at, true) }}</template>
      </el-table-column>
      <el-table-column prop="plate_number" label="车牌号" width="120" />
      <el-table-column prop="category_name" label="油品类别" width="100" />
      <el-table-column prop="supplier_name" label="供应商" width="120">
        <template #default="{ row }">{{ row.supplier_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="liters" label="数量(L)" width="100">
        <template #default="{ row }">{{ (+row.liters).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="price_per_liter" label="单价(元/L)" width="100" />
      <el-table-column prop="total_amount" label="总金额(元)" width="120">
        <template #default="{ row }">{{ (+row.total_amount).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination style="margin-top:16px;justify-content:center"
      v-model:current-page="filter.page" v-model:page-size="filter.page_size"
      :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next,jumper" @change="fetchData" />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑入库' : '新增入库'" width="500px" :before-close="beforeCloseDialog" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="入库日期" prop="stock_date">
          <el-date-picker v-model="form.stock_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="车牌号" prop="vehicle_id">
          <el-select v-model="form.vehicle_id" style="width:100%">
            <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="油品类别" prop="oil_category_id">
          <el-select v-model="form.oil_category_id" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="供应商">
          <el-select v-model="form.supplier_id" style="width:100%" filterable clearable
            :filter-method="(val) => dialogSupplierFilter = val"
            placeholder="选填">
            <el-option v-for="s in dialogFilteredSuppliers" :key="s.id" :label="s.name" :value="s.id" />
            <template #empty>
              <div style="padding:8px;text-align:center">
                <span style="color:#909399">无匹配供应商</span>
                <el-button text type="primary" size="small" style="margin-left:8px" @click="openSupplierCreate">
                  新建供应商
                </el-button>
              </div>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="单价(元/L)" prop="price_per_liter">
          <el-input-number v-model="form.price_per_liter" :min="0.01" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="数量(L)" prop="liters">
          <el-input-number v-model="form.liters" :min="0.01" :precision="2" style="width:100%" />
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

    <!-- 快速新建供应商弹窗 -->
    <el-dialog v-model="supplierDialogVisible" title="新建供应商" width="400px">
      <el-form ref="supplierFormRef" :model="supplierForm" :rules="supplierRules" label-width="90px">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="supplierForm.name" placeholder="必填" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="supplierForm.contact_person" placeholder="选填" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="supplierForm.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="supplierForm.address" placeholder="选填" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="supplierForm.notes" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="supplierDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="creatingSupplier" @click="handleSupplierCreate">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStockInList, createStockIn, updateStockIn, deleteStockIn } from '../api/stockIn'
import { getVehicles } from '../api/vehicles'
import { getCategories } from '../api/categories'
import { getSuppliers, createSupplier } from '../api/suppliers'
import { formatDate, getCurrentMonthRange } from '../utils/date'
import { exportToExcel } from '../utils/export'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const vehicles = ref([])
const categories = ref([])
const suppliers = ref([])
const dialogSupplierFilter = ref('')
const dateRange = ref(getCurrentMonthRange())
const filter = reactive({ vehicle_id: '', category_id: '', supplier_id: '', page: 1, page_size: 20 })

const dialogVisible = ref(false)
const editId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const originalFormJson = ref('')
const form = reactive({
  stock_date: '', vehicle_id: '', oil_category_id: '', supplier_id: null,
  price_per_liter: 0, liters: 0, remark: '',
})
const rules = {
  stock_date: [{ required: true, message: '请选择日期' }],
  vehicle_id: [{ required: true, message: '请选择车辆' }],
  oil_category_id: [{ required: true, message: '请选择油品' }],
  price_per_liter: [{ required: true, message: '请输入单价' }],
  liters: [{ required: true, message: '请输入数量' }],
}

const dialogFilteredSuppliers = computed(() => {
  if (!dialogSupplierFilter.value) return suppliers.value
  const kw = dialogSupplierFilter.value.toLowerCase()
  return suppliers.value.filter((s) => s.name.toLowerCase().includes(kw))
})

// Supplier quick-create dialog
const supplierDialogVisible = ref(false)
const creatingSupplier = ref(false)
const supplierFormRef = ref(null)
const supplierForm = reactive({ name: '', contact_person: '', phone: '', address: '', notes: '' })
const supplierRules = {
  name: [{ required: true, message: '请输入供应商名称' }],
}

async function loadSuppliers() {
  try {
    const res = await getSuppliers()
    suppliers.value = res.data
  } catch { /* ignore */ }
}

function openSupplierCreate() {
  Object.assign(supplierForm, { name: dialogSupplierFilter.value || '', contact_person: '', phone: '', address: '', notes: '' })
  supplierDialogVisible.value = true
}

async function handleSupplierCreate() {
  const valid = await supplierFormRef.value.validate().catch(() => false)
  if (!valid) return
  creatingSupplier.value = true
  try {
    const res = await createSupplier(supplierForm)
    ElMessage.success('供应商创建成功')
    supplierDialogVisible.value = false
    await loadSuppliers()
    form.supplier_id = res.data.id
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '创建失败')
  } finally {
    creatingSupplier.value = false
  }
}

function resetForm() {
  editId.value = null
  dialogSupplierFilter.value = ''
  Object.assign(form, { stock_date: '', vehicle_id: '', oil_category_id: '', supplier_id: null, price_per_liter: 0, liters: 0, remark: '' })
  formRef.value?.resetFields()
}

async function openDialog(row) {
  if (!suppliers.value.length) await loadSuppliers()
  if (row) {
    editId.value = row.id
    Object.assign(form, {
      stock_date: row.stock_date,
      vehicle_id: row.vehicle_id,
      oil_category_id: row.oil_category_id,
      supplier_id: row.supplier_id || null,
      price_per_liter: +row.price_per_liter,
      liters: +row.liters,
      remark: row.remark || '',
    })
  }
  dialogVisible.value = true
  originalFormJson.value = JSON.stringify(form)
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editId.value) {
      await updateStockIn(editId.value, form)
    } else {
      await createStockIn(form)
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
    const res = await getStockInList(params)
    list.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  dateRange.value = getCurrentMonthRange()
  filter.vehicle_id = ''
  filter.category_id = ''
  filter.supplier_id = ''
  filter.page = 1
  fetchData()
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

async function fetchAllForExport() {
  const params = {}
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  if (filter.vehicle_id) params.vehicle_id = filter.vehicle_id
  if (filter.category_id) params.category_id = filter.category_id
  if (filter.supplier_id) params.supplier_id = filter.supplier_id
  params.page = 1
  params.page_size = 10000
  const res = await getStockInList(params)
  return res.data.list
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定删除该入库记录吗？', '提示', { type: 'warning' })
    await deleteStockIn(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* 取消 */ }
}

async function handleExport() {
  try {
    if (total.value > 5000) {
      try {
        await ElMessageBox.confirm(
          `当前查询结果共 ${total.value} 条，导出大量数据可能较慢。建议缩小日期范围后再导出。是否继续导出全部数据？`,
          '数据量较大',
          { type: 'warning', confirmButtonText: '继续导出', cancelButtonText: '取消' }
        )
      } catch { return }
    }
    const data = await fetchAllForExport()
    if (!data.length) { ElMessage.warning('没有数据可导出'); return }
    exportToExcel([
      { label: '入库日期', key: 'stock_date', width: 15 },
      { label: '车牌号', key: 'plate_number', width: 15 },
      { label: '油品类别', key: 'category_name', width: 12 },
      { label: '供应商', key: 'supplier_name', width: 15 },
      { label: '数量(L)', key: 'liters', width: 12 },
      { label: '单价(元/L)', key: 'price_per_liter', width: 12 },
      { label: '总金额(元)', key: 'total_amount', width: 12 },
      { label: '操作人', key: 'operator_name', width: 12 },
      { label: '备注', key: 'remark', width: 20 },
    ], data, '入库记录')
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}

onMounted(async () => {
  const [v, c] = await Promise.all([getVehicles(), getCategories()])
  vehicles.value = v.data
  categories.value = c.data
  try { const s = await getSuppliers(); suppliers.value = s.data } catch { /* ignore */ }
  fetchData()
})
</script>
