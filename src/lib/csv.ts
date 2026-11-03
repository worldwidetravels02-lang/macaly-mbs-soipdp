export type CsvOrder = {
  kind: string
  reference: string
  memberName: string
  memberEmail: string
  project: string | null
  amountAed: number
  status: string
  createdAt: number
}

const HEADERS = [
  'Kind',
  'Reference',
  'Member',
  'Email',
  'Project',
  'Amount (AED)',
  'Status',
  'Created',
]

/** Quotes a single CSV field, doubling any quotes inside it. */
function field(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Builds a spreadsheet-ready CSV of every order. */export function ordersToCsv(orders: CsvOrder[]): string {
  const rows = orders.map((order) => {
    const iso = new Date(order.createdAt).toISOString()
    const created = `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
    return [
      order.kind,
      order.reference,
      order.memberName,
      order.memberEmail,
      order.project ?? '',
      order.amountAed,
      order.status,
      created,
    ]
      .map(field)
      .join(',')
  })

  return [HEADERS.join(','), ...rows].join('\r\n') + '\r\n'
}

export type CsvMember = {
  fullName: string
  mobile: string
  membershipLevel: number | null
  accountStatus: string | null
}

/** Builds a spreadsheet-ready CSV of every member: name, phone, level and status. */
export function membersToCsv(members: CsvMember[]): string {
  const rows = members.map((member) =>
    [
      member.fullName,
      member.mobile,
      member.membershipLevel ?? '',
      member.accountStatus ?? '',
    ]
      .map(field)
      .join(','),
  )

  return [['Name', 'Phone', 'Level', 'Status'].join(','), ...rows].join('\r\n') + '\r\n'
}

export type CsvProject = {
  slug: string
  priceLabel: string
  updatedAt: number
}

/** Builds a spreadsheet-ready CSV of every project: slug, price and last update. */
export function projectsToCsv(projects: CsvProject[]): string {
  const rows = projects.map((project) => {
    const iso = new Date(project.updatedAt).toISOString()
    const updated = `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
    return [project.slug, project.priceLabel, updated].map(field).join(',')
  })

  return [['Slug', 'Price', 'Last update'].join(','), ...rows].join('\r\n') + '\r\n'
}
