<template>
  <div class="unit-type-sales-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>楼栋户型销售补充</span>
          <el-button size="small" @click="loadDifferences">刷新差异</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-select v-model="statusFilter" placeholder="补充状态" clearable @change="filterDifferences">
          <el-option label="待补充" value="pending" />
          <el-option label="需核对" value="mismatch" />
          <el-option label="已补充" value="completed" />
        </el-select>
      </div>

      <el-table :data="filteredDifferences" v-loading="loading" style="width: 100%">
        <el-table-column prop="building_name" label="楼栋" width="120" />
        <el-table-column prop="sold_units" label="楼栋已售" width="100" />
        <el-table-column prop="supplemented_sold_units" label="户型补充合计" width="130" />
        <el-table-column prop="difference_units" label="差异" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.difference_units > 0, 'text-success': row.difference_units < 0 }">
              {{ row.difference_units > 0 ? `+${row.difference_units}` : row.difference_units }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openSupplement(row)">补充</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="补充户型销售" width="720px">
      <div v-if="currentDifference" class="dialog-summary">
        <el-tag>楼栋：{{ currentDifference.building_name }}</el-tag>
        <el-tag type="success">已售：{{ currentDifference.sold_units }} 套</el-tag>
        <el-tag :type="tagType(currentDifference.status)">
          当前差异：{{ currentDifference.difference_units }} 套
        </el-tag>
      </div>

      <el-table :data="supplementRows" style="width: 100%">
        <el-table-column prop="unit_type_name" label="户型" />
        <el-table-column prop="total_units" label="户型总量" width="120" />
        <el-table-column prop="unsold_units" label="剩余可售" width="120" />
        <el-table-column label="已售套数" width="180">
          <template #default="{ row }">
            <el-input-number v-model="row.sold_units" :min="0" :max="row.total_units" />
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveSupplement">保存补充</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import api from '../api'
import { useProjectStore } from '../store'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const { currentProjectId } = storeToRefs(projectStore)
const loading = ref(false)
const saving = ref(false)
const differences = ref([])
const statusFilter = ref('')
const dialogVisible = ref(false)
const currentDifference = ref(null)
const supplementRows = ref([])

const filteredDifferences = computed(() => {
  if (!statusFilter.value) return differences.value
  return differences.value.filter(item => item.status === statusFilter.value)
})

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  await loadDifferences()
})

watch(currentProjectId, loadDifferences)

async function loadDifferences() {
  if (!currentProjectId.value) return
  loading.value = true
  try {
    const res = await api.unitTypeSale.differences({
      project_id: currentProjectId.value
    })
    differences.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || '加载补充差异失败')
  } finally {
    loading.value = false
  }
}

function filterDifferences() {
  // filteredDifferences computed property handles filtering
}

async function openSupplement(row) {
  currentDifference.value = row
  supplementRows.value = (row.unit_types || []).map(item => ({
    ...item,
    sold_units: item.sold_units || 0
  }))
  dialogVisible.value = true
}

async function saveSupplement() {
  if (!currentDifference.value) return
  saving.value = true
  try {
    await api.building.update(currentDifference.value.id, {
      unit_types: supplementRows.value.map(row => ({
        unit_type_id: row.unit_type_id,
        total: row.total_units,
        sold: row.sold_units
      }))
    })
    ElMessage.success('户型销售补充已保存')
    dialogVisible.value = false
    await loadDifferences()
  } catch (err) {
    ElMessage.error(err.message || '保存补充失败')
  } finally {
    saving.value = false
  }
}

function statusLabel(status) {
  if (status === 'pending') return '待补充'
  if (status === 'mismatch') return '需核对'
  return '已补充'
}

function tagType(status) {
  if (status === 'pending') return 'warning'
  if (status === 'mismatch') return 'danger'
  return 'success'
}
</script>

<style scoped>
.unit-type-sales-page {
  padding: 20px;
}

.card-header,
.toolbar,
.dialog-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-header {
  justify-content: space-between;
}

.toolbar {
  margin-bottom: 16px;
}

.dialog-summary {
  margin-bottom: 16px;
}

.text-danger {
  color: #f56c6c;
}

.text-success {
  color: #67c23a;
}

@media (max-width: 600px) {
  .unit-type-sales-page {
    padding: 12px;
  }

  .card-header,
  .toolbar,
  .dialog-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar,
  .dialog-summary {
    margin-bottom: 12px;
  }

  .card-header .el-button {
    width: 100%;
  }

  .dialog-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .dialog-footer .el-button {
    margin-left: 0;
  }
}
</style>
