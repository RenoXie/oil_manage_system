import request from './request'

export function getOverview(params) {
  return request.get('/statistics/overview', { params })
}

export function getBuyer(params) {
  return request.get('/statistics/buyer', { params })
}

export function getBuyers(params) {
  return request.get('/statistics/buyers', { params })
}
