import type { KnowledgeDocumentSourceType, WorkflowDocumentKey } from '@/types/app'

type AssistantCommandGuardContext = {
  hasSelectedProject: boolean
  hasWorkflowVolume: boolean
  availableWorkflowDocumentKeys: WorkflowDocumentKey[]
}

type AssistantCommandGuardResult = {
  valid: boolean
  issues: string[]
}

const WORKFLOW_DOCUMENT_KEYS = new Set<WorkflowDocumentKey>([
  'task_plan',
  'findings',
  'progress',
  'current_status',
  'novel_setting',
  'character_relationships',
  'pending_hooks',
  'resource_ledger'
])

const PROJECT_KNOWLEDGE_SOURCE_TYPES = new Set<KnowledgeDocumentSourceType>([
  'workflow-document',
  'canon-fact',
  'chapter-summary'
])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveExpectedTarget(type: CharacterArcAssistantCommand['type']): CharacterArcAssistantCommand['target'] {
  switch (type) {
    case 'insert-into-chapter':
      return 'chapter-content'
    case 'update-chapter-title':
      return 'chapter-title'
    case 'update-chapter-summary':
      return 'chapter-summary'
    case 'create-outline-item':
      return 'outline-item'
    case 'append-workflow-document-entry':
    case 'update-workflow-document':
      return 'workflow-document'
    case 'save-knowledge-document':
      return 'knowledge-document'
  }
}

function validateProposalProtection(payload: CharacterArcAssistantCommand, issues: string[]): void {
  if (payload.kind !== 'proposal') {
    return
  }

  if (payload.destructive && payload.requiresConfirmation === false) {
    issues.push('破坏性提议必须要求用户确认。')
  }

  switch (payload.type) {
    case 'insert-into-chapter':
      if (payload.mode === 'replace-selection') {
        if (!payload.destructive) {
          issues.push('替换选区提议必须标记为破坏性写入。')
        }
        if (payload.requiresConfirmation === false) {
          issues.push('替换选区提议必须要求用户确认。')
        }
      }
      break
    case 'update-chapter-title':
    case 'update-chapter-summary':
    case 'update-workflow-document':
      if (!payload.destructive) {
        issues.push('覆盖已有内容的提议必须标记为破坏性写入。')
      }
      if (payload.requiresConfirmation === false) {
        issues.push('覆盖已有内容的提议必须要求用户确认。')
      }
      break
    case 'append-workflow-document-entry':
      if (payload.destructive) {
        issues.push('追加流程记录不应标记为破坏性写入。')
      }
      if (payload.requiresConfirmation === false) {
        issues.push('追加流程记录提议必须要求用户确认。')
      }
      break
    case 'save-knowledge-document':
      if (payload.requiresConfirmation === false) {
        issues.push('写入项目知识库的提议必须要求用户确认。')
      }
      break
    case 'create-outline-item':
      if (payload.destructive) {
        issues.push('创建大纲节点不应标记为破坏性写入。')
      }
      break
  }
}

export function validateAssistantCommand(
  payload: CharacterArcAssistantCommand,
  context: AssistantCommandGuardContext
): AssistantCommandGuardResult {
  const issues: string[] = []
  const expectedTarget = resolveExpectedTarget(payload.type)

  if (payload.target && payload.target !== expectedTarget) {
    issues.push(`动作目标不匹配：${payload.type} 只能写入 ${expectedTarget}。`)
  }

  switch (payload.type) {
    case 'insert-into-chapter': {
      if (!isNonEmptyString(payload.content)) {
        issues.push('正文写入内容不能为空。')
      }
      if (payload.mode !== 'cursor' && payload.mode !== 'append' && payload.mode !== 'replace-selection') {
        issues.push('正文写入模式无效。')
      }
      break
    }
    case 'update-chapter-title': {
      if (!isNonEmptyString(payload.value)) {
        issues.push('章节标题不能为空。')
      }
      if (typeof payload.value === 'string' && payload.value.includes('\n')) {
        issues.push('章节标题必须是单行文本。')
      }
      break
    }
    case 'update-chapter-summary': {
      if (!isNonEmptyString(payload.value)) {
        issues.push('章节摘要不能为空。')
      }
      break
    }
    case 'create-outline-item': {
      const outlinePayload = payload.payload && typeof payload.payload === 'object'
        ? payload.payload as Record<string, unknown>
        : null
      if (!outlinePayload) {
        issues.push('大纲提议缺少有效 payload。')
        break
      }
      if (!isNonEmptyString(outlinePayload.title)) {
        issues.push('大纲节点标题不能为空。')
      }
      if (!isNonEmptyString(outlinePayload.summary)) {
        issues.push('大纲节点摘要不能为空。')
      }
      break
    }
    case 'append-workflow-document-entry': {
      if (!context.hasWorkflowVolume) {
        issues.push('当前没有可写入的流程分卷。')
      }
      if (!WORKFLOW_DOCUMENT_KEYS.has(payload.documentKey)) {
        issues.push('流程文档 key 无效。')
      }
      if (!context.availableWorkflowDocumentKeys.includes(payload.documentKey)) {
        issues.push('目标流程文档在当前分卷中不可用。')
      }
      if (!isNonEmptyString(payload.entryTitle)) {
        issues.push('流程记录条目标题不能为空。')
      }
      if (!isNonEmptyString(payload.content)) {
        issues.push('流程记录正文不能为空。')
      }
      break
    }
    case 'update-workflow-document': {
      if (!context.hasWorkflowVolume) {
        issues.push('当前没有可写入的流程分卷。')
      }
      if (!WORKFLOW_DOCUMENT_KEYS.has(payload.documentKey)) {
        issues.push('流程文档 key 无效。')
      }
      if (!context.availableWorkflowDocumentKeys.includes(payload.documentKey)) {
        issues.push('目标流程文档在当前分卷中不可用。')
      }
      if (!isNonEmptyString(payload.content)) {
        issues.push('流程文档正文不能为空。')
      }
      break
    }
    case 'save-knowledge-document': {
      if (!context.hasSelectedProject) {
        issues.push('当前没有可写入知识库的项目。')
      }
      const document = payload.document && typeof payload.document === 'object'
        ? payload.document as Record<string, unknown>
        : null
      if (!document) {
        issues.push('知识文档 payload 无效。')
        break
      }
      if (!isNonEmptyString(document.title)) {
        issues.push('知识标题不能为空。')
      }
      if (!isNonEmptyString(document.content)) {
        issues.push('知识正文不能为空。')
      }
      if (!isNonEmptyString(document.summary)) {
        issues.push('知识摘要不能为空。')
      }
      const sourceType = String(document.sourceType ?? '').trim() as KnowledgeDocumentSourceType
      if (!PROJECT_KNOWLEDGE_SOURCE_TYPES.has(sourceType)) {
        issues.push('知识来源类型必须是 workflow-document、canon-fact 或 chapter-summary。')
      }
      break
    }
  }

  validateProposalProtection(payload, issues)

  return {
    valid: issues.length === 0,
    issues
  }
}
