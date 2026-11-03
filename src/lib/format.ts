export function formatAed(value: number): string {
  const rounded = Math.round(value)
  return `AED ${rounded.toLocaleString('en-AE')}`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
