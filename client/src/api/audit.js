import request from './request'

export function getAuditLogs(params) {
  return request.get('/audit', { params })
}

export function archiveAuditLogs(months) {
  return request.post('/audit/archive', { months })
}
