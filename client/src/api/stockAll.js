import request from './request'

export function getStockAllList(params) {
  return request.get('/stock-all', { params })
}
