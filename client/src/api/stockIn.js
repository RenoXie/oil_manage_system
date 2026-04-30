import request from './request'

export function getStockInList(params) {
  return request.get('/stock-in', { params })
}

export function createStockIn(data) {
  return request.post('/stock-in', data)
}

export function getStockInDetail(id) {
  return request.get(`/stock-in/${id}`)
}

export function updateStockIn(id, data) {
  return request.put(`/stock-in/${id}`, data)
}
