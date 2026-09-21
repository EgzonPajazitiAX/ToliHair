export const dashboardNavigation = [
  { label: 'Përmbledhja', to: '/dashboard', description: 'Një pamje e qartë e ditës që ju pret.', emptyTitle: 'Nuk ka termine sot', emptyDescription: 'Terminet e ditës dhe statistikat përkatëse shfaqen automatikisht këtu.' },
  { label: 'Terminet', to: '/dashboard/appointments', description: 'Mbani çdo vizitë në rregull.', emptyTitle: 'Nuk u gjet asnjë termin', emptyDescription: 'Ndryshoni filtrat ose krijoni një termin të ri manualisht.' },
  { label: 'Kalendari', to: '/dashboard/calendar', description: 'Organizoni një ditë të mbarë.', emptyTitle: 'Kalendari është i lirë', emptyDescription: 'Nuk ka termine për periudhën e zgjedhur.' },
  { label: 'Shërbimet', to: '/dashboard/services', description: 'Detajet pas çdo shërbimi.', emptyTitle: 'Lista e shërbimeve', emptyDescription: 'Menaxhoni emrat, përshkrimet, çmimet, kohëzgjatjen dhe disponueshmërinë e shërbimeve.' },
  { label: 'Berberët', to: '/dashboard/barbers', description: 'Njerëzit pas çdo prerjeje.', emptyTitle: 'Njihuni me ekipin', emptyDescription: 'Shtoni dhe ndryshoni berberët, caktoni shërbimet dhe menaxhoni statusin e tyre.' },
  { label: 'Orari i punës', to: '/dashboard/working-hours', description: 'Një ritëm që i përshtatet ekipit.', emptyTitle: 'Caktoni javën e punës', emptyDescription: 'Konfiguroni orarin e rregullt dhe pushimet e secilit berber.' },
  { label: 'Oraret e bllokuara', to: '/dashboard/blocked-times', description: 'Planifikoni kohën e pushimit.', emptyTitle: 'Hapësirë për pushim', emptyDescription: 'Menaxhoni orët e bllokuara, ditët e lira dhe pushimet vjetore.' },
  { label: 'Cilësimet', to: '/dashboard/settings', description: 'Përshtateni panelin sipas nevojave tuaja.', emptyTitle: 'Cilësimet e berberhanes', emptyDescription: 'Konfiguroni të dhënat e berberhanes, zonën kohore, valutën dhe rregullat e rezervimit.' },
] as const
