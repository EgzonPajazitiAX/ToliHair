const messages: Record<string, string> = {
  'Invalid appointment range': 'Periudha e kërkuar për terminet nuk është e vlefshme.',
  'Search is too long': 'Kërkimi është shumë i gjatë.',
  'Shop is not configured': 'Berberhania nuk është konfiguruar ende.',
  'Service unavailable': 'Shërbimi i zgjedhur nuk është i disponueshëm.',
  'Barber unavailable': 'Berberi i zgjedhur nuk është i disponueshëm.',
  'Service unavailable for this barber': 'Berberi i zgjedhur nuk e ofron këtë shërbim.',
  'Outside working hours': 'Ora e zgjedhur është jashtë orarit të punës.',
  'Time is blocked': 'Ora e zgjedhur është e bllokuar.',
  'Outside booking window': 'Ora e zgjedhur është jashtë periudhës së lejuar.',
  'Start time is not on the booking grid': 'Ora e zgjedhur nuk përputhet me intervalet e rezervimit.',
  'Appointment has not started': 'Termini nuk ka filluar ende.',
  'Invalid status transition': 'Ndryshimi i statusit nuk lejohet.',
  'Finalized appointments cannot be edited': 'Një termin i përfunduar nuk mund të ndryshohet.',
}

export function appointmentError(error: { code?: string, message?: string }): never {
  if (error.code === '42501') throw createError({ statusCode: 403, statusMessage: 'Kërkohet qasja e stafit.' })
  if (error.code === '40001') throw createError({ statusCode: 409, statusMessage: 'Termini ka ndryshuar. Ringarkoni të dhënat dhe provoni përsëri.' })
  if (error.code === '23P01') throw createError({ statusCode: 409, statusMessage: 'Ky orar është i zënë ose i bllokuar. Zgjidhni një orar tjetër.' })
  if (error.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Kërkesa është përdorur më parë me të dhëna të tjera.' })
  if (error.code === '22023' && error.message && messages[error.message]) {
    throw createError({ statusCode: 422, statusMessage: messages[error.message] })
  }
  if (error.code?.startsWith('22') || error.code?.startsWith('23')) {
    throw createError({ statusCode: 422, statusMessage: 'Kontrolloni të dhënat dhe orarin e terminit.' })
  }
  throw createError({ statusCode: 503, statusMessage: 'Terminet nuk mund të përpunoheshin. Ju lutemi provoni përsëri.' })
}
