import type { AppSettings, AiStreamHandlers, PromptPair } from '../shared-types'
import type {
  AgentMessage,
  AgentRequestParams,
  AgentResponse,
  AgentStopReason,
  AssistantContentBlock,
  ToolDefinition,
  ToolResultBlock
} from '../agent/tools/types'
import { performAiRequest, readErrorMessage } from './http'
import { consumeSseResponse, extractAnthropicDelta } from './sse'

/** Anthropic 请求重试时 max_tokens 的上限 */
const ANTHROPIC_MAX_TOKENS_RETRY_CAP = 16000

/** Anthropic 单次请求的返回结果，成功时包含文本内容，失败时标记是否可因长度不足重试 */
type AnthropicSingleShotOutcome =
  | { ok: true; content: string }
  | { ok: false; retryableLength: boolean; error: Error }

/** 执行单次 Anthropic Messages API 请求（非流式） */
async function runAnthropicAttempt(
  settings: AppSettings,
  prompt: PromptPair,
  maxTokens: number,
  signal: AbortSignal | undefined
): Promise<AnthropicSingleShotOutcome> {
  const response = await performAiRequest(
    `${settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: maxTokens,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      })
    },
    'Anthropic',
    signal
  )
  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
    stop_reason?: string
    error?: { message?: string }
  }
  if (data.error?.message) {
    return { ok: false, retryableLength: false, error: new Error(`Anthropic 接口错误：${data.error.message}`) }
  }
  const content = data.content?.find((item) => item.type === 'text')?.text
  if (!content) {
    if (data.stop_reason === 'max_tokens') {
      return {
        ok: false,
        retryableLength: true,
        error: new Error('Anthropic 返回内容为空：输出被截断（max_tokens 不足或上下文超限），请尝试缩短输入或更换支持更长上下文的模型。')
      }
    }
    return { ok: false, retryableLength: false, error: new Error('Anthropic 返回内容为空，请检查模型是否正常、输入是否过长，或稍后重试。') }
  }
  return { ok: true, content }
}

/**
 * 向 Anthropic Messages API 发送非流式文本生成请求。
 * 若首次因 max_tokens 不足导致内容为空，会自动加倍预算重试一次。
 *
 * @param settings - 应用配置（含 baseUrl、apiKey、model）
 * @param prompt - 系统提示词与用户提示词
 * @param maxTokens - 最大输出 token 数，默认 600
 * @param signal - 用于中止请求的 AbortSignal
 * @returns 生成的文本内容
 */
export async function requestAnthropic(
  settings: AppSettings,
  prompt: PromptPair,
  maxTokens?: number,
  signal?: AbortSignal
): Promise<string> {
  const initialBudget = maxTokens ?? 600
  const first = await runAnthropicAttempt(settings, prompt, initialBudget, signal)
  if (first.ok) return first.content
  if (!first.retryableLength) throw first.error
  const retryBudget = Math.min(initialBudget * 2, ANTHROPIC_MAX_TOKENS_RETRY_CAP)
  if (retryBudget <= initialBudget) throw first.error
  const second = await runAnthropicAttempt(settings, prompt, retryBudget, signal)
  if (second.ok) return second.content
  throw second.error
}

/**
 * 向 Anthropic Messages API 发送流式文本生成请求。
 *
 * @param settings - 应用配置（含 baseUrl、apiKey、model）
 * @param prompt - 系统提示词与用户提示词
 * @param handlers - 流式回调，接收每个文本增量
 * @param signal - 用于中止请求的 AbortSignal
 * @param maxTokens - 最大输出 token 数，默认 600
 * @returns 完整的拼接文本
 */
export async function requestAnthropicStream(
  settings: AppSettings,
  prompt: PromptPair,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
  maxTokens?: number
): Promise<string> {
  const timeoutCtl = new AbortController()
  const timeoutId = setTimeout(() => timeoutCtl.abort(), 180_000)
  const combinedSignal = AbortSignal.any([signal, timeoutCtl.signal])

  try {
    const response = await fetch(
      `${settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        signal: combinedSignal,
        body: JSON.stringify({
          model: settings.model,
          stream: true,
          max_tokens: maxTokens ?? 600,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }]
        })
      }
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Anthropic'))
    }
    let content = ''
    await consumeSseResponse(response, (eventName, data) => {
      if (!data) return
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(data) as Record<string, unknown>
      } catch {
        return
      }
      const delta = extractAnthropicDelta(eventName, payload)
      if (!delta) return
      content += delta
      handlers.onTextDelta(delta)
    })
    return content
  } finally {
    clearTimeout(timeoutId)
  }
}

// ---------------------------------------------------------------------------
// Tool-aware (agentic) request — non-streaming.
// Translates AgentMessage[] / ToolDefinition[] to Anthropic Messages API and
// translates the response back into provider-neutral content blocks.
// ---------------------------------------------------------------------------

export async function requestAnthropicWithTools(
  settings: AppSettings,
  params: AgentRequestParams,
  signal?: AbortSignal
): Promise<AgentResponse> {
  const body = {
    model: settings.model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    tools: params.tools.map(toAnthropicTool),
    messages: params.messages.map(toAnthropicMessage)
  }

  const response = await performAiRequest(
    `${settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    },
    'Anthropic',
    signal
  )

  const data = (await response.json()) as {
    stop_reason?: string
    content?: Array<Record<string, unknown>>
  }

  return {
    stopReason: mapAnthropicStopReason(data.stop_reason),
    contentBlocks: (data.content ?? [])
      .map(fromAnthropicContentBlock)
      .filter((b): b is AssistantContentBlock => b !== null)
  }
}

/** 将通用工具定义转换为 Anthropic API 格式 */
function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }
}

/** 将通用 AgentMessage 转换为 Anthropic Messages API 消息格式 */
function toAnthropicMessage(message: AgentMessage): Record<string, unknown> {
  if (message.role === 'user') {
    if (typeof message.content === 'string') {
      return { role: 'user', content: message.content }
    }
    return {
      role: 'user',
      content: message.content.map((block: ToolResultBlock) => ({
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        ...(block.isError ? { is_error: true } : {})
      }))
    }
  }
  return {
    role: 'assistant',
    content: message.content
      .filter((block) => block.type !== 'reasoning')
      .map((block) =>
        block.type === 'text'
          ? { type: 'text', text: block.text }
          : { type: 'tool_use', id: (block as { id: string }).id, name: (block as { name: string }).name, input: (block as { input: Record<string, unknown> }).input }
      )
  }
}

/** 将 Anthropic 响应中的内容块转换为通用 AssistantContentBlock */
function fromAnthropicContentBlock(block: Record<string, unknown>): AssistantContentBlock | null {
  const type = String(block.type ?? '')
  if (type === 'text' && typeof block.text === 'string') {
    return { type: 'text', text: block.text }
  }
  if (type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
    const input = (block.input ?? {}) as Record<string, unknown>
    return { type: 'tool_use', id: block.id, name: block.name, input }
  }
  return null
}

/** 将 Anthropic 停止原因映射为通用的 AgentStopReason */
function mapAnthropicStopReason(reason: string | undefined): AgentStopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end_turn'
    case 'tool_use':
      return 'tool_use'
    case 'max_tokens':
      return 'max_tokens'
    default:
      return 'other'
  }
}
