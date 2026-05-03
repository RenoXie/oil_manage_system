import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

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

let isHandling401 = false

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response) {
      const { status, data } = err.response
      if (status === 401) {
        if (!isHandling401) {
          isHandling401 = true
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push('/login')
          ElMessage.error('登录已过期，请重新登录')
          setTimeout(() => { isHandling401 = false }, 1000)
        }
      } else {
        ElMessage.error(data?.msg || '请求失败')
      }
    } else {
      ElMessage.error('网络错误')
    }
    return Promise.reject(err)
  }
)

export default request
