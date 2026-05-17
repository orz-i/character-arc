import type { AppSettings } from '../shared-types'

/** 结构化输出模式：JSON 对象模式、工具调用模式、纯提示词模式 */
export type StructuredOutputMode = 'json_object' | 'tool_use' | 'prompt_only'

/**
 * 根据当前设置的 provider 探测其支持的结构化输出模式
 * @param settings - 应用设置
 * @returns 该 provider 支持的结构化输出模式
 */
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
