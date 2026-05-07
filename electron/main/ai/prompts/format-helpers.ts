export function formatOrganizations(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 6)
        .map((entry) => {
          const record = entry as Record<string, unknown>
          return `${String(record.name ?? '')} / ${String(record.type ?? '')}：${String(record.description ?? '')}${record.motto ? `（信条：${String(record.motto)}）` : ''}`
        })
        .join('\n')
    : ''
}

export function formatCharacterRelationships(source: unknown, charactersSource: unknown): string {
  if (!Array.isArray(source)) return ''
  const characterNameMap = new Map(
    Array.isArray(charactersSource)
      ? charactersSource.map((character) => {
          const record = character as Record<string, unknown>
          return [String(record.id ?? ''), String(record.name ?? '')]
        })
      : []
  )
  return source
    .slice(0, 8)
    .map((entry) => {
      const record = entry as Record<string, unknown>
      const fromName = characterNameMap.get(String(record.fromCharacterId ?? '')) || String(record.fromCharacterId ?? '')
      const toName = characterNameMap.get(String(record.toCharacterId ?? '')) || String(record.toCharacterId ?? '')
      return `${fromName} -> ${toName} / ${String(record.type ?? '')}：${String(record.description ?? '')}（强度 ${String(record.intensity ?? '')}）`
    })
    .join('\n')
}

export function formatOrganizationMemberships(membershipsSource: unknown, organizationsSource: unknown, charactersSource: unknown): string {
  if (!Array.isArray(membershipsSource)) return ''
  const organizationNameMap = new Map(
    Array.isArray(organizationsSource)
      ? organizationsSource.map((org) => {
          const record = org as Record<string, unknown>
          return [String(record.id ?? ''), String(record.name ?? '')]
        })
      : []
  )
  const characterNameMap = new Map(
    Array.isArray(charactersSource)
      ? charactersSource.map((character) => {
          const record = character as Record<string, unknown>
          return [String(record.id ?? ''), String(record.name ?? '')]
        })
      : []
  )
  return membershipsSource
    .slice(0, 8)
    .map((entry) => {
      const record = entry as Record<string, unknown>
      const characterName = characterNameMap.get(String(record.characterId ?? '')) || String(record.characterId ?? '')
      const organizationName = organizationNameMap.get(String(record.organizationId ?? '')) || String(record.organizationId ?? '')
      return `${characterName} 属于 ${organizationName} / 身份：${String(record.role ?? '')}${record.notes ? ` / 备注：${String(record.notes)}` : ''}`
    })
    .join('\n')
}

export function formatWorldviewEntries(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 8)
        .map((entry) => `${String((entry as Record<string, unknown>).title ?? '')}：${String((entry as Record<string, unknown>).content ?? '')}`)
        .join('\n')
    : ''
}

export function formatCharacters(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 8)
        .map((character) => `${String((character as Record<string, unknown>).name ?? '')} / ${String((character as Record<string, unknown>).role ?? '')}：${String((character as Record<string, unknown>).description ?? '')}`)
        .join('\n')
    : ''
}

export function formatInspirationEntries(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 6)
        .map((entry) => {
          const record = entry as Record<string, unknown>
          const tags = Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)).join('、') : ''
          return `${String(record.type ?? '')} / ${String(record.title ?? '')}：${String(record.content ?? '')}${tags ? `（标签：${tags}）` : ''}`
        })
        .join('\n')
    : ''
}

export function formatOutlineItems(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 6)
        .map((item) => `${String((item as Record<string, unknown>).title ?? '')}：${String((item as Record<string, unknown>).summary ?? '')}`)
        .join('\n')
    : ''
}

export function formatRelatedChapters(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(0, 2)
        .map((item, index) => {
          const record = item as Record<string, unknown>
          return `关联章节${index + 1}：${String(record.title ?? '')}\n摘要：${String(record.summary ?? '')}\n正文预览：${String(record.preview ?? '')}`
        })
        .join('\n\n')
    : ''
}

export function formatVolumeChapterSummaries(source: unknown): string {
  return Array.isArray(source)
    ? source
        .map((item, index) => {
          const record = item as Record<string, unknown>
          return `第${index + 1}节：${String(record.title ?? '')}\n  摘要：${String(record.summary ?? '') || '暂无摘要'}`
        })
        .join('\n\n')
    : ''
}

export function formatNovelOpenerSummary(source: unknown): string {
  if (!source) return ''
  const record = source as Record<string, unknown>
  return `标题：${String(record.title ?? '')}\n摘要：${String(record.summary ?? '') || '暂无摘要'}`
}

export function formatOpenPlotThreads(source: unknown): string {
  return Array.isArray(source)
    ? source
        .filter((t) => (t as Record<string, unknown>).status === 'open')
        .map((t) => {
          const record = t as Record<string, unknown>
          return `- ${String(record.title ?? '')}：${String(record.description ?? '')}`
        })
        .join('\n')
    : ''
}

export function formatRecentMessages(source: unknown): string {
  return Array.isArray(source)
    ? source
        .slice(-4)
        .map((item) => {
          const record = item as Record<string, unknown>
          const role = String(record.role ?? '') === 'assistant' ? '助理' : '用户'
          return `${role}：${String(record.content ?? '')}`
        })
        .join('\n')
    : ''
}
