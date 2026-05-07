import type { AiRunMeta, AiRunKnowledgeItem, AiTaskName, AppSettings, AiTaskResult } from '../shared-types'

export function buildRunMeta(
  task: AiTaskName,
  projectId: string,
  chapterId: string | undefined,
  settings: AppSettings,
  status: AiRunMeta['status'],
  startedAt: string,
  finishedAt: string,
  usedKnowledge: AiRunKnowledgeItem[],
  usedSkills: string[],
  repairTriggered: boolean,
  responsePreview: string,
  error: string
): AiRunMeta {
  const startedAtMs = new Date(startedAt).getTime()
  const finishedAtMs = new Date(finishedAt).getTime()
  const durationMs = Number.isFinite(startedAtMs) && Number.isFinite(finishedAtMs)
    ? Math.max(0, finishedAtMs - startedAtMs)
    : undefined

  return {
    task,
    projectId,
    chapterId,
    provider: settings.provider,
    model: settings.model,
    status,
    startedAt,
    finishedAt,
    durationMs,
    usedKnowledge: usedKnowledge.slice(0, 5),
    usedSkills,
    repairTriggered,
    error,
    responsePreview: responsePreview.trim().slice(0, 240)
  }
}

export function buildResponsePreview(result: AiTaskResult): string {
  if ('content' in result && typeof result.content === 'string') {
    return result.content.trim().slice(0, 240)
  }
  try {
    return JSON.stringify(result).slice(0, 240)
  } catch {
    return ''
  }
}
