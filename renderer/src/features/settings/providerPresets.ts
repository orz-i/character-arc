import type { AppSettings } from '@/types/app'

export interface ProviderPreset {
  label: string
  value: string
  model: string
  baseUrl: string
  hint: string
}

export const providerPresets: ProviderPreset[] = [
  { label: 'DeepSeek', value: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', hint: '官方直连，适合通用写作和对话。模型示例：deepseek-chat / deepseek-reasoner。' },
  { label: '阿里云百炼 / 通义千问', value: 'qwen', model: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', hint: 'OpenAI 兼容模式。模型示例：qwen-plus / qwen-max / qwen3-coder-plus。' },
  { label: '智谱 GLM', value: 'zhipu', model: 'glm-4.7', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', hint: '官方通用端点。模型示例：glm-4.7 / glm-4.5-air。' },
  { label: 'Moonshot / Kimi', value: 'moonshot', model: 'kimi-k2.5', baseUrl: 'https://api.moonshot.cn/v1', hint: '官方 OpenAI 兼容接口。模型示例：kimi-k2.5 / moonshot-v1-128k。' },
  { label: 'SiliconFlow', value: 'siliconflow', model: 'Qwen/Qwen2.5-72B-Instruct', baseUrl: 'https://api.siliconflow.cn/v1', hint: '聚合大量开源模型，模型名通常使用完整 ID。示例：Qwen/Qwen2.5-72B-Instruct。' },
  { label: 'OpenAI', value: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', hint: '官方 OpenAI 接口。' },
  { label: 'Anthropic', value: 'anthropic', model: 'claude-3-5-sonnet-latest', baseUrl: 'https://api.anthropic.com', hint: 'Claude 原生协议，不走 OpenAI 兼容格式。' },
  { label: '本地模型 / Ollama', value: 'ollama', model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434/v1', hint: '本地运行，无需外网。模型示例：llama3.2 / qwen2.5 / deepseek-r1。' },
  { label: 'New API 网关', value: 'new-api', model: 'qwen-plus', baseUrl: 'http://127.0.0.1:3000/v1', hint: '开源聚合网关预设。把官方渠道接进 New API 后，这里填网关 token 即可。' },
  { label: 'One API 网关', value: 'one-api', model: 'qwen-plus', baseUrl: 'http://127.0.0.1:3000/v1', hint: '开源统一分发网关预设。适合把多家国产模型统一到一个地址下。' }
]

export const providerOptions = providerPresets.map(({ label, value }) => ({ label, value }))

export function getProviderPreset(provider: string): ProviderPreset {
  return providerPresets.find((item) => item.value === provider) ?? providerPresets[0]
}

export function resolveProviderDefaults(provider: string): Pick<AppSettings, 'model' | 'baseUrl'> {
  const preset = getProviderPreset(provider)
  return {
    model: preset.model,
    baseUrl: preset.baseUrl
  }
}
