import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as apiLogin, getMe } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')
  const refreshToken = ref(localStorage.getItem('refresh_token') || '')

  async function login(username, password, captchaId, captchaAnswer) {
    const body = { username, password }
    if (captchaId) body.captcha_id = captchaId
    if (captchaAnswer !== undefined) body.captcha_answer = captchaAnswer
    const res = await apiLogin(body)
    user.value = res.data.user
    token.value = res.data.token
    refreshToken.value = res.data.refresh_token
    localStorage.setItem('user', JSON.stringify(res.data.user))
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('refresh_token', res.data.refresh_token)
  }

  function logout() {
    user.value = null
    token.value = ''
    refreshToken.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
  }

  function setTokens(accessToken, refToken) {
    token.value = accessToken
    refreshToken.value = refToken
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refresh_token', refToken)
  }

  async function refresh() {
    try {
      const res = await getMe()
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch {
      logout()
    }
  }

  return { user, token, refreshToken, login, logout, setTokens, refresh }
})
