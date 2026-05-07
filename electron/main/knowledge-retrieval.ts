import type { AiTaskPayload } from './ai/shared-types'

type KnowledgeDocumentSourceType = 'reference-summary' | 'reference-chunk' | 'workflow-document' | 'canon-fact' | 'chapter-summary'

type WorkspaceKnowledgeDocument = {
  id: string
  projectId: string
  title: string
  sourceType: KnowledgeDocumentSourceType
  sourceLabel: string
  content: string
  summary: string
  keywords: string[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type WorkspaceAiRunKnowledgeItem = {
  documentId: string
  title: string
  sourceType: KnowledgeDocumentSourceType
  sourceLabel: string
  snippet: string
  keywords: string[]
}

function tokenizeKnowledgeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function buildKnowledgeQuery(task: AiTaskPayload): string {
  return [
    String(task.context.userPrompt ?? ''),
    String(task.context.quickAction ?? ''),
    String(task.context.projectTitle ?? ''),
    String(task.context.projectGenre ?? ''),
    String(task.context.chapterVolumeTitle ?? ''),
    String(task.context.chapterVolumeSummary ?? ''),
    String(task.context.chapterTitle ?? ''),
    String(task.context.chapterSummary ?? ''),
    String(task.context.selectedText ?? ''),
    String(task.context.sceneFocus ?? ''),
    String(task.context.chapterContent ?? '').slice(0, 1200)
  ].filter(Boolean).join('\n')
}

function isProjectKnowledgeSource(sourceType: KnowledgeDocumentSourceType): boolean {
  return sourceType === 'workflow-document' || sourceType === 'canon-fact' || sourceType === 'chapter-summary'
}

function resolveKnowledgeSourceBaseScore(sourceType: KnowledgeDocumentSourceType): number {
  switch (sourceType) {
    case 'canon-fact': return 3.4
    case 'chapter-summary': return 2.8
    case 'workflow-document': return 2.4
    case 'reference-summary': return 1.4
    case 'reference-chunk':
    default: return 1
  }
}

// 这些 task 在生成时需要参考既有项目记忆 + 拆书结果。其它任务（如 worldview-entry / character-card /
// chapter-summarize / assistant-intent / 拆书任务自身）不需要外部检索。
const KNOWLEDGE_RETRIEVAL_TASKS: ReadonlySet<string> = new Set([
  'chapter-assistant',
  'chapter-first-draft',
  'assistant-action-proposal',
  'outline-batch',
  'outline-chain',
  'outline-item',
  'inspiration-pack',
  'chapter-analysis',
  'chapter-scene-plan',
  'project-bootstrap'
])

function buildKnowledgeSnippet(document: WorkspaceKnowledgeDocument): string {
  const sourceType = document.sourceType
  // 拆书总纲：document.content 是结构化报告（含风格总述/句式/对白/节奏/情绪/视角/styleRules/avoidRules/
  // plotOutline/reusableStylePrompt），整段进 prompt 才能让 AI "模仿"。
  if (sourceType === 'reference-summary') {
    const text = (document.content || document.summary || '').trim()
    return text.length > 2400 ? `${text.slice(0, 2400)}…` : text
  }
  // 拆书分块：content 是参考小说原文（用作 in-context 仿写范本）。
  if (sourceType === 'reference-chunk') {
    const text = (document.content || document.summary || '').trim()
    return text.length > 1400 ? `${text.slice(0, 1400)}…` : text
  }
  // 项目记忆类（流程文档/canon/章节摘要）短而精，220 字够用。
  const text = (document.summary || document.content || '').trim()
  return text.length > 320 ? `${text.slice(0, 320)}…` : text
}

export function retrieveKnowledgeContext(
  task: AiTaskPayload,
  latestWorkspaceSnapshot: { workspaces?: Record<string, { knowledgeDocuments?: WorkspaceKnowledgeDocument[] }> } | null
): { usedKnowledge: WorkspaceAiRunKnowledgeItem[] } {
  if (!KNOWLEDGE_RETRIEVAL_TASKS.has(task.task)) {
    return { usedKnowledge: [] }
  }

  const projectId = String(task.context.projectId ?? '').trim()
  if (!projectId || !latestWorkspaceSnapshot?.workspaces?.[projectId]) {
    return { usedKnowledge: [] }
  }

  const workspace = latestWorkspaceSnapshot.workspaces[projectId]
  const documents = Array.isArray(workspace.knowledgeDocuments) ? workspace.knowledgeDocuments : []
  if (!documents.length) {
    return { usedKnowledge: [] }
  }

  const queryText = buildKnowledgeQuery(task)
  const queryTokens = Array.from(new Set(tokenizeKnowledgeText(queryText)))
  if (!queryTokens.length) {
    return { usedKnowledge: [] }
  }

  const ranked = documents
    .map((document) => {
      const title = String(document.title ?? '')
      const summary = String(document.summary ?? '')
      const content = String(document.content ?? '')
      const sourceLabel = String(document.sourceLabel ?? '')
      const keywords = Array.isArray(document.keywords) ? document.keywords.map((k) => String(k).trim()).filter(Boolean) : []
      const lowerKeywords = keywords.map((k) => k.toLowerCase())
      const haystack = `${title}\n${summary}\n${content}\n${sourceLabel}`.toLowerCase()
      let score = resolveKnowledgeSourceBaseScore(document.sourceType)

      for (const token of queryTokens) {
        if (lowerKeywords.some((k) => k === token)) score += 4
        else if (lowerKeywords.some((k) => k.includes(token) || token.includes(k))) score += 2.5
        if (title.toLowerCase().includes(token)) score += 2
        if (sourceLabel.toLowerCase().includes(token)) score += 1.5
        if (summary.toLowerCase().includes(token)) score += 1.2
        if (haystack.includes(token)) score += 0.6
      }

      return { score, document, keywords, projectSource: isProjectKnowledgeSource(document.sourceType) }
    })
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score)

  const selectedIds = new Set<string>()
  const selected = [
    ...ranked.filter((e) => e.projectSource).slice(0, 3),
    ...ranked.filter((e) => !e.projectSource).slice(0, 2)
  ].filter((e) => { if (selectedIds.has(e.document.id)) return false; selectedIds.add(e.document.id); return true })

  for (const entry of ranked) {
    if (selected.length >= 5) break
    if (selectedIds.has(entry.document.id)) continue
    selected.push(entry)
    selectedIds.add(entry.document.id)
  }

  return {
    usedKnowledge: selected
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ document, keywords }) => ({
        documentId: document.id,
        title: document.title,
        sourceType: document.sourceType,
        sourceLabel: document.sourceLabel,
        snippet: buildKnowledgeSnippet(document),
        keywords: keywords.slice(0, 8)
      }))
  }
}
