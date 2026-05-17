import type { AiTaskName, AiTaskPayload, AppSettings, ProviderName } from './shared-types'

/**
 * 根据供应商名称返回其默认 Base URL 和推荐模型。
 * 用于用户未手动填写时的兜底值。
 *
 * @param provider - 供应商标识（如 'openai'、'deepseek'）
 * @returns 默认的 baseUrl 和 model
 */
export function resolveProviderDefaults(provider: ProviderName): { baseUrl: string; model: string } {
  switch (provider) {
    case 'openai':
      return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
    case 'deepseek':
      return { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }
    case 'qwen':
      return { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' }
    case 'zhipu':
      return { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.7' }
    case 'moonshot':
      return { baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.5' }
    case 'siliconflow':
      return { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' }
    case 'anthropic':
      return { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-latest' }
    case 'ollama':
      return { baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' }
    case 'new-api':
    case 'one-api':
      return { baseUrl: 'http://127.0.0.1:3000/v1', model: 'qwen-plus' }
    default:
      return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
  }
}

/**
 * 规范化用户设置：trim、转小写、缺失字段回退到供应商默认值。
 *
 * @param settings - 用户原始设置
 * @returns 规范化后的 AppSettings
 */
export function normalizeSettings(settings: AppSettings): AppSettings {
  const provider = settings.provider?.trim().toLowerCase() || 'deepseek'
  const defaults = resolveProviderDefaults(provider)
  return {
    provider,
    model: settings.model?.trim() || defaults.model,
    apiKey: settings.apiKey?.trim() || '',
    baseUrl: settings.baseUrl?.trim() || defaults.baseUrl,
    embeddingModel: settings.embeddingModel?.trim() || '',
    imageModel: settings.imageModel?.trim() || '',
    imageApiKey: settings.imageApiKey?.trim() || '',
    imageBaseUrl: settings.imageBaseUrl?.trim() || ''
  }
}

/**
 * 判断 baseUrl 是否指向本地服务（127.0.0.1 或 localhost）。
 * 本地服务通常不需要 API Key。
 *
 * @param baseUrl - API 基础地址
 * @returns 是否为本地地址
 */
export function isLocalBaseUrl(baseUrl: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(baseUrl.trim())
}

/**
 * 判断当前设置是否需要 API Key。
 * Ollama 和本地地址的供应商不需要 Key。
 *
 * @param settings - 当前 AI 设置
 * @returns 是否需要填写 API Key
 */
export function requiresApiKey(settings: AppSettings): boolean {
  if (settings.provider === 'ollama') {
    return false
  }
  return !isLocalBaseUrl(settings.baseUrl)
}

/**
 * 校验 AI 设置的必填项，不满足时抛出带提示信息的 Error。
 *
 * @param settings - 待校验的设置
 * @throws 模型名称、Base URL 或 API Key 缺失时抛错
 */
export function validateSettings(settings: AppSettings): void {
  if (!settings.model.trim()) {
    throw new Error('请先填写模型名称。')
  }
  if (!settings.baseUrl.trim()) {
    throw new Error('请先填写 Base URL。')
  }
  if (requiresApiKey(settings) && !settings.apiKey.trim()) {
    throw new Error('当前模型供应商需要 API Key，请先在设置页填写。')
  }
}

/**
 * 任务级 max_tokens 兜底。runtime 调用 transport 前会先尝试让 TaskHandler.resolveMaxTokens 决定，
 * 这里只是没声明时的全局回退。
 */
export function resolveMaxTokens(task?: AiTaskPayload): number | undefined {
  switch (task?.task) {
    case 'project-bootstrap':
      return 1500
    case 'chapter-analysis':
    case 'reference-style-chunk':
    case 'reference-style-analysis':
    case 'inspiration-pack':
    case 'plot-thread-detect':
    case 'outline-batch':
    case 'outline-chain':
    case 'workflow-documents':
      return 1200
    case 'chapter-scene-plan':
      return 400
    case 'chapter-first-draft':
      return 4000
    case 'chapter-assistant':
      switch (String(task.context.responseLength ?? 'medium')) {
        case 'short':
          return 500
        case 'long':
          return 1400
        default:
          return 900
      }
    case 'worldview-entry':
    case 'character-card':
    case 'outline-item':
      return 700
    default:
      return undefined
  }
}

/**
 * 走 agent loop（progressive skill disclosure + tool calling）的 task 白名单。
 * 不在表里的 task 走原有单次调用链路，行为零变更。
 *
 * 渐进式上线策略：先放 outline-batch 做灰度（JSON 输出，验证容易；不影响章节流式 UX）。
 * 验证 OK 后逐步扩到 outline-chain / project-bootstrap / chapter-first-draft 等。
 */
export const AGENT_TASK_WHITELIST: ReadonlySet<AiTaskName> = new Set([
  'outline-batch',
  'reference-deep-analyze',
  'style-fingerprint-extract'
])
