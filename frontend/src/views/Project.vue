<template>
  <div class="project-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>楼盘管理</span>
          <el-button type="primary" size="small" @click="showAddDialog">新增楼盘</el-button>
        </div>
      </template>

      <el-table :data="projectStore.projects" v-loading="projectStore.loading" style="width: 100%">
        <el-table-column prop="name" label="楼盘名称" />
        <el-table-column prop="total_units" label="总房源" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '在售' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="当前楼盘" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.id === currentProjectId" type="success">当前</el-tag>
            <el-button v-else size="small" @click="projectStore.setCurrentProject(row.id)">切换</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteProject(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑楼盘' : '新增楼盘'" width="460px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="楼盘名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="在售" value="active" />
            <el-option label="停用" value="inactive" />
            <el-option label="售罄" value="sold_out" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProject">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import api from '../api'
import { useProjectStore } from '../store'
import { ElMessage, ElMessageBox } from 'element-plus'

const projectStore = useProjectStore()
const { currentProjectId } = storeToRefs(projectStore)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const form = ref({
  name: '',
  status: 'active',
  remark: ''
})

onMounted(projectStore.fetchProjects)

function showAddDialog() {
  isEdit.value = false
  currentId.value = null
  form.value = { name: '', status: 'active', remark: '' }
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row.id
  form.value = {
    name: row.name,
    status: row.status || 'active',
    remark: row.remark || ''
  }
  dialogVisible.value = true
}

async function saveProject() {
  try {
    if (!form.value.name) {
      ElMessage.warning('请输入楼盘名称')
      return
    }

    if (isEdit.value) {
      await api.project.update(currentId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      const res = await api.project.create(form.value)
      projectStore.setCurrentProject(res.data.id)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    await projectStore.fetchProjects()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  }
}

async function deleteProject(row) {
  try {
    await ElMessageBox.confirm(`确定删除楼盘「${row.name}」吗？`, '提示', { type: 'warning' })
    await api.project.delete(row.id)
    ElMessage.success('删除成功')
    await projectStore.fetchProjects()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}
</script>

<style scoped>
.project-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 600px) {
  .project-page {
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
