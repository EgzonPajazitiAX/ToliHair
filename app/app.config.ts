export default defineAppConfig({
  ui: {
    colors: { primary: 'brand', neutral: 'stone' },
    button: { slots: { base: 'rounded-lg font-semibold' } },
    card: { slots: { root: 'rounded-xl ring-1 ring-default shadow-sm', body: 'p-5 sm:p-6', header: 'p-5 sm:px-6', footer: 'p-5 sm:px-6' } },
    input: { slots: { root: 'rounded-lg' } },
    textarea: { slots: { root: 'rounded-lg' } },
    modal: { slots: { content: 'rounded-xl', header: 'p-5 sm:px-6', body: 'p-5 sm:p-6', footer: 'p-5 sm:px-6' } },
  },
})
