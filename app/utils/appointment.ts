import type { AppointmentStatus } from '#shared/types/appointments'

export function localDateInZone(timezone = 'Europe/Belgrade', date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekStart(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  return shiftDate(value, -offset)
}

export function appointmentLocalDate(value: string, timezone = 'Europe/Belgrade') {
  return localDateInZone(timezone, new Date(value))
}

export function appointmentDateTime(value: string, timezone = 'Europe/Belgrade') {
  return new Intl.DateTimeFormat('sq-XK', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function appointmentTime(value: string, timezone = 'Europe/Belgrade') {
  return new Intl.DateTimeFormat('sq-XK', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export const appointmentStatuses: Record<AppointmentStatus, { label: string, color: 'primary' | 'neutral' | 'success' | 'error' | 'warning' }> = {
  confirmed: { label: 'Konfirmuar', color: 'primary' },
  cancelled: { label: 'Anuluar', color: 'error' },
  completed: { label: 'Përfunduar', color: 'success' },
  no_show: { label: 'Nuk u paraqit', color: 'warning' },
}
