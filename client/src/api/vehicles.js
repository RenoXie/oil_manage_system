import request from './request'

export function getVehicles() {
  return request.get('/vehicles')
}

export function createVehicle(data) {
  return request.post('/vehicles', data)
}

export function updateVehicle(id, data) {
  return request.put(`/vehicles/${id}`, data)
}

export function deleteVehicle(id) {
  return request.delete(`/vehicles/${id}`)
}
