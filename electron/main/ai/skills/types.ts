import type { AiTaskName } from '../shared-types'

export type SkillCategory = 'market' | 'analysis' | 'writing' | 'polish' | 'cover' | 'tool'

export type SkillCompatibility = 'native' | 'partial' | 'external-only'

export type SkillStageId = 'reference' | 'premise' | 'setting' | 'outline' | 'draft'

export type SkillReferenceRule = {
  file: string
  loadWhen?: {
    task?: AiTaskName
    chapterIndexMax?: number
  }
}

export type SkillManifest = {
  category: SkillCategory
  tasks: AiTaskName[]
  stages: SkillStageId[]
  triggers: string[]
  priority: number
  references: SkillReferenceRule[]
}

export type SkillDefinition = {
  id: string
  name: string
  version: string
  path: string
  description: string
  source: string
  manifest: SkillManifest
  compatibility: SkillCompatibility
  compatibilityNote: string
  enabled: boolean
  referencesCount: number
  content: string
}

export type SkillSelection = {
  id: string
  name: string
  content: string
  referenceContents: Array<{ file: string; content: string }>
  score: number
}

export type SkillScanEntry = {
  id: string
  name: string
  version: string
  path: string
  description: string
  category: SkillCategory
  compatibility: SkillCompatibility
  compatibilityNote: string
  source: string
  referencesCount: number
  enabled: boolean
  stageIds: SkillStageId[]
}
