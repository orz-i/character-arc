import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { SkillDefinition } from './types'
import { parseSkillFrontmatter } from './frontmatter'
import { validateManifest } from './manifest'
import { inferSkillMeta, buildFullManifest } from './heuristics'

export function getProjectSkillsDirPath(): string {
  return join(process.cwd(), '.project-skills')
}

export async function scanSkillsFromDisk(): Promise<SkillDefinition[]> {
  const root = getProjectSkillsDirPath()
  if (!existsSync(root)) return []

  const entries = await readdir(root, { withFileTypes: true })
  const skills: SkillDefinition[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skill = await loadSkillDefinition(root, entry.name)
    if (skill) skills.push(skill)
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

async function loadSkillDefinition(root: string, dirName: string): Promise<SkillDefinition | null> {
  const skillDir = join(root, dirName)
  const skillPath = join(skillDir, 'SKILL.md')

  try {
    const content = await readFile(skillPath, 'utf-8')
    const frontmatter = parseSkillFrontmatter(content)
    const validatedManifest = validateManifest(frontmatter.manifest)
    const heuristic = inferSkillMeta(dirName, frontmatter.description)
    const fullManifest = buildFullManifest(validatedManifest, heuristic)

    const referencesDir = join(skillDir, 'references')
    const referencesCount = existsSync(referencesDir) ? await countFilesRecursive(referencesDir) : 0

    return {
      id: dirName,
      name: frontmatter.name || dirName,
      version: frontmatter.version || '',
      path: `.project-skills/${dirName}`,
      description: frontmatter.description || '',
      source: frontmatter.source || '',
      manifest: fullManifest,
      compatibility: heuristic.compatibility,
      compatibilityNote: heuristic.compatibilityNote,
      enabled: heuristic.enabled,
      referencesCount,
      content
    }
  } catch {
    return null
  }
}

async function countFilesRecursive(root: string): Promise<number> {
  const entries = await readdir(root, { withFileTypes: true })
  let total = 0
  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += await countFilesRecursive(join(root, entry.name))
    } else {
      total += 1
    }
  }
  return total
}
