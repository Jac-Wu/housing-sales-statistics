import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.response.use(
  response => {
    if (response.data.code !== 0) {
      return Promise.reject(new Error(response.data.message))
    }
    return response.data
  },
  error => {
    return Promise.reject(error)
  }
)

export default {
  // 楼盘接口
  project: {
    list: () => api.get('/project/list'),
    get: (id) => api.get(`/project/${id}`),
    create: (data) => api.post('/project/create', data),
    update: (id, data) => api.put(`/project/update/${id}`, data),
    delete: (id) => api.delete(`/project/delete/${id}`)
  },
  
  // 楼栋接口
  building: {
    list: (projectId) => api.get('/building/list', { params: { project_id: projectId } }),
    get: (id) => api.get(`/building/${id}`),
    create: (data) => api.post('/building/create', data),
    update: (id, data) => api.put(`/building/update/${id}`, data),
    delete: (id) => api.delete(`/building/delete/${id}`)
  },
  
  // 户型接口
  unitType: {
    list: (projectId) => api.get('/unit-type/list', { params: { project_id: projectId } }),
    get: (id) => api.get(`/unit-type/${id}`),
    create: (data) => api.post('/unit-type/create', data),
    update: (id, data) => api.put(`/unit-type/update/${id}`, data),
    delete: (id) => api.delete(`/unit-type/delete/${id}`),
    buildingOptions: (buildingId) => api.get(`/unit-type/building/${buildingId}/options`)
  },
  
  // 网签接口
  sign: {
    list: (params) => api.get('/sign/list', { params }),
    daily: (date, projectId) => api.get('/sign/daily', { params: { date, project_id: projectId } }),
    previous: (params) => api.get('/sign/previous', { params }),
    derivedSales: (params) => api.get('/sign/derived-sales', { params }),
    add: (data) => api.post('/sign/add', data),
    batch: (data) => api.post('/sign/batch', data),
    delete: (id) => api.delete(`/sign/delete/${id}`)
  },

  unitTypeSale: {
    list: (params) => api.get('/unit-type-sale/list', { params }),
    add: (data) => api.post('/unit-type-sale/add', data),
    batch: (data) => api.post('/unit-type-sale/batch', data),
    delete: (id) => api.delete(`/unit-type-sale/delete/${id}`),
    gaps: (params) => api.get('/unit-type-sale/gaps', { params }),
    differences: (params) => api.get('/unit-type-sale/differences', { params })
  },
  
  // 统计接口
  stat: {
    project: (projectId) => api.get('/stat/project', { params: { project_id: projectId } }),
    building: (params) => api.get('/stat/building', { params }),
    unitType: (params) => api.get('/stat/unit-type', { params }),
    trend: (params) => api.get('/stat/trend', { params }),
    dashboard: (projectId) => api.get('/stat/dashboard', { params: { project_id: projectId } }),
    buildingUnitTypeMatrix: (params) => api.get('/stat/building-unit-type-matrix', { params })
  },
  
  // 校验接口
  check: {
    building: (id) => api.get(`/check/building/${id}`),
    project: (projectId) => api.get('/check/project', { params: { project_id: projectId } }),
    dailySign: (params) => api.get('/check/daily-sign', { params })
  },
  
  // 导入接口
  import: {
    excel: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return axios.post('/api/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    template: () => api.get('/import/template')
  }
}
