<template>
  <div class="dashboard-page" v-loading="loading">
    <section class="page-header">
      <div>
        <div class="eyebrow">数据总览</div>
        <h1>{{ currentProject?.name || '楼盘销售概览' }}</h1>
        <p>当前项目供应、去化和户型销售结构</p>
      </div>
      <div class="header-metric">
        <span>待补充楼栋</span>
        <strong>{{ pendingSupplementCount }}</strong>
      </div>
    </section>

    <el-row :gutter="18" class="stat-cards">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card class="stat-card total" shadow="never">
          <div class="stat-top">
            <span class="stat-title">总房源</span>
            <span class="stat-icon">总</span>
          </div>
          <div class="stat-value">{{ formatNumber(totalUnits) }}</div>
          <div class="stat-caption">项目供应总量</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card class="stat-card sold" shadow="never">
          <div class="stat-top">
            <span class="stat-title">已售</span>
            <span class="stat-icon">售</span>
          </div>
          <div class="stat-value">{{ formatNumber(totalSold) }}</div>
          <div class="stat-caption">累计成交套数</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card class="stat-card available" shadow="never">
          <div class="stat-top">
            <span class="stat-title">可售</span>
            <span class="stat-icon">余</span>
          </div>
          <div class="stat-value">{{ formatNumber(totalUnsold) }}</div>
          <div class="stat-caption">当前可售库存</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card class="stat-card ratio" shadow="never">
          <div class="stat-top">
            <span class="stat-title">去化率</span>
            <span class="stat-icon">率</span>
          </div>
          <div class="stat-value">{{ deRatio }}</div>
          <div class="stat-caption">已售 / 总房源</div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="18" class="content-row">
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card today-card" shadow="never">
          <template #header>
            <span>昨日售出</span>
          </template>
          <div class="today-card-inner">
            <div class="today-ring">
              <div class="sign-value">{{ todaySold }}</div>
              <div class="sign-unit">套</div>
            </div>
            <div class="today-copy">
              <strong>最近网签结果</strong>
              <span>需补充 {{ pendingSupplementCount }} 栋户型销售明细</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="16">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>楼栋去化率排名</span>
          </template>
          <div ref="barChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="18" class="content-row">
      <el-col :xs="24" :lg="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>楼栋销售详情</span>
          </template>
          <el-table :data="buildingRanking" style="width: 100%" max-height="320">
            <el-table-column prop="name" label="楼栋" width="60" />
            <el-table-column prop="total_units" label="总房源" width="80" />
            <el-table-column prop="sold_units" label="已售" width="80" />
            <el-table-column prop="available_units" label="可售" width="80" />
            <el-table-column prop="today_sold_units" label="最近售出" width="90" />
            <el-table-column prop="de_ratio" label="去化率">
              <template #default="{ row }">
                <div class="ratio-cell">
                  <el-progress
                    :percentage="ratioValue(row)"
                    :color="getProgressColor(ratioValue(row))"
                    :stroke-width="8"
                    :show-text="false"
                  />
                  <span>{{ row.de_ratio }}</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span>户型结构分析</span>
          </template>
          <div ref="pieChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useDashboardStore, useProjectStore } from '../store'

const dashboardStore = useDashboardStore()
const projectStore = useProjectStore()
const {
  totalUnits,
  totalSold,
  totalUnsold,
  deRatio,
  todaySold,
  pendingSupplementCount,
  buildingRanking,
  unitTypeStats,
  loading
} = storeToRefs(dashboardStore)
const { currentProjectId, currentProject } = storeToRefs(projectStore)

const barChartRef = ref(null)
const pieChartRef = ref(null)
let barChart = null
let pieChart = null

onMounted(async () => {
  await dashboardStore.fetchDashboard(currentProjectId.value)
  await nextTick()
  initCharts()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  barChart?.dispose()
  pieChart?.dispose()
})

watch(currentProjectId, async (projectId) => {
  await dashboardStore.fetchDashboard(projectId)
  await nextTick()
  updateCharts()
})

watch([buildingRanking, unitTypeStats], async () => {
  await nextTick()
  updateCharts()
}, { deep: true })

const barData = computed(() => {
  return (buildingRanking.value || []).map(item => ({
    name: item.name,
    value: ratioValue(item),
    sold: Number(item.sold_units || 0),
    available: Number(item.available_units || 0)
  }))
})

const pieData = computed(() => {
  return (unitTypeStats.value || [])
    .map(item => ({
      name: item.name,
      value: Number.parseInt(item.sold_units || item.sold, 10) || 0
    }))
    .filter(item => item.value > 0)
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

function initCharts() {
  if (barChartRef.value) {
    barChart = echarts.init(barChartRef.value, null, { renderer: 'canvas' })
  }
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value, null, { renderer: 'canvas' })
  }
  updateCharts()
}

function updateCharts() {
  if (barChart) {
    if (barData.value.length === 0) {
      setEmptyChart(barChart, '暂无楼栋数据')
    } else {
    barChart.setOption({
      color: chartColors,
      grid: { top: 10, right: 0, bottom: 10, left: 0, containLabel: true },
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
        type: 'category',
        data: barData.value.map(item => item.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6ebf2' } },
        axisLabel: {
          color: '#667085',
          interval: 0,
          // hideOverlap: true,
          // width: 58,
          overflow: 'truncate'
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%', color: '#667085' },
        splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } }
      },
      series: [{
        name: '去化率',
        type: 'bar',
        data: barData.value,
        barMaxWidth: "25%",
        showBackground: true,
        backgroundStyle: { color: '#f1f5f9', borderRadius: [8, 8, 0, 0] },
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#2563eb' },
            { offset: 1, color: '#0f9f8f' }
          ])
        },
        label: {
          show: barData.value.length <= 12,
          position: 'top',
          color: '#4b5565',
          fontWeight: 700,
          formatter: '{c}%'
        }
      }]
    }, true)
    }
  }
  
  if (pieChart) {
    if (pieData.value.length === 0) {
      setEmptyChart(pieChart, '暂无户型数据')
    } else {
    pieChart.setOption({
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
        data: pieData.value
      }]
    }, true)
    }
  }
}

function resizeCharts() {
  barChart?.resize()
  pieChart?.resize()
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

function getProgressColor(ratio) {
  if (ratio >= 80) return '#16a34a'
  if (ratio >= 50) return '#2563eb'
  if (ratio >= 30) return '#d97706'
  return '#dc2626'
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}
</script>

<style scoped>
.dashboard-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
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

.header-metric {
  min-width: 148px;
  padding: 14px 16px;
  border: 1px solid rgba(230, 235, 242, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--shadow-soft);
}

.header-metric span {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.header-metric strong {
  display: block;
  margin-top: 6px;
  color: var(--text-main);
  font-size: 28px;
  line-height: 1;
}

.stat-cards {
  margin-bottom: 18px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  min-height: 148px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
}

.stat-card::before {
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  content: "";
  background: var(--accent);
}

.stat-card.total {
  --accent: linear-gradient(90deg, #2563eb, #60a5fa);
}

.stat-card.sold {
  --accent: linear-gradient(90deg, #16a34a, #5eead4);
}

.stat-card.available {
  --accent: linear-gradient(90deg, #d97706, #fbbf24);
}

.stat-card.ratio {
  --accent: linear-gradient(90deg, #7c3aed, #2563eb);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-title {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 700;
}

.stat-icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  background: var(--accent);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}

.stat-value {
  margin-top: 22px;
  color: var(--text-main);
  font-size: 34px;
  font-weight: 850;
  line-height: 1;
}

.stat-caption {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.chart-card {
  min-height: 100%;
}

.content-row {
  margin-top: 18px;
}

.today-card :deep(.el-card__body) {
  height: 330px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.chart-container {
  height: 320px;
}

.today-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
}

.today-ring {
  width: 168px;
  height: 168px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #fff 0 58%, transparent 59%),
    conic-gradient(from -60deg, #16a34a, #0f9f8f, #2563eb, #16a34a);
  box-shadow: 0 18px 42px rgba(15, 159, 143, 0.15);
}

.sign-value {
  color: var(--text-main);
  font-size: 48px;
  font-weight: 850;
  line-height: 1;
}

.sign-unit {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 700;
}

.today-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.today-copy strong {
  color: var(--text-main);
}

.today-copy span {
  color: var(--text-muted);
  font-size: 13px;
}

.ratio-cell {
  display: grid;
  grid-template-columns: minmax(88px, 1fr) 68px;
  align-items: center;
  gap: 10px;
  color: var(--text-regular);
  font-weight: 700;
}

@media (max-width: 900px) {
  .dashboard-page {
    padding: 16px;
  }

  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .today-card :deep(.el-card__body) {
    height: auto;
    min-height: 300px;
  }
}

@media (max-width: 600px) {
  .dashboard-page {
    padding: 12px;
  }

  .page-header {
    gap: 12px;
    margin-bottom: 14px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .page-header p {
    font-size: 13px;
  }

  .header-metric {
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
  }

  .header-metric strong {
    font-size: 24px;
  }

  .stat-cards,
  .content-row {
    margin-bottom: 0;
    margin-top: 12px;
  }

  .stat-card {
    min-height: 126px;
  }

  .stat-value {
    margin-top: 18px;
    font-size: 30px;
  }

  .chart-container {
    height: 280px;
  }

  .today-card :deep(.el-card__body) {
    min-height: 260px;
  }

  .today-ring {
    width: 136px;
    height: 136px;
  }

  .sign-value {
    font-size: 40px;
  }

  .ratio-cell {
    grid-template-columns: minmax(76px, 1fr) 52px;
    gap: 8px;
  }
}
</style>
