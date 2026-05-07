import type {
  AiTaskPayload,
  AiTaskKnowledgeContext,
  AiTaskResponse,
  AiTaskResult,
  AppSettings,
  AiStreamHandlers
} from '../shared-types'
import { normalizeSettings, validateSettings, resolveMaxTokens } from '../settings'
import { getTaskHandler } from '../tasks'
import { pickSkillsFor } from '../skills'
import { requestAiText, requestAiTextStream } from '../transport'
import type { StructuredOutputOptions } from '../transport'
import { buildPromptInput } from './context-builder'
import { probeStructuredOutputMode } from './capability-probe'
import { buildRunMeta, buildResponsePreview } from './run-meta'
import { logPrompt } from './logging'
import { buildRepairPrompt } from '../prompts/repair'

export async function runAiTask(
  task: AiTaskPayload,
  knowledgeContext?: AiTaskKnowledgeContext
): Promise<AiTaskResponse> {
  const settings = normalizeSettings(task.settings)
  validateSettings(settings)
  const startedAt = new Date().toISOString()

  const handler = getTaskHandler(task.task)
  const skills = pickSkillsFor(task)
  const usedSkillIds = skills.map((s) => s.id)

  const input = buildPromptInput(task, skills, knowledgeContext)
  const prompt = handler.buildPrompt(input)
  const maxTokens = handler.resolveMaxTokens?.(input) ?? resolveMaxTokens(task)

  logPrompt('REQUEST', settings, prompt, task.task, usedSkillIds)

  const structured = resolveStructuredOptions(settings, handler.outputType)

  try {
    let rawText = await requestAiText(settings, prompt, maxTokens, structured)
    let result = handler.normalize(rawText)
    let repairTriggered = false

    if (handler.outputType === 'json' && !handler.validate(result)) {
      const repairPromptPair = buildRepairPrompt(prompt.system, prompt.user, rawText)
      logPrompt('REPAIR', settings, repairPromptPair, task.task, usedSkillIds)
      rawText = await requestAiText(settings, repairPromptPair, maxTokens)
      result = handler.normalize(rawText)
      repairTriggered = true

      if (!handler.validate(result)) {
        throw new Error('AI 返回的结构化结果不完整，请稍后重试或调整提示词。')
      }
    }

    const finishedAt = new Date().toISOString()
    return {
      result,
      meta: buildRunMeta(
        task.task,
        String(task.context.projectId ?? '').trim(),
        String(task.context.chapterId ?? '').trim() || undefined,
        settings,
        'success',
        startedAt,
        finishedAt,
        knowledgeContext?.usedKnowledge ?? [],
        usedSkillIds,
        repairTriggered,
        buildResponsePreview(result),
        ''
      )
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'AI 调用失败'
    throw Object.assign(new Error(message), {
      aiRunMeta: buildRunMeta(
        task.task,
        String(task.context.projectId ?? '').trim(),
        String(task.context.chapterId ?? '').trim() || undefined,
        settings,
        'error',
        startedAt,
        finishedAt,
        knowledgeContext?.usedKnowledge ?? [],
        usedSkillIds,
        false,
        '',
        message
      )
    })
  }
}

export async function streamAiTask(
  task: AiTaskPayload,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
  knowledgeContext?: AiTaskKnowledgeContext
): Promise<AiTaskResponse> {
  if (task.task !== 'chapter-assistant' && task.task !== 'chapter-first-draft') {
    throw new Error('当前流式输出仅支持章节创作助理和章节初稿生成。')
  }

  const settings = normalizeSettings(task.settings)
  validateSettings(settings)
  const startedAt = new Date().toISOString()

  const taskHandler = getTaskHandler(task.task)
  const skills = pickSkillsFor(task)
  const usedSkillIds = skills.map((s) => s.id)

  const input = buildPromptInput(task, skills, knowledgeContext)
  const prompt = taskHandler.buildPrompt(input)
  const maxTokens = taskHandler.resolveMaxTokens?.(input) ?? resolveMaxTokens(task)

  logPrompt('STREAM', settings, prompt, task.task, usedSkillIds)

  try {
    const rawText = await requestAiTextStream(settings, prompt, handlers, signal, maxTokens)
    const result = taskHandler.normalize(rawText)
    const finishedAt = new Date().toISOString()
    const status = signal.aborted ? 'canceled' : 'success'

    return {
      result,
      meta: buildRunMeta(
        task.task,
        String(task.context.projectId ?? '').trim(),
        String(task.context.chapterId ?? '').trim() || undefined,
        settings,
        status,
        startedAt,
        finishedAt,
        knowledgeContext?.usedKnowledge ?? [],
        usedSkillIds,
        false,
        buildResponsePreview(result),
        ''
      )
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const status = signal.aborted ? 'canceled' : 'error'
    const message = signal.aborted ? '' : (error instanceof Error ? error.message : 'AI 流式调用失败')
    throw Object.assign(new Error(message || 'AI 流式调用失败'), {
      aiRunMeta: buildRunMeta(
        task.task,
        String(task.context.projectId ?? '').trim(),
        String(task.context.chapterId ?? '').trim() || undefined,
        settings,
        status,
        startedAt,
        finishedAt,
        knowledgeContext?.usedKnowledge ?? [],
        usedSkillIds,
        false,
        '',
        message
      )
    })
  }
}

export async function testAiConnection(rawSettings: AppSettings): Promise<{ provider: string; model: string }> {
  const settings = normalizeSettings(rawSettings)
  validateSettings(settings)
  const probePrompt = {
    system: 'You are a connectivity probe. Reply with CONNECTED only.',
    user: 'Return CONNECTED'
  }
  logPrompt('TEST', settings, probePrompt, 'test-connection')
  const text = await requestAiText(settings, probePrompt)
  if (!text.trim()) {
    throw new Error('模型连接成功，但没有返回可读内容。')
  }
  return { provider: settings.provider, model: settings.model }
}

function resolveStructuredOptions(settings: AppSettings, outputType: 'json' | 'text'): StructuredOutputOptions | undefined {
  if (outputType !== 'json') return undefined
  const mode = probeStructuredOutputMode(settings)
  if (mode === 'prompt_only') return undefined
  return { mode }
}
