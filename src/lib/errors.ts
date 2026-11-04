/** Reads a useful message from a backend error, falling back to a safe user-facing message. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data
    if (typeof data === 'string' && data.trim()) return data
  }
  if (err instanceof Error && err.message && !err.message.includes('Server Error')) {
    return err.message
  }
  return fallback
}
