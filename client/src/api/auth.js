import request from './request'

export function login(data) {
  return request.post('/auth/login', data)
}

export function register(data) {
  return request.post('/auth/register', data)
}

export function getMe() {
  return request.get('/auth/me')
}

export function getCaptcha() {
  return request.get('/auth/captcha')
}

export function refreshToken(refresh_token) {
  return request.post('/auth/refresh', { refresh_token })
}

export function logout() {
  return request.post('/auth/logout')
}
