<template>
  <div class="statistics-page">
    <section class="page-header">
      <div>
        <div class="eyebrow">统计分析</div>
        <h1>销售表现与趋势</h1>
        <p>楼栋去化、户型结构和周期销售变化</p>
      </div>
    </section>

    <el-row :gutter="18">
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>楼栋去化率对比</span>
          </template>
          <div ref="buildingChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>户型结构分析</span>
          </template>
          <div ref="unitTypeChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>销售进度</span>
          </template>
          <div ref="progressChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="18" class="content-row">
      <el-col :span="24">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header trend-header">
              <span>销售趋势</span>
              <div class="filter-group">
                <el-date-picker 
                  v-model="dateRange" 
                  type="daterange" 
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  @change="fetchTrendData"
                />
                <el-select v-model="selectedBuilding" placeholder="选择楼栋" clearable @change="fetchTrendData">
                  <el-option 
                    v-for="b in buildings" 
                    :key="b.id" 
                    :label="b.name" 
                    :value="b.id"
                  />
                </el-select>
              </div>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container trend-chart"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="18" class="content-row">
      <el-col :span="24">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>楼栋户型销售矩阵</span>
              <el-select 
                v-model="matrixBuildingFilter" 
                class="matrix-filter"
                placeholder="筛选楼栋" 
                clearable 
                size="small"
                @change="fetchMatrixData"
              >
                <el-option 
                  v-for="b in buildings" 
                  :key="b.id" 
                  :label="b.name" 
                  :value="b.id"
                />
              </el-select>
            </div>
          </template>
          <el-table 
            :data="matrixTableData" 
            v-loading="matrixLoading"
            style="width: 100%"
            border
            size="small"
          >
            <el-table-column prop="buildingName" label="楼栋" width="100" fixed />
            <el-table-column 
              v-for="ut in matrixUnitTypes" 
              :key="ut.id" 
              :label="ut.name"
              min-width="120"
            >
              <template #default="{ row }">
                <div v-if="row[ut.id]" class="matrix-cell">
                  <div class="matrix-sold">{{ row[ut.id].sold }}/{{ row[ut.id].total }}</div>
                  <el-progress 
                    :percentage="row[ut.id].de_ratio_value" 
                    :color="getProgressColor(row[ut.id].de_ratio_value)"
                    :stroke-width="6"
                    :show-text="false"
                  />
                  <div class="matrix-ratio">{{ row[ut.id].de_ratio }}</div>
                </div>
                <div v-else class="matrix-empty">-</div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="18" class="content-row">
      <el-col :span="24">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>楼栋详情统计</span>
          </template>
          <el-table :data="buildingStats" style="width: 100%">
            <el-table-column prop="name" label="楼栋" width="120" />
            <el-table-column prop="total_units" label="总房源" width="100" />
            <el-table-column prop="sold_units" label="已售" width="100" />
            <el-table-column prop="available_units" label="可售" width="100" />
            <el-table-column prop="de_ratio" label="去化率" width="120" />
            <el-table-column label="进度">
              <template #default="{ row }">
                <el-progress 
                  :percentage="ratioValue(row)" 
                  :color="getProgressColor(ratioValue(row))"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import api from '../api'
import { useProjectStore } from '../store'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const { currentProjectId } = storeToRefs(projectStore)
const buildings = ref([])
const buildingStats = ref([])
const unitTypeStats = ref([])
const dateRange = ref([])
const selectedBuilding = ref(null)

// 楼栋户型矩阵数据
const matrixBuildingFilter = ref(null)
const matrixLoading = ref(false)
const matrixBuildings = ref([])
const matrixUnitTypes = ref([])
const matrixData = ref({})

const matrixTableData = computed(() => {
  return matrixBuildings.value.map(building => {
    const row = { buildingId: building.id, buildingName: building.name }
    for (const ut of matrixUnitTypes.value) {
      const key = `${building.id}-${ut.id}`
      row[ut.id] = matrixData.value[key] || null
    }
    return row
  })
})

// 设置默认日期范围为最近30天
function setDefaultDateRange() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  dateRange.value = [
    thirtyDaysAgo.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10)
  ]
}

const buildingChartRef = ref(null)
const unitTypeChartRef = ref(null)
const progressChartRef = ref(null)
const trendChartRef = ref(null)

let buildingChart = null
let unitTypeChart = null
let progressChart = null
let trendChart = null

onMounted(async () => {
  if (!currentProjectId.value) {
    await projectStore.fetchProjects()
  }
  setDefaultDateRange()
  await fetchBuildings()
  await fetchStats()
  await fetchMatrixData()
  await nextTick()
  initCharts()
  updateCharts()
  await fetchTrendData()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  buildingChart?.dispose()
  unitTypeChart?.dispose()
  progressChart?.dispose()
  trendChart?.dispose()
})

watch(currentProjectId, async () => {
  selectedBuilding.value = null
  matrixBuildingFilter.value = null
  await fetchBuildings()
  await fetchStats()
  await fetchMatrixData()
  await nextTick()
  updateCharts()
  await fetchTrendData()
})

const chartColors = ['#2563eb', '#0f9f8f', '#d97706', '#7c3aed', '#dc2626', '#0891b2']
const tooltipStyle = {
  backgroundColor: 'rgba(23, 32, 51, 0.92)',
  borderColor: 'transparent',
  borderRadius: 8,
  padding: [10, 12],
  textStyle: {
    color: '#fff',
    fontSize: 12
  }
}

const buildingChartData = computed(() => {
  return (buildingStats.value || []).map(item => ({
    name: item.name,
    value: ratioValue(item),
    sold: Number(item.sold_units || 0),
    available: Number(item.available_units || 0)
  }))
})

const unitTypeChartData = computed(() => {
  return (unitTypeStats.value || [])
    .map(item => ({
      name: item.name,
      value: Number.parseInt(item.sold_units || item.sold, 10) || 0
    }))
    .filter(item => item.value > 0)
})

async function fetchBuildings() {
  try {
    const res = await api.building.list(currentProjectId.value)
    buildings.value = res.data
  } catch (err) {
    console.error('获取楼栋失败')
  }
}

async function fetchStats() {
  try {
    const buildingRes = await api.stat.building({ project_id: currentProjectId.value })
    buildingStats.value = buildingRes.data
    
    const unitTypeRes = await api.stat.unitType({ project_id: currentProjectId.value })
    unitTypeStats.value = unitTypeRes.data
  } catch (err) {
    ElMessage.error('获取统计数据失败')
  }
}

async function fetchTrendData() {
  let params = { project_id: currentProjectId.value }
  if (dateRange.value && dateRange.value.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  if (selectedBuilding.value) {
    params.building_id = selectedBuilding.value
  }
  
  try {
    const res = await api.stat.trend(params)
    updateTrendChart(res.data)
  } catch (err) {
    console.error('获取趋势数据失败')
  }
}

async function fetchMatrixData() {
  if (!currentProjectId.value) return
  matrixLoading.value = true
  try {
    const params = { project_id: currentProjectId.value }
    if (matrixBuildingFilter.value) {
      params.building_id = matrixBuildingFilter.value
    }
    const res = await api.stat.buildingUnitTypeMatrix(params)
    matrixBuildings.value = res.data.buildings || []
    matrixUnitTypes.value = res.data.unit_types || []
    matrixData.value = res.data.matrix || {}
  } catch (err) {
    console.error('获取矩阵数据失败')
  } finally {
    matrixLoading.value = false
  }
}

function initCharts() {
  if (buildingChartRef.value) {
    buildingChart = echarts.init(buildingChartRef.value, null, { renderer: 'canvas' })
  }
  if (unitTypeChartRef.value) {
    unitTypeChart = echarts.init(unitTypeChartRef.value, null, { renderer: 'canvas' })
  }
  if (progressChartRef.value) {
    progressChart = echarts.init(progressChartRef.value, null, { renderer: 'canvas' })
  }
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value, null, { renderer: 'canvas' })
  }
}

function updateCharts() {
  updateBuildingChart()
  updateUnitTypeChart()
  updateProgressChart()
}

function updateBuildingChart() {
  if (!buildingChart) return
  if (buildingChartData.value.length === 0) {
    setEmptyChart(buildingChart, '暂无楼栋数据')
    return
  }

  const ranking = [...buildingChartData.value]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
  
  buildingChart.setOption({
    color: chartColors,
    grid: { top: 0, right: 30, bottom: 10, left: 10, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(37, 99, 235, 0.08)' } },
      ...tooltipStyle,
      formatter: (params) => {
        const item = params[0]?.data
        return `${item.name}<br/>去化率：${item.value}%<br/>已售：${item.sold} 套<br/>可售：${item.available} 套`
      }
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#667085' },
      splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: ranking.map(item => item.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#667085',
        width: 54,
        overflow: 'truncate'
      }
    },
    series: [{
      name: '去化率',
      type: 'bar',
      data: ranking,
      barMaxWidth: 16,
      showBackground: true,
      backgroundStyle: { color: '#f1f5f9', borderRadius: [0, 8, 8, 0] },
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: (params) => getProgressColor(params.value)
      },
      label: {
        show: true,
        position: 'right',
        color: '#4b5565',
        fontWeight: 700,
        formatter: '{c}%'
      }
    }]
  }, true)
}

function updateUnitTypeChart() {
  if (!unitTypeChart) return
  if (unitTypeChartData.value.length === 0) {
    setEmptyChart(unitTypeChart, '暂无户型数据')
    return
  }
  
  unitTypeChart.setOption({
    color: chartColors,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: '{b}<br/>已售：{c} 套<br/>占比：{d}%'
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#667085' }
    },
    series: [{
      type: 'pie',
      radius: ['48%', '70%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 3
      },
      label: {
        color: '#4b5565',
        formatter: '{b}\n{d}%'
      },
      data: unitTypeChartData.value
    }]
  }, true)
}

function updateProgressChart() {
  if (!progressChart) return
  if (buildingStats.value.length === 0) {
    setEmptyChart(progressChart, '暂无进度数据')
    return
  }
  
  const totalUnits = buildingStats.value.reduce((sum, b) => sum + b.total_units, 0)
  const totalSold = buildingStats.value.reduce((sum, b) => sum + b.sold_units, 0)
  const availableUnits = Math.max(totalUnits - totalSold, 0)
  const ratio = totalUnits > 0 ? (totalSold / totalUnits * 100).toFixed(1) : '0.0'
  
  progressChart.setOption({
    color: ['#16a34a', '#d97706'],
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: '{b}<br/>{c} 套<br/>占比：{d}%'
    },
    series: [{
      type: 'pie',
      radius: ['54%', '74%'],
      center: ['50%', '48%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 3
      },
      label: {
        show: true,
        position: 'center',
        formatter: () => `{label|去化率}\n{value|${ratio}%}`,
        rich: {
          label: {
            color: '#8491a5',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 24
          },
          value: {
            color: '#172033',
            fontSize: 24,
            fontWeight: 850,
            lineHeight: 32
          }
        }
      },
      data: [
        { name: '已售', value: totalSold },
        { name: '可售', value: availableUnits }
      ]
    }]
  }, true)
}

function updateTrendChart(data) {
  if (!trendChart) return
  const rows = data || []
  if (rows.length === 0) {
    setEmptyChart(trendChart, '暂无趋势数据')
    return
  }
  
  trendChart.setOption({
    color: ['#2563eb', '#0f9f8f'],
    grid: { top: 58, right: 46, bottom: 38, left: 42, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#172033' } },
      ...tooltipStyle
    },
    legend: {
      top: 8,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#667085' },
      data: ['日售出', '累计售出']
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: rows.map(d => d.sign_date),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e6ebf2' } },
      axisLabel: { color: '#667085' }
    },
    yAxis: [
      {
        type: 'value',
        name: '日售出',
        nameTextStyle: { color: '#667085' },
        axisLabel: { color: '#667085' },
        splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } }
      },
      {
        type: 'value',
        name: '累计售出',
        nameTextStyle: { color: '#667085' },
        axisLabel: { color: '#667085' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '日售出',
        type: 'bar',
        data: rows.map(d => d.daily_sold_units),
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#2563eb' },
            { offset: 1, color: '#60a5fa' }
          ])
        }
      },
      {
        name: '累计售出',
        type: 'line',
        yAxisIndex: 1,
        data: rows.map(d => d.cumulative_sold_units),
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(15, 159, 143, 0.20)' },
            { offset: 1, color: 'rgba(15, 159, 143, 0.00)' }
          ])
        }
      }
    ]
  }, true)
}

function getProgressColor(ratio) {
  if (ratio >= 80) return '#16a34a'
  if (ratio >= 50) return '#2563eb'
  if (ratio >= 30) return '#d97706'
  return '#dc2626'
}

function resizeCharts() {
  buildingChart?.resize()
  unitTypeChart?.resize()
  progressChart?.resize()
  trendChart?.resize()
}

function setEmptyChart(chart, text) {
  chart.clear()
  chart.setOption({
    title: {
      text,
      left: 'center',
      top: 'middle',
      textStyle: {
        color: '#98a2b3',
        fontSize: 14,
        fontWeight: 500
      }
    }
  })
}

function ratioValue(row) {
  const value = row?.de_ratio_value ?? row?.de_ratio ?? 0
  const ratio = typeof value === 'string' ? Number.parseFloat(value.replace('%', '')) : Number(value)
  return Number.isFinite(ratio) ? Math.min(Math.max(Number(ratio.toFixed(1)), 0), 100) : 0
}

watch([buildingStats, unitTypeStats], async () => {
  await nextTick()
  updateCharts()
}, { deep: true })
</script>

<style scoped>
.statistics-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 20px;
}

.eyebrow {
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
}

.page-header h1 {
  margin-top: 6px;
  color: var(--text-main);
  font-size: 28px;
  line-height: 1.25;
}

.page-header p {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 14px;
}

.chart-container {
  height: 320px;
}

.chart-card {
  min-height: 100%;
}

.trend-chart {
  height: 420px;
}

.content-row {
  margin-top: 18px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-group :deep(.el-date-editor) {
  width: 280px;
}

.filter-group :deep(.el-select) {
  width: 160px;
}

.matrix-filter {
  width: 200px;
}

@media (max-width: 900px) {
  .statistics-page {
    padding: 16px;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .trend-header {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-group {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-group :deep(.el-date-editor),
  .filter-group :deep(.el-select) {
    width: 100%;
  }

  .matrix-filter {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .statistics-page {
    padding: 12px;
  }

  .page-header {
    margin-bottom: 14px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .page-header p {
    font-size: 13px;
  }

  .chart-container {
    height: 280px;
  }

  .trend-chart {
    height: 340px;
  }

  .content-row {
    margin-top: 12px;
  }

  .card-header {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }
}

.matrix-cell {
  padding: 4px 0;
  text-align: center;
}

.matrix-sold {
  font-size: 13px;
  font-weight: 600;
  color: #172033;
  margin-bottom: 4px;
}

.matrix-ratio {
  font-size: 11px;
  color: #667085;
  margin-top: 2px;
}

.matrix-empty {
  color: #98a2b3;
  font-size: 13px;
  text-align: center;
}
</style>
