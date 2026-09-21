export function priceToMinor(value: string | number, fractionDigits: number): number | null {
  const raw = String(value).trim()
  if (!raw || !Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 6) return null
  const amount = Number(raw)
  const scale = 10 ** fractionDigits
  const minor = Math.round(amount * scale)
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(minor)) return null
  if (Math.abs(amount * scale - minor) > 0.00001 || minor > 2147483647) return null
  return minor
}
