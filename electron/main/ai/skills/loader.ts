import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AiTaskPayload } from '../shared-types'
import type { SkillDefinition } from './types'
import { getProjectSkillsDirPath } from './discovery'

export function loadSkillReferences(
  skill: SkillDefinition,
  task: AiTaskPayload
): Array<{ file: string; content: string }> {
  const results: Array<{ file: string; content: string }> = []
  const rules = skill.manifest.references

  if (!rules.length) return results

  for (const rule of rules) {
    if (!shouldLoadReference(rule.loadWhen, task)) continue

    const filePath = join(getProjectSkillsDirPath(), skill.id, rule.file)
    if (!existsSync(filePath)) continue

    try {
      const { readFileSync } = require('node:fs')
      const content = readFileSync(filePath, 'utf-8') as string
      results.push({ file: rule.file, content: content.slice(0, 4000) })
    } catch {
      // skip unreadable reference files
    }
  }

  return results
}

function shouldLoadReference(
  condition: { task?: string; chapterIndexMax?: number } | undefined,
  task: AiTaskPayload
): boolean {
  if (!condition) return true

  if (condition.task && condition.task !== task.task) return false

  if (typeof condition.chapterIndexMax === 'number') {
    const chapterIndex = Number(task.context.chapterIndex ?? -1)
    if (chapterIndex < 0 || chapterIndex > condition.chapterIndexMax) return false
  }

  return true
}

export async function loadSkillContentAsync(skillId: string): Promise<string | null> {
  const filePath = join(getProjectSkillsDirPath(), skillId, 'SKILL.md')
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}
