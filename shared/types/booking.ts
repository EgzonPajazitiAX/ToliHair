export interface BookingShop {
  name: string
  phone: string | null
  address: string | null
  timezone: string | null
  currency: string | null
  booking_enabled: boolean
  minimum_notice_minutes: number
  booking_horizon_days: number
}

export interface BookingService {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_minor: number
}

export interface BookingBarber {
  id: string
  name: string
  bio: string
  service_ids: string[]
}

export interface BookingCatalog {
  shop: BookingShop
  services: BookingService[]
  barbers: BookingBarber[]
}

export interface AvailabilitySlot {
  startsAt: string
  localTime: string
  barberId: string
  barberName: string
}

export interface BookingReceipt {
  token: string
  appointmentId: string
  customerName: string
  serviceName: string
  barberId: string
  barberName?: string
  startsAt: string
  endsAt: string
  durationMinutes: number
  priceMinor: number
  currency: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}
