import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/project',
    name: 'Project',
    component: () => import('../views/Project.vue')
  },
  {
    path: '/building',
    name: 'Building',
    component: () => import('../views/Building.vue')
  },
  {
    path: '/unit-type',
    name: 'UnitType',
    component: () => import('../views/UnitType.vue')
  },
  {
    path: '/sign-entry',
    name: 'SignEntry',
    component: () => import('../views/SignEntry.vue')
  },
  {
    path: '/unit-type-sales',
    name: 'UnitTypeSales',
    component: () => import('../views/UnitTypeSales.vue')
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/Statistics.vue')
  },
  {
    path: '/check-report',
    name: 'CheckReport',
    component: () => import('../views/CheckReport.vue')
  },
  {
    path: '/excel-import',
    name: 'ExcelImport',
    component: () => import('../views/ExcelImport.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
