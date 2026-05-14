import type { SkillCompatibility, SkillManifest } from './types'

export type SkillFrontmatterOverrides = {
  compatibility?: SkillCompatibility
  compatibilityNote?: string
  enabled?: boolean
}

export function parseSkillFrontmatter(content: string): {
  name: string
  version: string
  description: string
  source: string
  manifest: Partial<SkillManifest> | null
  overrides: SkillFrontmatterOverrides
} {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const frontmatter = frontmatterMatch?.[1] ?? ''
  const lines = frontmatter.split(/\r?\n/)
  let name = ''
  let version = ''
  let description = ''
  let source = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!fieldMatch) continue

    const [, field, rawValue] = fieldMatch
    const value = stripYamlScalar(rawValue)

    if (field === 'description' && (value === '|' || value === '>')) {
      const block: string[] = []
      index += 1
      while (index < lines.length) {
        const blockLine = lines[index]
        if (blockLine && !/^\s+/.test(blockLine)) {
          index -= 1
          break
        }
        const trimmed = blockLine.trim()
        if (trimmed) block.push(trimmed)
        index += 1
      }
      description = block.join(' ').trim()
      continue
    }

    if (field === 'name') { name = value; continue }
    if (field === 'version') { version = value; continue }
    if (field === 'description') { description = value }
  }

  const sourceMatch = frontmatter.match(/^\s*source:\s*(.+)$/m)
  if (sourceMatch?.[1]) source = stripYamlScalar(sourceMatch[1])

  const { manifest, overrides } = parseManifestBlock(frontmatter)

  return { name, version, description, source, manifest, overrides }
}

function parseManifestBlock(frontmatter: string): {
  manifest: Partial<SkillManifest> | null
  overrides: SkillFrontmatterOverrides
} {
  const manifestStart = frontmatter.match(/^manifest:\s*$/m)
  if (!manifestStart) return { manifest: null, overrides: {} }

  const startIndex = manifestStart.index! + manifestStart[0].length
  const remaining = frontmatter.slice(startIndex)
  const lines = remaining.split(/\r?\n/)

  const result: Record<string, unknown> = {}
  let currentListKey: string | null = null
  let currentList: string[] | null = null

  const flushList = (): void => {
    if (currentListKey && currentList) result[currentListKey] = currentList
    currentListKey = null
    currentList = null
  }

  for (const line of lines) {
    if (line.match(/^[A-Za-z]/) && !line.startsWith(' ')) break

    const listItemMatch = line.match(/^\s{4,}-\s*(.+)$/)
    if (listItemMatch && currentList) {
      currentList.push(stripYamlScalar(listItemMatch[1]))
      continue
    }

    const match = line.match(/^\s{2}(\w+):\s*(.*)$/)
    if (!match) continue
    flushList()

    const [, key, rawValue] = match
    const value = stripYamlScalar(rawValue)

    if (value === '') {
      currentListKey = key
      currentList = []
      continue
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value.slice(1, -1).split(',').map((s) => stripYamlScalar(s)).filter(Boolean)
    } else if (value === 'true' || value === 'false') {
      result[key] = value === 'true'
    } else {
      result[key] = isNaN(Number(value)) ? value : Number(value)
    }
  }
  flushList()

  const overrides: SkillFrontmatterOverrides = {}
  if (typeof result.compatibility === 'string') overrides.compatibility = result.compatibility as SkillCompatibility
  if (typeof result.compatibilityNote === 'string') overrides.compatibilityNote = result.compatibilityNote
  if (typeof result.enabled === 'boolean') overrides.enabled = result.enabled

  const manifestKeys = ['category', 'tasks', 'stages', 'triggers', 'priority', 'required']
  const hasManifestField = manifestKeys.some((k) => result[k] !== undefined)
  if (!hasManifestField) return { manifest: null, overrides }

  const manifest: Partial<SkillManifest> = {
    category: typeof result.category === 'string' ? result.category as SkillManifest['category'] : undefined,
    tasks: Array.isArray(result.tasks) ? result.tasks as SkillManifest['tasks'] : undefined,
    stages: Array.isArray(result.stages) ? result.stages as SkillManifest['stages'] : undefined,
    triggers: Array.isArray(result.triggers) ? result.triggers as string[] : undefined,
    priority: typeof result.priority === 'number' ? result.priority : undefined,
    required: result.required === true ? true : undefined
  }

  return { manifest, overrides }
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}
