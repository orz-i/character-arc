import type { AiTaskPayload, AiTaskKnowledgeContext, PromptPair } from '../shared-types'
import type { SkillSelection } from '../skills/types'
import type { PromptBuildInput } from '../tasks/base'
import type { PromptCapabilityId } from '../prompts/capability'
import { buildCapabilityContext, getDefaultCapabilities } from '../prompts/capability'
import { formatRetrievedKnowledge, formatMountedSkills } from '../prompts/shared'

export function buildPromptInput(
  task: AiTaskPayload,
  skills: SkillSelection[],
  knowledgeContext?: AiTaskKnowledgeContext,
  extraCapabilities?: PromptCapabilityId[]
): PromptBuildInput {
  const capabilities = resolveCapabilities(task, extraCapabilities)
  const capabilityPreamble = buildCapabilityContext(task.task, capabilities)
  const skillsBlock = formatMountedSkills(skills)
  const knowledgeBlock = formatRetrievedKnowledge(knowledgeContext?.usedKnowledge)

  return {
    context: task.context,
    skills,
    knowledgeContext,
    capabilityPreamble,
    skillsBlock,
    knowledgeBlock
  }
}

function resolveCapabilities(
  task: AiTaskPayload,
  extra?: PromptCapabilityId[]
): PromptCapabilityId[] {
  const defaults = getDefaultCapabilities(task.task)
  const capabilityIds = new Set<PromptCapabilityId>(defaults)

  if (extra) {
    for (const id of extra) capabilityIds.add(id)
  }

  const context = task.context ?? {}
  if (hasContextHint(context, 'workflowDocuments', 'requestedDocuments', 'stageId')) capabilityIds.add('workflow')
  if (hasContextHint(context, 'worldviewEntries', 'worldviewTitles')) capabilityIds.add('worldview')
  if (hasContextHint(context, 'characters', 'characterNames')) capabilityIds.add('characters')
  if (hasContextHint(context, 'organizations', 'characterRelationships', 'organizationMemberships')) capabilityIds.add('relations')
  if (hasContextHint(context, 'inspirationEntries', 'existingInspirationTitles')) capabilityIds.add('inspiration')
  if (hasContextHint(context, 'outlineItems', 'currentVolumeOutlineItems', 'outlineTitles', 'currentOutlineItem')) capabilityIds.add('outline')
  if (hasContextHint(context, 'chapterContent', 'chapterTitle', 'relatedChapters')) capabilityIds.add('chapters')
  if (Boolean(String(context.writingStyleLabel ?? '').trim() || String(context.writingStylePrompt ?? '').trim())) capabilityIds.add('writing-style')
  if (Array.isArray(context.projectSkills) && context.projectSkills.length > 0) capabilityIds.add('project-skills')

  return Array.from(capabilityIds)
}

function hasContextHint(context: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => {
    const value = context[key]
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' || typeof value === 'object'
  })
}
