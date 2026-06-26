<template>
  <div class="excel-import-page">
    <el-card>
      <template #header>
        <span>Excel数据导入</span>
      </template>
      
      <el-alert type="info" :closable="false" style="margin-bottom: 20px;">
        <template #title>
          导入说明
        </template>
        支持导入楼栋数据，包括楼栋名称、总房源、已售、未售以及各户型结构数据。
        请先下载模板，按照模板格式填写数据后再上传。
      </el-alert>
      
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12">
          <el-card shadow="hover">
            <template #header>
              <span>下载导入模板</span>
            </template>
            <el-button type="primary" @click="downloadTemplate">
              <el-icon><Download /></el-icon>
              下载模板文件
            </el-button>
            <div class="template-desc">
              模板包含示例数据，可直接修改后上传
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-card shadow="hover">
            <template #header>
              <span>上传Excel文件</span>
            </template>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              accept=".xlsx,.xls"
              :on-change="handleFileChange"
              :on-exceed="handleExceed"
            >
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                选择文件
              </el-button>
              <template #tip>
                <div class="upload-tip">
                  只能上传 xlsx/xls 文件
                </div>
              </template>
            </el-upload>
            
            <el-button 
              type="success" 
              :disabled="!selectedFile"
              @click="uploadFile"
              style="margin-top: 20px;"
            >
              开始导入
            </el-button>
          </el-card>
        </el-col>
      </el-row>
      
      <el-divider />
      
      <el-card v-if="importResult" shadow="hover">
        <template #header>
          <span>导入结果</span>
        </template>
        <el-result 
          :icon="importResult.success ? 'success' : 'error'"
          :title="importResult.success ? '导入成功' : '导入失败'"
        >
          <template #sub-title>
            <div>
              成功导入 {{ importResult.imported_count }} 个楼栋
              <div v-if="importResult.buildings && importResult.buildings.length > 0">
                导入楼栋: {{ importResult.buildings.join(', ') }}
              </div>
            </div>
          </template>
          <template #extra>
            <el-button type="primary" @click="goToBuilding">查看楼栋列表</el-button>
          </template>
        </el-result>
        
        <el-alert 
          v-if="importResult.errors && importResult.errors.length > 0"
          type="warning"
          title="部分导入失败"
        >
          <ul>
            <li v-for="(err, index) in importResult.errors" :key="index">{{ err }}</li>
          </ul>
        </el-alert>
      </el-card>
    </el-card>
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>导入格式说明</span>
      </template>
      <el-table :data="formatExamples" border>
        <el-table-column prop="field" label="字段名" width="150" />
        <el-table-column prop="required" label="是否必填" width="100">
          <template #default="{ row }">
            <el-tag :type="row.required ? 'danger' : 'info'" size="small">
              {{ row.required ? '必填' : '可选' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" />
        <el-table-column prop="example" label="示例" width="150" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { ElMessage } from 'element-plus'
import { Download, Upload } from '@element-plus/icons-vue'

const router = useRouter()
const uploadRef = ref(null)
const selectedFile = ref(null)
const importResult = ref(null)

const formatExamples = ref([
  { field: '楼栋', required: true, description: '楼栋名称或编号', example: '105、116' },
  { field: '总房源', required: true, description: '该楼栋总房源数量', example: '100' },
  { field: '已售', required: true, description: '已签约数量', example: '42' },
  { field: '未售', required: true, description: '剩余未售数量', example: '58' },
  { field: '1房总数', required: false, description: '1房户型总数量', example: '20' },
  { field: '1房已售', required: false, description: '1房户型已售数量', example: '10' },
  { field: '2房总数', required: false, description: '2房户型总数量', example: '30' },
  { field: '2房已售', required: false, description: '2房户型已售数量', example: '15' },
  { field: '3房总数', required: false, description: '3房户型总数量', example: '30' },
  { field: '3房已售', required: false, description: '3房户型已售数量', example: '12' }
])

function handleFileChange(file) {
  selectedFile.value = file.raw
}

function handleExceed() {
  ElMessage.warning('只能上传一个文件')
}

function downloadTemplate() {
  window.open('/api/import/template', '_blank')
}

async function uploadFile() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  try {
    const res = await api.import.excel(selectedFile.value)
    if (res.data.code === 0) {
      importResult.value = {
        success: true,
        imported_count: res.data.data.imported_count,
        buildings: res.data.data.buildings,
        errors: res.data.data.errors
      }
      ElMessage.success('导入成功')
    } else {
      importResult.value = {
        success: false,
        imported_count: 0,
        errors: [res.data.message]
      }
      ElMessage.error('导入失败')
    }
  } catch (err) {
    importResult.value = {
      success: false,
      imported_count: 0,
      errors: [err.message]
    }
    ElMessage.error('导入失败: ' + err.message)
  }
}

function goToBuilding() {
  router.push('/building')
}
</script>

<style scoped>
.excel-import-page {
  padding: 20px;
}

.template-desc {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
}

.upload-tip {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
}

@media (max-width: 600px) {
  .excel-import-page {
    padding: 12px;
  }

  .excel-import-page :deep(.el-row) {
    row-gap: 12px;
  }

  .excel-import-page .el-button {
    width: 100%;
  }

  .template-desc,
  .upload-tip {
    line-height: 1.5;
  }
}
</style>
