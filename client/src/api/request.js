import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingRequests = []
let isHandling401 = false

function resolvePending(token) {
  pendingRequests.forEach((cb) => cb(token))
  pendingRequests = []
}

function rejectPending() {
  pendingRequests.forEach((cb) => cb(null))
  pendingRequests = []
}

async function doRefreshToken() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('No refresh token')
  const res = await axios.post('/api/auth/refresh', { refresh_token })
  return res.data.data
}

request.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const { config, response } = err
    if (response) {
      const { status, data } = response

      // 登录失败的 401 不处理，交给调用方
      if (status === 401 && config.url?.endsWith('/auth/login')) {
        return Promise.reject(err)
      }

      if (status === 401 && !config._retry && !config.url?.endsWith('/auth/refresh')) {
        const savedRefreshToken = localStorage.getItem('refresh_token')
        if (savedRefreshToken) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              pendingRequests.push((token) => {
                if (token) {
                  config.headers.Authorization = `Bearer ${token}`
                  config._retry = true
                  resolve(request(config))
                } else {
                  reject(err)
                }
              })
            })
          }

          isRefreshing = true
          try {
            const tokens = await doRefreshToken()
            const newToken = tokens.token
            const newRefreshToken = tokens.refresh_token
            localStorage.setItem('token', newToken)
            localStorage.setItem('refresh_token', newRefreshToken)
            resolvePending(newToken)
            config.headers.Authorization = `Bearer ${newToken}`
            config._retry = true
            return request(config)
          } catch (_e) {
            rejectPending()
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
            return Promise.reject(err)
          } finally {
            isRefreshing = false
          }
        }

        if (!isHandling401) {
          isHandling401 = true
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          setTimeout(() => { isHandling401 = false }, 1000)
        }
      } else if (status !== 401) {
        ElMessage.error(data?.msg || '请求失败')
      }
    } else {
      ElMessage.error('网络错误')
    }
    return Promise.reject(err)
  }
)

export default request
