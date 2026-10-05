export interface TimePricing {
  peak_pricing_enabled: boolean
  peak_start_time: string
  peak_end_time: string
  peak_multiplier: number
}

/** Same-day window: the start is inclusive and the end is exclusive. */
export function multiplierAtTime(settings: Partial<TimePricing> | undefined, localTime: string): number {
  if (!settings?.peak_pricing_enabled || !localTime) return 1
  const start = settings.peak_start_time?.slice(0, 5) || ''
  const end = settings.peak_end_time?.slice(0, 5) || ''
  const multiplier = Number(settings.peak_multiplier)
  return start && end && localTime >= start && localTime < end && multiplier > 1 && multiplier <= 5 ? multiplier : 1
}

/** Integer cents and hundredths of a multiplier avoid floating-point rounding drift. */
export function adjustedPrice(priceMinor: number, multiplier: number): number {
  return Math.floor((priceMinor * Math.round(multiplier * 100) + 50) / 100)
}
