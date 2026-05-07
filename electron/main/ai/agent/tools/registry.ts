import type {
  AssistantToolUseBlock,
  Tool,
  ToolContext,
  ToolDefinition,
  ToolResultBlock
} from './types'

export type ToolRegistry = ReadonlyMap<string, Tool>

export function createToolRegistry(tools: Tool[]): ToolRegistry {
  const map = new Map<string, Tool>()
  for (const tool of tools) {
    if (map.has(tool.definition.name)) {
      throw new Error(`重复注册的工具：${tool.definition.name}`)
    }
    map.set(tool.definition.name, tool)
  }
  return map
}

export function listToolDefinitions(registry: ToolRegistry): ToolDefinition[] {
  return Array.from(registry.values()).map((tool) => tool.definition)
}

/**
 * 执行一次模型发出的 tool_use，把结果转成 tool_result block 喂回 loop。
 * 失败/异常一律包成带 isError=true 的 ToolResultBlock，绝不抛出——
 * 抛出会终止整个 agent loop，但模型有时能从 tool_result error 里自我修正。
 */
export async function dispatchTool(
  registry: ToolRegistry,
  toolUse: AssistantToolUseBlock,
  ctx: ToolContext
): Promise<ToolResultBlock> {
  const tool = registry.get(toolUse.name)
  if (!tool) {
    return {
      type: 'tool_result',
      toolUseId: toolUse.id,
      content: `未注册的工具：${toolUse.name}。可用工具：${Array.from(registry.keys()).join(', ') || '(无)'}`,
      isError: true
    }
  }

  try {
    const result = await tool.handler(toolUse.input ?? {}, ctx)
    return {
      type: 'tool_result',
      toolUseId: toolUse.id,
      content: result.content,
      ...(result.isError ? { isError: true } : {})
    }
  } catch (error) {
    return {
      type: 'tool_result',
      toolUseId: toolUse.id,
      content: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
      isError: true
    }
  }
}
