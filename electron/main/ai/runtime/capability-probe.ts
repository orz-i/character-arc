import type { AppSettings } from '../shared-types'

export type StructuredOutputMode = 'json_object' | 'tool_use' | 'prompt_only'

export function probeStructuredOutputMode(settings: AppSettings): StructuredOutputMode {
  switch (settings.provider) {
    case 'anthropic':
      return 'tool_use'
    case 'openai':
    case 'deepseek':
    case 'qwen':
    case 'zhipu':
    case 'moonshot':
    case 'siliconflow':
      return 'json_object'
    case 'ollama':
    case 'new-api':
    case 'one-api':
    default:
      return 'prompt_only'
  }
}
