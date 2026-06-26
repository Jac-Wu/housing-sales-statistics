<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-title">
        <span class="brand-mark">销</span>
        <div>
          <div class="logo">楼盘销售分析系统</div>
          <div class="brand-subtitle">销售经营数据中枢</div>
        </div>
      </div>
      <div class="header-info">
        <el-select
          v-model="selectedProjectId"
          placeholder="选择楼盘"
          filterable
          class="project-switch"
          @change="handleProjectChange"
        >
          <el-option
            v-for="project in projectStore.projects"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          >
            <div class="project-option">
              <span>{{ project.name }}</span>
              <el-tag size="small" effect="plain">{{ project.status || 'active' }}</el-tag>
            </div>
          </el-option>
        </el-select>
        <span class="current-date">{{ currentDate }}</span>
      </div>
    </el-header>
    <el-container>
      <el-aside width="236px" class="app-aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="side-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据总览</span>
          </el-menu-item>
          <el-menu-item index="/project">
            <el-icon><OfficeBuilding /></el-icon>
            <span>楼盘管理</span>
          </el-menu-item>
          <el-menu-item index="/building">
            <el-icon><House /></el-icon>
            <span>楼栋管理</span>
          </el-menu-item>
          <el-menu-item index="/unit-type">
            <el-icon><Grid /></el-icon>
            <span>户型管理</span>
          </el-menu-item>
          <el-menu-item index="/sign-entry">
            <el-icon><EditPen /></el-icon>
            <span>网签录入</span>
          </el-menu-item>
          <el-menu-item index="/unit-type-sales">
            <el-icon><Tickets /></el-icon>
            <span>户型补充</span>
          </el-menu-item>
          <el-menu-item index="/statistics">
            <el-icon><TrendCharts /></el-icon>
            <span>统计分析</span>
          </el-menu-item>
          <el-menu-item index="/check-report">
            <el-icon><Warning /></el-icon>
            <span>校验报告</span>
          </el-menu-item>
          <el-menu-item index="/excel-import">
            <el-icon><Upload /></el-icon>
            <span>Excel导入</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from './store'
import {
  DataAnalysis,
  OfficeBuilding,
  House,
  Grid,
  EditPen,
  Tickets,
  TrendCharts,
  Warning,
  Upload
} from '@element-plus/icons-vue'

const route = useRoute()
const projectStore = useProjectStore()
const selectedProjectId = ref(null)
const activeMenu = computed(() => route.path)
const currentDate = computed(() => {
  const now = new Date()
  return now.toLocaleDateString('zh-CN')
})

onMounted(async () => {
  await projectStore.fetchProjects()
  selectedProjectId.value = projectStore.currentProjectId
})

watch(
  () => projectStore.currentProjectId,
  (value) => {
    selectedProjectId.value = value
  }
)

function handleProjectChange(projectId) {
  projectStore.setCurrentProject(projectId)
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  min-width: 320px;
}

.app-container {
  height: 100vh;
  width: 100vw;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 10% 0%, rgba(37, 99, 235, 0.10), transparent 28%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
}

@supports (height: 100svh) {
  .app-container {
    height: 100svh;
  }
}

.app-header {
  background: rgba(255, 255, 255, 0.88);
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 68px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(230, 235, 242, 0.9);
  backdrop-filter: blur(18px);
  box-shadow: 0 10px 30px rgba(24, 38, 70, 0.05);
  z-index: 2;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-mark {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  background: linear-gradient(135deg, #2563eb 0%, #0f9f8f 100%);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
}

.logo {
  color: var(--text-main);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.brand-subtitle {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-switch {
  width: 260px;
}

.project-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.current-date {
  min-width: 92px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.el-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.app-aside {
  background: rgba(255, 255, 255, 0.72);
  border-right: 1px solid rgba(230, 235, 242, 0.92);
  width: 236px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 18px 14px;
  backdrop-filter: blur(16px);
}

.side-menu {
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: #eef5ff;
  --el-menu-active-color: var(--primary);
  --el-menu-text-color: var(--text-regular);
  border-right: none;
  border-bottom: none;
  height: 100%;
  background: transparent;
}

.side-menu .el-menu-item {
  height: 46px;
  margin: 4px 0;
  border-radius: 8px;
  color: var(--text-regular);
  font-weight: 650;
}

.side-menu .el-menu-item:hover {
  color: var(--text-main);
}

.side-menu .el-menu-item.is-active {
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.12), rgba(15, 159, 143, 0.08));
  color: var(--primary);
  box-shadow: inset 3px 0 0 var(--primary);
}

.side-menu .el-icon {
  font-size: 18px;
}

.app-main {
  background: transparent;
  padding: 0;
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

@media (max-width: 900px) {
  html,
  body,
  #app {
    height: auto;
    min-height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .app-container {
    width: 100%;
    height: auto;
    min-height: 100svh;
  }

  .app-header {
    position: sticky;
    top: 0;
    height: auto;
    min-height: 64px;
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
    padding: calc(12px + env(safe-area-inset-top)) 14px 12px;
    z-index: 12;
  }

  .header-title {
    width: 100%;
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .logo {
    max-width: calc(100vw - 92px);
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brand-subtitle {
    display: none;
  }

  .header-info {
    width: 100%;
    gap: 10px;
  }

  .project-switch {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .current-date {
    display: none;
  }

  .app-container > .el-container {
    display: block;
    flex: none;
    overflow: visible;
  }

  .app-aside {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 20;
    width: 100% !important;
    height: auto;
    padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
    overflow-x: auto;
    overflow-y: hidden;
    border-top: 1px solid rgba(230, 235, 242, 0.95);
    border-right: 0;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 -14px 34px rgba(24, 38, 70, 0.10);
  }

  .side-menu {
    display: flex;
    align-items: center;
    gap: 4px;
    width: max-content;
    min-width: 100%;
    height: 56px;
  }

  .side-menu .el-menu-item {
    flex: 0 0 64px;
    width: 64px;
    height: 52px;
    flex-direction: column;
    gap: 3px;
    justify-content: center;
    margin: 0;
    padding: 0 !important;
    line-height: 1;
  }

  .side-menu .el-menu-item span {
    display: block;
    max-width: 58px;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .side-menu .el-icon {
    margin: 0;
    font-size: 18px;
  }

  .side-menu .el-menu-item.is-active {
    box-shadow: inset 0 -3px 0 var(--primary);
  }

  .app-main {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
    overflow: visible;
  }
}

@media (max-width: 480px) {
  .app-header {
    padding-right: 12px;
    padding-left: 12px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
  }

  .logo {
    max-width: calc(100vw - 80px);
    font-size: 15px;
  }

  .side-menu .el-menu-item {
    flex-basis: 58px;
    width: 58px;
  }

  .side-menu .el-menu-item span {
    max-width: 52px;
  }
}
</style>
