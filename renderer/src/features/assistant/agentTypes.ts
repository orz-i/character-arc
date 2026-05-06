import type {
  AgentProposal,
  AgentProposalPreview,
  AssistantActionProposalResult,
  AssistantCommandTarget,
  AssistantCommandType
} from '@/types/app'

export function createAgentProposal(input: {
  commandType: AssistantCommandType
  target: AssistantCommandTarget
  reason?: string
  preview: AgentProposalPreview
  destructive?: boolean
  requiresConfirmation?: boolean
  payload: Record<string, unknown>
}): AgentProposal {
  return {
    id: `agent-proposal-${Date.now()}`,
    commandType: input.commandType,
    target: input.target,
    reason: input.reason?.trim() || 'AI 提议执行一个写作动作。',
    preview: input.preview,
    destructive: Boolean(input.destructive),
    requiresConfirmation: input.requiresConfirmation !== false,
    status: 'pending',
    payload: input.payload,
    createdAt: new Date().toISOString()
  }
}

export function createAgentProposalFromResult(input: AssistantActionProposalResult): AgentProposal {
  return createAgentProposal({
    commandType: input.commandType,
    target: input.target,
    reason: input.reason,
    preview: {
      title: input.title,
      summary: input.summary,
      before: input.before,
      after: input.after
    },
    destructive: input.destructive,
    requiresConfirmation: input.requiresConfirmation,
    payload: input.payload
  })
}

export function isDestructiveAssistantTarget(target: AssistantCommandTarget): boolean {
  return target === 'chapter-content'
    || target === 'chapter-title'
    || target === 'chapter-summary'
    || target === 'workflow-document'
    || target === 'knowledge-document'
}
