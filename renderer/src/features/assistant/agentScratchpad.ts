import { novelWorkflowStageDefinitions } from '@/features/novelWorkflow/stages'
import type {
  ChapterDraft,
  NovelWorkflowStageId,
  NovelWorkflowStageState,
  WorkflowDocument,
  WorkflowDocumentKey
} from '@/types/app'

type AgentScratchpadContext = {
  projectTitle?: string
  activeVolumeTitle?: string
  selectedChapter?: Pick<ChapterDraft, 'title' | 'summary' | 'status'>
  workflowDocuments: WorkflowDocument[]
  stageStates: NovelWorkflowStageState[]
  now?: string
}

type AgentScratchpadAppendEntry = {
  documentKey: WorkflowDocumentKey
  entryTitle: string
  content: string
}

type AgentScratchpadDocumentUpdate = {
  documentKey: WorkflowDocumentKey
  content: string
}

export type AgentScratchpadSyncPlan = {
  appendEntries: AgentScratchpadAppendEntry[]
  updates: AgentScratchpadDocumentUpdate[]
}

const AGENT_MANAGED_STATUS_MARKER = '<!-- agent-managed-current-status -->'
const SELF_MANAGED_DOCUMENT_KEYS = new Set<WorkflowDocumentKey>(['progress', 'task_plan', 'current_status'])

function isPlaceholderDocument(content: string): boolean {
  return /待 AI 生成|待补充/.test(content) && content.trim().split('\n').length <= 3
}

function getWorkflowDocument(
  documents: WorkflowDocument[],
  key: WorkflowDocumentKey
): WorkflowDocument | undefined {
  return documents.find((document) => document.key === key)
}

function resolveActiveStageId(stageStates: NovelWorkflowStageState[]): NovelWorkflowStageId | undefined {
  return stageStates.find((stage) => stage.status === 'doing')?.id ?? stageStates[0]?.id
}

function resolveStageTitle(stageStates: NovelWorkflowStageState[]): string {
  const stageId = resolveActiveStageId(stageStates)
  return novelWorkflowStageDefinitions.find((stage) => stage.id === stageId)?.title ?? '未指定阶段'
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    hour12: false
  })
}

function extractDocumentHeader(content: string, fallback: string): string {
  const firstLine = content.split('\n')[0]?.trim()
  return firstLine?.startsWith('#') ? firstLine : fallback
}

function buildProgressEntry(
  payload: CharacterArcAssistantCommand,
  context: AgentScratchpadContext,
  now: string
): AgentScratchpadAppendEntry | null {
  const stageTitle = resolveStageTitle(context.stageStates)
  const chapterTitle = context.selectedChapter?.title?.trim() || '当前章节'
  const volumeTitle = context.activeVolumeTitle?.trim() || '当前分卷'
  const summaryPreview = payload.preview?.after?.trim() || payload.preview?.summary?.trim() || ''

  switch (payload.type) {
    case 'insert-into-chapter':
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 正文处理`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 章节：${chapterTitle}`,
          `- 动作：${payload.mode === 'replace-selection' ? '替换选区' : payload.mode === 'append' ? '追加正文' : '插入正文'}`,
          payload.reason?.trim() ? `- 说明：${payload.reason.trim()}` : '',
          summaryPreview ? `- 摘要：${summaryPreview}` : ''
        ].filter(Boolean).join('\n')
      }
    case 'update-chapter-title':
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 更新章节标题`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 原章节：${chapterTitle}`,
          `- 新标题：${payload.value.trim()}`
        ].join('\n')
      }
    case 'update-chapter-summary':
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 更新章节摘要`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 章节：${chapterTitle}`,
          `- 新摘要：${payload.value.trim()}`
        ].join('\n')
      }
    case 'create-outline-item':
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 新增大纲节点`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 标题：${payload.payload.title?.trim() || '未命名大纲节点'}`,
          payload.payload.summary?.trim() ? `- 摘要：${payload.payload.summary.trim()}` : '',
          payload.payload.conflict?.trim() ? `- 冲突：${payload.payload.conflict.trim()}` : ''
        ].filter(Boolean).join('\n')
      }
    case 'append-workflow-document-entry':
      if (SELF_MANAGED_DOCUMENT_KEYS.has(payload.documentKey)) {
        return null
      }
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 更新流程文档`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 文档：${payload.documentKey}`,
          `- 条目：${payload.entryTitle.trim() || '新增条目'}`,
          `- 内容摘要：${payload.content.trim().slice(0, 180)}`
        ].join('\n')
      }
    case 'update-workflow-document':
      if (SELF_MANAGED_DOCUMENT_KEYS.has(payload.documentKey)) {
        return null
      }
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 覆盖流程文档`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 文档：${payload.documentKey}`,
          `- 内容摘要：${payload.content.trim().slice(0, 180)}`
        ].join('\n')
      }
    case 'save-knowledge-document':
      return {
        documentKey: 'progress',
        entryTitle: `${formatTimestamp(now)} 沉淀项目知识`,
        content: [
          `- 阶段：${stageTitle}`,
          `- 分卷：${volumeTitle}`,
          `- 标题：${payload.document.title?.trim() || '未命名知识'}`,
          `- 来源：${payload.document.sourceType?.trim() || 'canon-fact'}`,
          payload.document.summary?.trim() ? `- 摘要：${payload.document.summary.trim()}` : ''
        ].filter(Boolean).join('\n')
      }
  }
}

function buildTaskPlanUpdate(
  payload: CharacterArcAssistantCommand,
  context: AgentScratchpadContext,
  now: string
): AgentScratchpadDocumentUpdate | null {
  const taskPlanDocument = getWorkflowDocument(context.workflowDocuments, 'task_plan')
  const currentContent = taskPlanDocument?.content ?? '# 任务计划\n'
  const header = extractDocumentHeader(currentContent, '# 任务计划')
  const sectionTitle = `## Agent 跟进（${formatTimestamp(now)}）`

  let checklist: string[] | null = null

  switch (payload.type) {
    case 'create-outline-item':
      checklist = [
        `已规划大纲节点：${payload.payload.title?.trim() || '未命名大纲节点'}`,
        '继续补全这一章的冲突、转折和章节目标',
        '进入正文创作前确认本章摘要与字数目标'
      ]
      break
    case 'insert-into-chapter':
      if (payload.mode === 'replace-selection') {
        checklist = [
          `已完成章节修订：${context.selectedChapter?.title?.trim() || '当前章节'}`,
          '通读本章，确认上下文衔接与语气一致',
          '如有必要，再同步更新章节摘要'
        ]
      }
      break
    case 'append-workflow-document-entry':
    case 'update-workflow-document':
      if (payload.documentKey === 'pending_hooks') {
        checklist = [
          '已更新待回收钩子记录',
          '为该钩子安排后续回收章节或触发条件'
        ]
      } else if (payload.documentKey === 'novel_setting' || payload.documentKey === 'character_relationships') {
        checklist = [
          `已更新${payload.documentKey === 'novel_setting' ? '小说设定' : '人物关系'}文档`,
          '检查相关章节与角色卡是否需要同步调整'
        ]
      }
      break
    case 'save-knowledge-document':
      checklist = [
        `已沉淀知识：${payload.document.title?.trim() || '未命名知识'}`,
        '在相关设定文档或后续章节中复用这条知识'
      ]
      break
  }

  if (!checklist?.length) {
    return null
  }

  const body = checklist.map((item, index) => `- ${index === 0 ? '[x]' : '[ ]'} ${item}`).join('\n')
  const nextContent = isPlaceholderDocument(currentContent)
    ? `${header}\n\n${sectionTitle}\n${body}\n`
    : `${currentContent.trim()}\n\n${sectionTitle}\n${body}\n`

  return {
    documentKey: 'task_plan',
    content: nextContent
  }
}

function buildNextStepSuggestion(payload: CharacterArcAssistantCommand): string {
  switch (payload.type) {
    case 'create-outline-item':
      return '继续扩写该节点的冲突、推进节奏和收尾位置。'
    case 'insert-into-chapter':
      return payload.mode === 'replace-selection'
        ? '通读本章，检查替换段落与上下文是否顺滑。'
        : '继续补正文细节，必要时同步更新章节摘要。'
    case 'update-chapter-title':
      return '回看本章内容，确认标题与情节重心一致。'
    case 'update-chapter-summary':
      return '继续核对摘要是否准确覆盖本章转折与结果。'
    case 'append-workflow-document-entry':
    case 'update-workflow-document':
      return '继续把本次更新关联到后续章节规划或设定维护中。'
    case 'save-knowledge-document':
      return '在相关设定、摘要或后续章节中复用这条已沉淀的知识。'
  }
}

function buildCurrentStatusUpdate(
  payload: CharacterArcAssistantCommand,
  context: AgentScratchpadContext,
  now: string
): AgentScratchpadDocumentUpdate | null {
  const currentStatusDocument = getWorkflowDocument(context.workflowDocuments, 'current_status')
  const currentContent = currentStatusDocument?.content ?? '# 当前状态卡\n'
  const canOverwrite = isPlaceholderDocument(currentContent) || currentContent.includes(AGENT_MANAGED_STATUS_MARKER)
  if (!canOverwrite) {
    return null
  }

  const stageTitle = resolveStageTitle(context.stageStates)
  const projectTitle = context.projectTitle?.trim() || '未命名项目'
  const volumeTitle = context.activeVolumeTitle?.trim() || '当前分卷'
  const chapterTitle = context.selectedChapter?.title?.trim() || '未选中章节'
  const chapterSummary = context.selectedChapter?.summary?.trim() || '暂无章节摘要'
  const actionLabel = payload.preview?.title?.trim() || payload.type

  return {
    documentKey: 'current_status',
    content: [
      '# 当前状态卡',
      AGENT_MANAGED_STATUS_MARKER,
      '',
      `- 项目：${projectTitle}`,
      `- 当前阶段：${stageTitle}`,
      `- 当前分卷：${volumeTitle}`,
      `- 当前章节：${chapterTitle}`,
      `- 章节状态：${context.selectedChapter?.status ?? 'draft'}`,
      `- 最近动作：${actionLabel}`,
      `- 更新时间：${formatTimestamp(now)}`,
      '',
      '## 章节概况',
      chapterSummary,
      '',
      '## 下一步建议',
      buildNextStepSuggestion(payload),
      ''
    ].join('\n')
  }
}

export function buildAgentScratchpadSyncPlan(
  payload: CharacterArcAssistantCommand,
  context: AgentScratchpadContext
): AgentScratchpadSyncPlan {
  const now = context.now ?? new Date().toISOString()
  const progressEntry = buildProgressEntry(payload, context, now)
  const taskPlanUpdate = buildTaskPlanUpdate(payload, context, now)
  const currentStatusUpdate = buildCurrentStatusUpdate(payload, context, now)

  return {
    appendEntries: progressEntry ? [progressEntry] : [],
    updates: [taskPlanUpdate, currentStatusUpdate].filter(
      (update): update is AgentScratchpadDocumentUpdate => Boolean(update)
    )
  }
}
