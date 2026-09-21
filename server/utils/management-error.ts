export function managementError(error: { code?: string, message?: string }): never {
  const code = error.code
  if (code === '42501') throw createError({ statusCode: 403, statusMessage: 'Kërkohet qasja e administratorit' })
  if (code === '40001') throw createError({ statusCode: 409, statusMessage: 'Këto të dhëna kanë ndryshuar. Ringarkoni faqen para se t’i ruani përsëri.' })
  if (code === '23P01') throw createError({ statusCode: 409, statusMessage: 'Oraret mbivendosen ose bien ndesh me një termin. Kontrolloni orarin dhe provoni përsëri.' })
  // Only expose explicitly authored business errors, never raw SQL details.
  const known: Record<string, string> = {
    'Outside working hours': 'Jashtë orarit të punës',
    'Barber unavailable': 'Berberi nuk është i disponueshëm',
    'Service unavailable for this barber': 'Ky shërbim nuk ofrohet nga ky berber',
    'Configure the shop timezone first': 'Së pari konfiguroni zonën kohore të berberhanes',
    'Configure the shop currency first': 'Së pari konfiguroni valutën e berberhanes',
    'This local time does not exist due to a clock change': 'Kjo orë lokale nuk ekziston për shkak të ndryshimit të orës',
    'This local time is ambiguous due to a clock change; choose another time': 'Kjo orë lokale është e paqartë për shkak të ndryshimit të orës; zgjidhni një orë tjetër',
    'Currency cannot change after services exist; review and migrate prices first': 'Valuta nuk mund të ndryshohet pasi ekzistojnë shërbime; së pari rishikoni dhe përshtatni çmimet',
    'Resolve upcoming appointments and blocks before changing timezone': 'Zgjidhni terminet dhe bllokimet e ardhshme para ndryshimit të zonës kohore',
  }
  if (code === '22023' && error.message && known[error.message]) throw createError({ statusCode: 422, statusMessage: known[error.message] })
  if (code?.startsWith('22') || code?.startsWith('23')) throw createError({ statusCode: 422, statusMessage: 'Vlera të pavlefshme ose konflikt në orar. Kontrolloni formularin dhe terminet ekzistuese.' })
  throw createError({ statusCode: 503, statusMessage: 'Të dhënat e berberhanes nuk mund të ruheshin ose ngarkoheshin. Ju lutemi provoni përsëri.' })
}
