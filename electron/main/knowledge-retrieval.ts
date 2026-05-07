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

export function retrieveKnowledgeContext(
  task: AiTaskPayload,
  latestWorkspaceSnapshot: { workspaces?: Record<string, { knowledgeDocuments?: WorkspaceKnowledgeDocument[] }> } | null
): { usedKnowledge: WorkspaceAiRunKnowledgeItem[] } {
  if (task.task !== 'chapter-assistant' && task.task !== 'chapter-first-draft' && task.task !== 'assistant-action-proposal') {
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
        snippet: (document.summary || document.content || '').trim().slice(0, 220),
        keywords: keywords.slice(0, 8)
      }))
  }
}
