import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '../api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const currentProjectId = ref(Number(localStorage.getItem('currentProjectId')) || null)
  const loading = ref(false)

  const currentProject = computed(() => {
    return projects.value.find(project => project.id === currentProjectId.value) || null
  })

  async function fetchProjects() {
    loading.value = true
    try {
      const res = await api.project.list()
      projects.value = res.data || []
      if (!currentProjectId.value && projects.value.length > 0) {
        setCurrentProject(projects.value[0].id)
      }
      if (currentProjectId.value && !projects.value.some(project => project.id === currentProjectId.value)) {
        setCurrentProject(projects.value[0]?.id || null)
      }
    } finally {
      loading.value = false
    }
  }

  function setCurrentProject(projectId) {
    currentProjectId.value = projectId ? Number(projectId) : null
    if (currentProjectId.value) {
      localStorage.setItem('currentProjectId', String(currentProjectId.value))
    } else {
      localStorage.removeItem('currentProjectId')
    }
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    loading,
    fetchProjects,
    setCurrentProject
  }
})

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboardData = ref(null)
  const loading = ref(false)
  
  const totalUnits = computed(() => dashboardData.value?.total_units || 0)
  const totalSold = computed(() => dashboardData.value?.total_sold || 0)
  const totalAvailable = computed(() => dashboardData.value?.total_available || dashboardData.value?.total_unsold || 0)
  const totalUnsold = totalAvailable
  const deRatio = computed(() => dashboardData.value?.de_ratio || '0%')
  const todaySold = computed(() => dashboardData.value?.today_sold || dashboardData.value?.today_signed || 0)
  const todaySigned = todaySold
  const pendingSupplementCount = computed(() => dashboardData.value?.pending_supplement_count || 0)
  const buildingRanking = computed(() => dashboardData.value?.building_ranking || [])
  const unitTypeStats = computed(() => dashboardData.value?.unit_type_stats || [])
  
  async function fetchDashboard(projectId = null) {
    loading.value = true
    try {
      const res = await api.stat.dashboard(projectId)
      dashboardData.value = res.data
    } catch (err) {
      console.error('获取仪表盘数据失败:', err)
    } finally {
      loading.value = false
    }
  }
  
  return {
    dashboardData,
    loading,
    totalUnits,
    totalSold,
    totalAvailable,
    totalUnsold,
    deRatio,
    todaySold,
    todaySigned,
    pendingSupplementCount,
    buildingRanking,
    unitTypeStats,
    fetchDashboard
  }
})

export const useBuildingStore = defineStore('building', () => {
  const buildings = ref([])
  const loading = ref(false)
  
  async function fetchBuildings(projectId = null) {
    loading.value = true
    try {
      const res = await api.building.list(projectId)
      buildings.value = res.data
    } catch (err) {
      console.error('获取楼栋列表失败:', err)
    } finally {
      loading.value = false
    }
  }
  
  async function createBuilding(data) {
    try {
      await api.building.create(data)
      await fetchBuildings(data.project_id)
    } catch (err) {
      console.error('创建楼栋失败:', err)
      throw err
    }
  }
  
  async function updateBuilding(id, data) {
    try {
      await api.building.update(id, data)
      await fetchBuildings()
    } catch (err) {
      console.error('更新楼栋失败:', err)
      throw err
    }
  }
  
  async function deleteBuilding(id) {
    try {
      await api.building.delete(id)
      await fetchBuildings()
    } catch (err) {
      console.error('删除楼栋失败:', err)
      throw err
    }
  }
  
  return {
    buildings,
    loading,
    fetchBuildings,
    createBuilding,
    updateBuilding,
    deleteBuilding
  }
})

export const useUnitTypeStore = defineStore('unitType', () => {
  const unitTypes = ref([])
  const loading = ref(false)
  
  async function fetchUnitTypes(projectId = null) {
    loading.value = true
    try {
      const res = await api.unitType.list(projectId)
      unitTypes.value = res.data
    } catch (err) {
      console.error('获取户型列表失败:', err)
    } finally {
      loading.value = false
    }
  }
  
  return {
    unitTypes,
    loading,
    fetchUnitTypes
  }
})
