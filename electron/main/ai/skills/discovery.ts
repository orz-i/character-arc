import { app } from 'electron'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { SkillDefinition } from './types'
import { parseSkillFrontmatter } from './frontmatter'
import { validateManifest } from './manifest'
import { inferSkillMeta, buildFullManifest } from './heuristics'

function resolveProjectSkillsScope(projectId?: string): string {
  const normalizedProjectId = String(projectId ?? '').trim()
  return normalizedProjectId || '_shared'
}

export function getBuiltinSkillsDirPath(): string {
  return join(app.getAppPath(), 'resources', 'skills')
}

export function getProjectSkillsDirPath(projectId?: string): string {
  return join(app.getPath('userData'), 'project-skills', resolveProjectSkillsScope(projectId))
}

export async function scanSkillsFromDisk(projectId?: string): Promise<SkillDefinition[]> {
  const builtinSkills = await scanSkillsUnderRoot(getBuiltinSkillsDirPath(), 'builtin')
  const projectSkills = await scanSkillsUnderRoot(getProjectSkillsDirPath(projectId), 'project')
  const mergedMap = new Map<string, SkillDefinition>()

  for (const skill of builtinSkills) mergedMap.set(skill.id, skill)
  for (const skill of projectSkills) mergedMap.set(skill.id, skill)

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

async function scanSkillsUnderRoot(root: string, scope: 'builtin' | 'project'): Promise<SkillDefinition[]> {
  if (!existsSync(root)) return []

  const entries = await readdir(root, { withFileTypes: true })
  const skills: SkillDefinition[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skill = await loadSkillDefinition(root, entry.name, scope)
    if (skill) skills.push(skill)
  }

  return skills
}

async function loadSkillDefinition(root: string, dirName: string, scope: 'builtin' | 'project'): Promise<SkillDefinition | null> {
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
      path: `${scope === 'builtin' ? 'skills' : 'project-skills'}/${dirName}`,
      scope,
      rootDir: skillDir,
      description: frontmatter.description || '',
      source: frontmatter.source || '',
      manifest: fullManifest,
      compatibility: frontmatter.overrides.compatibility ?? heuristic.compatibility,
      compatibilityNote: frontmatter.overrides.compatibilityNote ?? heuristic.compatibilityNote,
      enabled: frontmatter.overrides.enabled ?? heuristic.enabled,
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
