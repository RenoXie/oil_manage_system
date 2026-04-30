import request from './request'

export function getInventory() {
  return request.get('/inventory')
}

export function getVehicleDetail(vehicleId, params) {
  return request.get(`/inventory/${vehicleId}`, { params })
}
