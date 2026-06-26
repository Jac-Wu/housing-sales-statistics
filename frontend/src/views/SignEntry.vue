<template>
  <div class="sign-entry-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>网签可售套数录入</span>
          <el-button size="small" @click="loadEntryRows">刷新楼栋</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-date-picker
          v-model="form.sign_date"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="loadEntryRows"
        />
        <el-tag v-if="projectStore.currentProject" type="info">
          当前楼盘：{{ projectStore.currentProject.name }}
        </el-tag>
      </div>

      <el-table :data="form.records" v-loading="loading" style="width: 100%">
        <el-table-column prop="building_name" label="楼栋" width="120" />
        <el-table-column prop="total_units" label="总房源" width="100" />
        <el-table-column prop="previous_available_units" label="前次可售" width="110" />
        <el-table-column prop="previous_sign_date" label="前次日期" width="120" />
        <el-table-column label="当日可售" width="200">
          <template #default="{ row }">
            <el-input-number v-model="row.available_units" :min="0" :max="row.total_units" />
          </template>
        </el-table-column>
        <el-table-column label="调整套数" width="200">
          <template #default="{ row }">
            <el-input-number v-model="row.adjustment_units" :min="0" />
          </template>
        </el-table-column>
        <el-table-column label="售出套数" width="110">
          <template #default="{ row }">
            <el-tag :type="derivedSold(row) < 0 ? 'danger' : 'success'">
              {{ derivedSold(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="调整原因">
          <template #default="{ row }">
            <el-input v-model="row.adjustment_reason" placeholder="可售增加时填写" />
          </template>
        </el-table-column>
      </el-table>

      <div class="actions">
        <el-button type="primary" :loading="saving" @click="submitSnapshots">保存可售快照</el-button>
      </div>
    </el-card>

    <el-card class="records-card">
      <template #header>
        <div class="card-header">
          <span>当日快照记录</span>
          <el-button size="small" @click="fetchDailyRecords">刷新</el-button>
        </div>
      </template>

      <el-table :data="dailyRecords" style="width: 100%">
        <el-table-column prop="sign_date" label="日期" width="120" />
        <el-table-column prop="building_name" label="楼栋" width="120" />
        <el-table-column prop="available_units" label="可售" width="100" />
        <el-table-column prop="adjustment_units" label="调整" width="100" />
        <el-table-column prop="derived_sold_units" label="推导售出" width="110" />
        <el-table-column prop="cumulative_sold_units" label="累计售出" width="110" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" @click="deleteRecord(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import api from '../api'
import { useProjectStore } from '../store'
import { ElMessage, ElMessageBox } from 'element-plus'

const projectStore = useProjectStore()
const { currentProjectId } = storeToRefs(projectStore)
const loading = ref(false)
const saving = ref(false)
const dailyRecords = ref([])

const form = ref({
  sign_date: new Date().toISOString().split('T')[0],
  records: []
})

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  await loadEntryRows()
})

watch(currentProjectId, async () => {
  await loadEntryRows()
})

async function loadEntryRows() {
  if (!currentProjectId.value || !form.value.sign_date) return
  loading.value = true
  try {
    const [buildingRes, dailyRes] = await Promise.all([
      api.building.list(currentProjectId.value),
      api.sign.daily(form.value.sign_date, currentProjectId.value)
    ])
    const existingByBuilding = new Map((dailyRes.data.records || []).map(record => [record.building_id, record]))
    const rows = []

    for (const building of buildingRes.data || []) {
      const previousRes = await api.sign.previous({
        building_id: building.id,
        date: form.value.sign_date
      })
      const previous = previousRes.data
      const existing = existingByBuilding.get(building.id)
      rows.push({
        building_id: building.id,
        building_name: building.name,
        total_units: building.total_units,
        previous_available_units: previous?.available_units ?? building.available_units ?? building.unsold_units ?? building.total_units,
        previous_sign_date: previous?.sign_date || '-',
        available_units: existing?.available_units ?? building.available_units ?? building.unsold_units ?? building.total_units,
        adjustment_units: existing?.adjustment_units ?? 0,
        adjustment_reason: existing?.adjustment_reason || ''
      })
    }

    form.value.records = rows
    dailyRecords.value = dailyRes.data.records || []
  } catch (err) {
    ElMessage.error(err.message || '加载楼栋快照失败')
  } finally {
    loading.value = false
  }
}

async function fetchDailyRecords() {
  if (!currentProjectId.value) return
  const res = await api.sign.daily(form.value.sign_date, currentProjectId.value)
  dailyRecords.value = res.data.records || []
}

function derivedSold(row) {
  const previous = Number(row.previous_available_units || 0)
  const adjustment = Number(row.adjustment_units || 0)
  const available = Number(row.available_units || 0)
  if (row.previous_sign_date === '-') return Math.max(Number(row.total_units || 0) - available, 0)
  return previous + adjustment - available
}

async function submitSnapshots() {
  if (!currentProjectId.value) {
    ElMessage.warning('请先选择楼盘')
    return
  }

  const invalid = form.value.records.find(row => derivedSold(row) < 0)
  if (invalid) {
    ElMessage.warning(`${invalid.building_name} 推导售出为负，请填写调整套数或核对可售套数`)
    return
  }

  saving.value = true
  try {
    await api.sign.batch({
      project_id: currentProjectId.value,
      sign_date: form.value.sign_date,
      records: form.value.records.map(row => ({
        building_id: row.building_id,
        available_units: row.available_units,
        adjustment_units: row.adjustment_units || 0,
        adjustment_reason: row.adjustment_reason || ''
      }))
    })
    ElMessage.success('可售快照保存成功')
    await loadEntryRows()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteRecord(row) {
  try {
    await ElMessageBox.confirm('确定删除该快照吗？', '提示', { type: 'warning' })
    await api.sign.delete(row.id)
    ElMessage.success('删除成功')
    await loadEntryRows()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}
</script>

<style scoped>
.sign-entry-page {
  padding: 20px;
}

.card-header,
.toolbar,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar {
  justify-content: flex-start;
  margin-bottom: 16px;
}

.actions {
  justify-content: flex-end;
  margin-top: 16px;
}

.records-card {
  margin-top: 20px;
}

@media (max-width: 600px) {
  .sign-entry-page {
    padding: 12px;
  }

  .card-header,
  .toolbar,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar {
    margin-bottom: 12px;
  }

  .actions {
    margin-top: 12px;
  }

  .actions .el-button {
    width: 100%;
  }

  .records-card {
    margin-top: 12px;
  }
}
</style>
