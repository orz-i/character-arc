import type { AppSettings, AiStreamHandlers, PromptPair } from '../shared-types'
import { requestOpenAiCompatible, requestOpenAiCompatibleStream } from './openai-compat'
import { requestAnthropic, requestAnthropicStream } from './anthropic'
export { fetchModels, type FetchedModel } from './models'

export type StructuredOutputMode = 'json_object' | 'tool_use' | 'prompt_only'

export type StructuredOutputOptions = {
  mode: StructuredOutputMode
}

export async function requestAiText(
  settings: AppSettings,
  prompt: PromptPair,
  maxTokens?: number,
  structured?: StructuredOutputOptions
): Promise<string> {
  return settings.provider === 'anthropic'
    ? requestAnthropic(settings, prompt, maxTokens)
    : requestOpenAiCompatible(settings, prompt, maxTokens, structured)
}

export async function requestAiTextStream(
  settings: AppSettings,
  prompt: PromptPair,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
  maxTokens?: number
): Promise<string> {
  return settings.provider === 'anthropic'
    ? requestAnthropicStream(settings, prompt, handlers, signal, maxTokens)
    : requestOpenAiCompatibleStream(settings, prompt, handlers, signal, maxTokens)
}
