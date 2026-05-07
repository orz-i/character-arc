import type { AiTaskName, AiTaskResult, PromptPair, AiTaskKnowledgeContext } from '../shared-types'
import type { PromptCapabilityId } from '../prompts/capability'
import type { SkillSelection } from '../skills/types'

export type PromptBuildInput = {
  context: Record<string, unknown>
  skills: SkillSelection[]
  knowledgeContext?: AiTaskKnowledgeContext
  capabilityPreamble: PromptPair
  skillsBlock: string
  knowledgeBlock: string
}

export interface TaskHandler {
  name: AiTaskName
  outputType: 'json' | 'text'
  defaultCapabilities: PromptCapabilityId[]
  buildPrompt(input: PromptBuildInput): PromptPair
  normalize(raw: string): AiTaskResult
  validate(result: AiTaskResult): boolean
  resolveMaxTokens?(input: PromptBuildInput): number
}

export function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] ?? text
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  const jsonSlice = firstBrace >= 0 && lastBrace >= 0 ? raw.slice(firstBrace, lastBrace + 1) : raw
  return JSON.parse(jsonSlice) as Record<string, unknown>
}

export function normalizeAssistantText(text: string): { content: string } {
  const cleaned = text
    .replace(/```[\w-]*\n?/g, '')
    .replace(/```/g, '')
    .trim()
  return { content: cleaned }
}
