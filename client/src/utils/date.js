export function getCurrentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')
  return [`${y}-${m}-01`, `${y}-${m}-${lastDay}`]
}

export function formatDate(val, showTime = false) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const date = `${y}-${mo}-${day}`
  return showTime ? `${date} ${h}:${mi}:${s}` : date
}
