// One policy shared by navigation and server authorization. Server checks are authoritative.
export function decodedAuthPath(path: string) {
  try { return decodeURIComponent(path) }
  catch { return path }
}

export function isDashboardPath(path: string) {
  return /^\/(?:api\/)?dashboard(?:\/|$)/i.test(decodedAuthPath(path))
}

export function requiresAdmin(path: string) {
  return /^\/(?:api\/)?dashboard\/(services|barbers|working-hours|blocked-times|settings|booking-status)(?:\/|$)/i.test(decodedAuthPath(path))
}

export function safeDashboardRedirect(value: unknown): string {
  if (typeof value !== 'string' || !/^\/dashboard(?:\/|$)/.test(value)
    || /[\\\s?#%]/.test(value) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) return '/dashboard'
  return value
}
