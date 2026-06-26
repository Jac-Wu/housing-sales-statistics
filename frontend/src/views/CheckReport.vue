<template>
  <div class="check-report-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据校验报告</span>
          <el-button type="primary" size="small" @click="runCheck">执行校验</el-button>
        </div>
      </template>
      
      <el-row :gutter="20" class="summary-row">
        <el-col :xs="24" :sm="8">
          <el-statistic title="校验楼栋数" :value="checkResults.length" />
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic title="正常数量" :value="normalCount">
            <template #suffix>
              <el-tag type="success" size="small">正常</el-tag>
            </template>
          </el-statistic>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic title="异常数量" :value="errorCount">
            <template #suffix>
              <el-tag type="danger" size="small">异常</el-tag>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
      
      <el-divider />
      
      <el-table :data="checkResults" style="width: 100%">
        <el-table-column prop="building_name" label="楼栋" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="messages" label="校验信息">
          <template #default="{ row }">
            <div class="messages">
              <div v-for="(msg, index) in row.messages" :key="index" class="message-item">
                {{ msg }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="详情" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="showDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="detailDialogVisible" title="楼栋详情" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="楼栋名称">{{ currentDetail?.building_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentDetail?.status)">
            {{ getStatusLabel(currentDetail?.status) }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      
      <el-divider content-position="left">校验信息</el-divider>
      
      <el-alert 
        v-for="(msg, index) in currentDetail?.messages" 
        :key="index"
        :title="msg"
        :type="currentDetail?.status === 'ok' ? 'success' : (currentDetail?.status === 'error' ? 'error' : 'warning')"
        style="margin-bottom: 10px;"
        show-icon
      />
      
      <el-divider content-position="left">修复建议</el-divider>
      
      <div v-if="currentDetail?.status !== 'ok'" class="suggestions">
        <el-alert type="info" title="建议操作">
          <ul>
            <li v-if="currentDetail?.messages.includes('累计售出 + 可售套数 ≠ 总房源')">
              请检查楼栋总房源、可售快照和累计售出计算结果
            </li>
            <li v-if="currentDetail?.messages.includes('户型总量不一致')">
              请检查各户型总量是否与楼栋总房源一致
            </li>
            <li v-if="currentDetail?.messages.includes('户型数据缺失')">
              请为该楼栋配置户型结构数据
            </li>
            <li v-if="(currentDetail?.messages || []).some(msg => msg.includes('户型销售待补充'))">
              请进入户型补充页面补充该楼栋各户型售出套数
            </li>
          </ul>
        </el-alert>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import api from '../api'
import { useProjectStore } from '../store'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const { currentProjectId } = storeToRefs(projectStore)
const checkResults = ref([])
const detailDialogVisible = ref(false)
const currentDetail = ref(null)

const normalCount = computed(() => {
  return checkResults.value.filter(r => r.status === 'ok').length
})

const errorCount = computed(() => {
  return checkResults.value.filter(r => r.status !== 'ok').length
})

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  await runCheck()
})

watch(currentProjectId, runCheck)

async function runCheck() {
  try {
    const res = await api.check.project(currentProjectId.value)
    checkResults.value = res.data
    ElMessage.success('校验完成')
  } catch (err) {
    ElMessage.error('校验失败')
  }
}

function showDetail(row) {
  currentDetail.value = row
  detailDialogVisible.value = true
}

function getStatusType(status) {
  if (status === 'ok') return 'success'
  if (status === 'warning') return 'warning'
  return 'danger'
}

function getStatusLabel(status) {
  if (status === 'ok') return '正常'
  if (status === 'warning') return '警告'
  return '异常'
}
</script>

<style scoped>
.check-report-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-row {
  margin-bottom: 20px;
}

.messages {
  line-height: 1.8;
}

.message-item {
  padding: 2px 0;
}

.suggestions ul {
  margin: 10px 0;
  padding-left: 20px;
}

.suggestions li {
  margin: 5px 0;
}

@media (max-width: 600px) {
  .check-report-page {
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

  .summary-row {
    margin-bottom: 12px;
  }

  .summary-row .el-col {
    margin-bottom: 12px;
  }

  .messages {
    line-height: 1.6;
  }
}
</style>
