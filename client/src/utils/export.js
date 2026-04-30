import * as XLSX from 'xlsx'

export function exportToExcel(columns, data, filename, options = {}) {
  const { sumColumns = [] } = options
  const header = columns.map((c) => c.label)
  const keys = columns.map((c) => c.key)
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k]
      return val != null ? val : ''
    })
  )

  if (sumColumns.length > 0 && data.length > 0) {
    const sumRow = keys.map((k, i) => {
      if (i === 0) return '合计'
      if (sumColumns.includes(k)) {
        const sum = data.reduce((acc, row) => acc + (+(row[k] || 0)), 0)
        return +sum.toFixed(2)
      }
      return ''
    })
    rows.push(sumRow)
  }

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  sheet['!cols'] = columns.map((c) => ({ wch: c.width || 15 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
