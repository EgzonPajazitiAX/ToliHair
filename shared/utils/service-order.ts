export function moveService(ids: string[], sourceId: string, targetId: string): string[] {
  const from = ids.indexOf(sourceId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0 || from === to) return [...ids]
  const result = [...ids]
  result.splice(from, 1)
  result.splice(to, 0, sourceId)
  return result
}
