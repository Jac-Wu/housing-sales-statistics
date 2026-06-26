<template>
  <div class="building-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>楼栋列表</span>
          <el-button type="primary" size="small" @click="showAddDialog">添加楼栋</el-button>
        </div>
      </template>
      
      <el-table :data="buildings" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="楼栋名称" width="120" sortable />
        <el-table-column prop="total_units" label="总房源" width="100" sortable />
        <el-table-column prop="sold_units" label="已售" width="100" sortable />
        <el-table-column prop="available_units" label="可售" width="100" sortable />
        <el-table-column prop="today_sold_units" label="最近售出" width="120" sortable />
        <el-table-column prop="supplement_status" label="户型补充" width="120">
          <template #default="{ row }">
            <el-tag :type="getSupplementTagType(row.supplement_status)">
              {{ getSupplementLabel(row.supplement_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="de_ratio" label="去化率">
          <template #default="{ row }">
            <el-progress 
              :percentage="parseFloat(row.de_ratio)" 
              :color="getProgressColor(parseFloat(row.de_ratio))"
              :stroke-width="12"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteBuilding(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑楼栋' : '添加楼栋'" width="800px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="楼栋名称">
          <el-input v-model="form.name" placeholder="如：105、116" />
        </el-form-item>
        <el-form-item label="总房源">
          <el-input-number v-model="form.total_units" :min="0" />
        </el-form-item>
        <el-form-item label="初始已售">
          <el-input-number v-model="form.sold_units" :min="0" />
        </el-form-item>
        <el-form-item label="初始可售">
          <el-input-number v-model="form.unsold_units" :min="0" />
        </el-form-item>
        
        <el-divider content-position="left">户型结构</el-divider>
        
        <el-form-item label="户型配置">
          <div class="unit-type-config">
            <el-table :data="form.unit_types"  size="small" style="width: 100%">
              <el-table-column label="户型" min-width="150">
                <template #default="{ row, $index }">
                  <el-select v-model="row.unit_type_id" placeholder="选择户型" style="width: 100%">
                    <el-option 
                      v-for="type in unitTypes" 
                      :key="type.id" 
                      :label="type.name" 
                      :value="type.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="总数" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.total" :min="0" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="已售" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.sold" :min="0" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="可售" width="100">
                <template #default="{ row }">
                  <span>{{ (row.total || 0) - (row.sold || 0) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeUnitType($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top: 10px;">
              <el-button type="primary" size="small" @click="addUnitType">添加户型</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBuilding">保存</el-button>
      </template>
    </el-dialog>
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
const buildings = ref([])
const unitTypes = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)

const form = ref({
  name: '',
  total_units: 0,
  sold_units: 0,
  unsold_units: 0,
  unit_types: []
})

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  await fetchBuildings()
  await fetchUnitTypes()
})

watch(currentProjectId, async () => {
  await fetchBuildings()
  await fetchUnitTypes()
})

async function fetchBuildings() {
  loading.value = true
  try {
    const res = await api.building.list(currentProjectId.value)
    buildings.value = res.data
  } catch (err) {
    ElMessage.error('获取楼栋列表失败')
  } finally {
    loading.value = false
  }
}

async function fetchUnitTypes() {
  try {
    const res = await api.unitType.list(currentProjectId.value)
    unitTypes.value = res.data
  } catch (err) {
    console.error('获取户型列表失败')
  }
}

function showAddDialog() {
  isEdit.value = false
  currentId.value = null
  form.value = {
    name: '',
    total_units: 0,
    sold_units: 0,
    unsold_units: 0,
    unit_types: []
  }
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  form.value = {
    name: row.name,
    total_units: row.total_units,
    sold_units: row.sold_units,
    unsold_units: row.unsold_units,
    unit_types: row.unit_types || []
  }
  dialogVisible.value = true
  
  api.building.get(row.id).then(res => {
    if (res.data.unit_types) {
      form.value.unit_types = res.data.unit_types.map(ut => ({
        unit_type_id: ut.unit_type_id,
        total: ut.total,
        sold: ut.sold
      }))
    }
  })
}

function addUnitType() {
  form.value.unit_types.push({
    unit_type_id: null,
    total: 0,
    sold: 0
  })
}

function removeUnitType(index) {
  form.value.unit_types.splice(index, 1)
}

async function saveBuilding() {
  try {
    const data = {
      project_id: currentProjectId.value,
      name: form.value.name,
      total_units: form.value.total_units,
      sold_units: form.value.sold_units,
      unsold_units: form.value.unsold_units,
      unit_types: form.value.unit_types.filter(ut => ut.unit_type_id)
    }
    
    if (isEdit.value) {
      await api.building.update(currentId.value, data)
      ElMessage.success('更新成功')
    } else {
      await api.building.create(data)
      ElMessage.success('创建成功')
    }
    
    dialogVisible.value = false
    await fetchBuildings()
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

async function deleteBuilding(row) {
  try {
    await ElMessageBox.confirm('确定删除该楼栋吗？', '提示', {
      type: 'warning'
    })
    await api.building.delete(row.id)
    ElMessage.success('删除成功')
    await fetchBuildings()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

function getProgressColor(ratio) {
  if (ratio >= 80) return '#67c23a'
  if (ratio >= 50) return '#409eff'
  if (ratio >= 30) return '#e6a23c'
  return '#f56c6c'
}

function getSupplementLabel(status) {
  if (status === 'pending') return '待补充'
  if (status === 'mismatch') return '需核对'
  if (status === 'completed') return '已补充'
  return '无售出'
}

function getSupplementTagType(status) {
  if (status === 'pending') return 'warning'
  if (status === 'mismatch') return 'danger'
  if (status === 'completed') return 'success'
  return 'info'
}
</script>

<style scoped>
.building-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.unit-type-config {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 600px) {
  .building-page {
    padding: 12px;
  }

  .card-header {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .card-header .el-button {
    width: 100%;
  }
}
</style>
