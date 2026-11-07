/** Reads a useful message from backend and Supabase errors, with a safe fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const value = err as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      data?: unknown
    }
    if (typeof value.data === 'string' && value.data.trim()) return value.data
    if (typeof value.message === 'string' && value.message.trim() && !value.message.includes('Server Error')) {
      const parts = [value.message, value.details, value.hint]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      const code = typeof value.code === 'string' && value.code.trim() ? ` (code ${value.code})` : ''
      return parts.join(' — ') + code
    }
  }
  if (err instanceof Error && err.message && !err.message.includes('Server Error')) {
    return err.message
  }
  return fallback
}
