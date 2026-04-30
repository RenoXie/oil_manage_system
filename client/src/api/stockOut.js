import request from './request'

export function getStockOutList(params) {
  return request.get('/stock-out', { params })
}

export function createStockOut(data) {
  return request.post('/stock-out', data)
}

export function getStockOutDetail(id) {
  return request.get(`/stock-out/${id}`)
}

export function updateStockOut(id, data) {
  return request.put(`/stock-out/${id}`, data)
}
