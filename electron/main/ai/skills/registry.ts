import type { SkillDefinition, SkillScanEntry } from './types'
import { scanSkillsFromDisk } from './discovery'

let skillMap = new Map<string, SkillDefinition>()
let initialized = false

export async function initRegistry(): Promise<void> {
  const skills = await scanSkillsFromDisk()
  skillMap = new Map(skills.map((s) => [s.id, s]))
  initialized = true
}

export async function refreshRegistry(): Promise<void> {
  const skills = await scanSkillsFromDisk()
  skillMap = new Map(skills.map((s) => [s.id, s]))
}

export function ensureInitialized(): boolean {
  return initialized
}

export function getAllSkills(): SkillDefinition[] {
  return Array.from(skillMap.values())
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return skillMap.get(id)
}

export function getEnabledSkills(): SkillDefinition[] {
  return getAllSkills().filter((s) => s.enabled)
}

export function toScanEntries(): SkillScanEntry[] {
  return getAllSkills().map((s) => ({
    id: s.id,
    name: s.name,
    version: s.version,
    path: s.path,
    description: s.description,
    category: s.manifest.category,
    compatibility: s.compatibility,
    compatibilityNote: s.compatibilityNote,
    source: s.source,
    referencesCount: s.referencesCount,
    enabled: s.enabled,
    stageIds: s.manifest.stages
  }))
}

export function toContextEntries(): Array<{ id: string; name: string; description: string; content: string }> {
  return getAllSkills().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    content: s.content
  }))
}
