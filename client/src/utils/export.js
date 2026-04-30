import * as XLSX from 'xlsx'

export function exportToExcel(columns, data, filename) {
  const header = columns.map((c) => c.label)
  const keys = columns.map((c) => c.key)
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k]
      return val != null ? val : ''
    })
  )
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  sheet['!cols'] = columns.map((c) => ({ wch: c.width || 15 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
