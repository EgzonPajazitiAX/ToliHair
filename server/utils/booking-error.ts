const businessMessages: Record<string, string> = {
  'Shop is not configured': 'Berberhania nuk është konfiguruar ende për rezervime.',
  'Online booking is disabled': 'Rezervimi në internet nuk është aktiv për momentin.',
  'Booking date required': 'Zgjidhni datën e rezervimit.',
  'Service unavailable': 'Shërbimi i zgjedhur nuk është më i disponueshëm.',
  'Barber unavailable': 'Berberi i zgjedhur nuk është më i disponueshëm.',
  'Service unavailable for this barber': 'Berberi i zgjedhur nuk e ofron këtë shërbim.',
  'Outside working hours': 'Ora e zgjedhur është jashtë orarit të punës.',
  'Outside booking window': 'Ora e zgjedhur është jashtë periudhës së lejuar për rezervim.',
  'Start time is not on the booking grid': 'Ora e zgjedhur nuk është një interval i vlefshëm rezervimi.',
  'Invalid service selection': 'Zgjidhni nga një deri në dhjetë shërbime të ndryshme.',
  'Selected services are too long': 'Kombinimi i shërbimeve nuk mund të jetë më i gjatë se 8 orë.',
  'Selected services are too long or expensive': 'Kombinimi i shërbimeve është shumë i gjatë ose ka vlerë të pavlefshme.',
  'Bookable service schedule required': 'Për aktivizim, caktoni së paku një shërbim aktiv te një berber aktiv dhe shtoni orarin e punës për të njëjtin berber.',
}

export function bookingError(error: { code?: string, message?: string }): never {
  if (error.code === 'PGRST202' && error.message?.includes('get_available_slots_multi')) {
    throw createError({ statusCode: 503, statusMessage: 'Rezervimi me disa shërbime nuk është aktivizuar ende në databazë. Aplikoni migrimet e fundit.' })
  }
  if (error.code === 'PGRST202' && error.message?.includes('create_guest_booking_multi')) {
    throw createError({ statusCode: 503, statusMessage: 'Krijimi i terminit me disa shërbime nuk është aktivizuar ende në databazë. Aplikoni migrimet e fundit.' })
  }
  if (error.code === '23P01') throw createError({ statusCode: 409, statusMessage: 'Ky orar sapo u rezervua ose nuk është më i disponueshëm. Zgjidhni një orar tjetër.' })
  if (error.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Kjo kërkesë rezervimi është përdorur me të dhëna të tjera. Rifilloni rezervimin.' })
  if (error.code === '40001') throw createError({ statusCode: 409, statusMessage: 'Të dhënat ndryshuan gjatë kërkesës. Ringarkoni oraret dhe provoni përsëri.' })
  if (error.code === '42501' && error.message === 'Online booking is disabled') throw createError({ statusCode: 409, statusMessage: businessMessages[error.message] })
  if (error.code === '42501') throw createError({ statusCode: 403, statusMessage: 'Kjo kërkesë nuk lejohet.' })
  if (error.code === '22023' && error.message && businessMessages[error.message]) throw createError({ statusCode: 422, statusMessage: businessMessages[error.message] })
  if (error.code?.startsWith('22') || error.code?.startsWith('23')) throw createError({ statusCode: 422, statusMessage: 'Të dhënat e rezervimit nuk janë të vlefshme.' })
  throw createError({ statusCode: 503, statusMessage: 'Shërbimi i rezervimeve nuk është përkohësisht i disponueshëm.' })
}
