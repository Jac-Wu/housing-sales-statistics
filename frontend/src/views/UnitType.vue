<template>
  <div class="unit-type-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>户型列表</span>
          <el-button type="primary" size="small" @click="showAddDialog">添加户型</el-button>
        </div>
      </template>
      
      <el-table :data="unitTypes" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="户型名称" width="120" />
        <el-table-column prop="room_layout" label="房型" width="140" />
        <el-table-column prop="area" label="面积" width="100" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteUnitType(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑户型' : '添加户型'" width="400px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="户型名称">
          <el-input v-model="form.name" placeholder="如：105、116、130" />
        </el-form-item>
        <el-form-item label="房型">
          <el-input v-model="form.room_layout" placeholder="如：3室2厅2卫" />
        </el-form-item>
        <el-form-item label="面积">
          <el-input-number v-model="form.area" :min="0" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUnitType">保存</el-button>
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
const unitTypes = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)

const form = ref({
  name: '',
  room_layout: '',
  area: null,
  description: ''
})

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  await fetchUnitTypes()
})

watch(currentProjectId, fetchUnitTypes)

async function fetchUnitTypes() {
  loading.value = true
  try {
    const res = await api.unitType.list(currentProjectId.value)
    unitTypes.value = res.data
  } catch (err) {
    ElMessage.error('获取户型列表失败')
  } finally {
    loading.value = false
  }
}

function showAddDialog() {
  isEdit.value = false
  currentId.value = null
  form.value = {
    name: '',
    room_layout: '',
    area: null,
    description: ''
  }
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  form.value = {
    name: row.name,
    room_layout: row.room_layout || '',
    area: row.area || null,
    description: row.description
  }
  dialogVisible.value = true
}

async function saveUnitType() {
  try {
    if (isEdit.value) {
      await api.unitType.update(currentId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await api.unitType.create({
        ...form.value,
        project_id: currentProjectId.value
      })
      ElMessage.success('创建成功')
    }
    
    dialogVisible.value = false
    await fetchUnitTypes()
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

async function deleteUnitType(row) {
  try {
    await ElMessageBox.confirm('确定删除该户型吗？相关楼栋户型数据也将被删除。', '提示', {
      type: 'warning'
    })
    await api.unitType.delete(row.id)
    ElMessage.success('删除成功')
    await fetchUnitTypes()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.unit-type-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 600px) {
  .unit-type-page {
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
