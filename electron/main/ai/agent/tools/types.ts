/**
 * Provider-neutral tool-use protocol shared by Anthropic Messages API
 * (tool_use blocks) and OpenAI-compatible Chat Completions (tool_calls).
 *
 * Transports translate to/from these shapes; the agent loop only deals
 * with these types.
 */

/** 工具输入参数的 JSON Schema 定义 */
export type ToolInputSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

/** 工具定义，包含名称、描述和输入 schema */
export type ToolDefinition = {
  name: string
  description: string
  inputSchema: ToolInputSchema
}

/** 助手返回的纯文本内容块 */
export type AssistantTextBlock = { type: 'text'; text: string }

/** 助手返回的工具调用内容块 */
export type AssistantToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** 助手返回的推理内容块 */
export type AssistantReasoningBlock = { type: 'reasoning'; reasoning: string }

/** 助手内容块的联合类型：文本、工具调用或推理 */
export type AssistantContentBlock = AssistantTextBlock | AssistantToolUseBlock | AssistantReasoningBlock

/** 工具执行结果块，用于回传给模型 */
export type ToolResultBlock = {
  type: 'tool_result'
  toolUseId: string
  content: string
  isError?: boolean
}

/** Agent 对话中的单条消息（用户或助手） */
export type AgentMessage =
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: AssistantContentBlock[] }

/** 模型停止生成的原因 */
export type AgentStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'other'

/** 模型单次推理的完整响应 */
export type AgentResponse = {
  stopReason: AgentStopReason
  contentBlocks: AssistantContentBlock[]
}

/** 发送给模型的推理请求参数 */
export type AgentRequestParams = {
  system: string
  messages: AgentMessage[]
  tools: ToolDefinition[]
  maxTokens?: number
}

/** 工具执行时的上下文信息 */
export type ToolContext = {
  signal: AbortSignal
  projectId: string
}

/** 工具处理函数的返回结果 */
export type ToolHandlerResult = {
  content: string
  isError?: boolean
}

/** 工具处理函数签名 */
export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext
) => Promise<ToolHandlerResult>

/** 完整的工具定义，包含 schema 描述和处理函数 */
export type Tool = {
  definition: ToolDefinition
  handler: ToolHandler
}

/**
 * 判断内容块是否为工具调用块
 * @param block - 助手内容块
 * @returns 是否为工具调用块
 */
export function isToolUseBlock(block: AssistantContentBlock): block is AssistantToolUseBlock {
  return block.type === 'tool_use'
}

/**
 * 判断内容块是否为纯文本块
 * @param block - 助手内容块
 * @returns 是否为纯文本块
 */
export function isTextBlock(block: AssistantContentBlock): block is AssistantTextBlock {
  return block.type === 'text'
}
