import { app } from 'electron'
import JSZip from 'jszip'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

import { getWorkspaceDirPath } from '../workspace-store'
import {
  normalizeWorkspacePayload,
  type WorkspaceKnowledgeDocument,
  type WorkspacePayload,
  type WorkspaceReferenceWork
} from '../workspace-types'

export type ProjectArchiveModule =
  | 'project'
  | 'worldview'
  | 'characters'
  | 'relations'
  | 'inspiration'
  | 'outline'
  | 'plotThreads'
  | 'chapters'
  | 'chapterVersions'
  | 'workflowDocuments'
  | 'knowledgeDocuments'
  | 'referenceWorks'
  | 'aiRuns'
  | 'assistantSessions'
  | 'referenceNovelAssets'

export type ProjectArchiveImportMode = 'new-project' | 'overwrite-project'

export type ProjectArchivePreview = {
  filePath: string
  archiveVersion: string
  appVersion: string
  projectId: string
  projectTitle: string
  exportedAt: string
  modules: Record<string, { count: number }>
}

type ProjectArchiveManifest = Omit<ProjectArchivePreview, 'filePath'> & {
  app: 'CharacterArc'
}

type ProjectWorkspace = WorkspacePayload['workspaces'][string]
type ProjectRecord = WorkspacePayload['projects'][number]

type ProjectArchiveContent = {
  manifest: ProjectArchiveManifest
  project: ProjectRecord
  workspace: ProjectWorkspace
  knowledgeDocuments: Array<WorkspaceKnowledgeDocument & { projectId?: string }>
  referenceWorks: WorkspaceReferenceWork[]
  referenceNovelAssets: Map<string, Buffer>
}

type ExportProjectArchiveOptions = {
  db: DatabaseSync
  filePath: string
  projectId: string
  readWorkspaceSnapshot: (db: DatabaseSync) => WorkspacePayload | null
}

type ImportProjectArchiveOptions = {
  db: DatabaseSync
  filePath: string
  mode: ProjectArchiveImportMode
  targetProjectId?: string
  modules?: ProjectArchiveModule[]
  readWorkspaceSnapshot: (db: DatabaseSync) => WorkspacePayload | null
  writeWorkspaceSnapshot: (db: DatabaseSync, payload: WorkspacePayload) => void
}

const ALL_ARCHIVE_MODULES: ProjectArchiveModule[] = [
  'project',
  'worldview',
  'characters',
  'relations',
  'inspiration',
  'outline',
  'plotThreads',
  'chapters',
  'chapterVersions',
  'workflowDocuments',
  'knowledgeDocuments',
  'referenceWorks',
  'aiRuns',
  'assistantSessions',
  'referenceNovelAssets'
]

function createEmptyWorkspace(): ProjectWorkspace {
  return {
    worldviewEntries: [],
    characters: [],
    organizations: [],
    characterRelationships: [],
    organizationMemberships: [],
    inspirationEntries: [],
    outlineVolumes: [],
    outlineItems: [],
    chapters: [],
    chapterVersions: [],
    messages: [],
    globalAssistantSessions: [],
    activeGlobalAssistantSessionId: '',
    aiRuns: [],
    workflowDocuments: [],
    plotThreads: []
  }
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function safeArchiveName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'characterarc-project'
}

function idWithPrefix(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

function addJson(zip: JSZip, path: string, value: unknown): void {
  zip.file(path, JSON.stringify(value, null, 2))
}

async function readZipJson<T>(zip: JSZip, path: string, fallback: T): Promise<T> {
  const file = zip.file(path)
  if (!file) return fallback
  return parseJson(await file.async('string'), fallback)
}

function readProjectKnowledgeDocuments(
  db: DatabaseSync,
  projectId: string
): Array<WorkspaceKnowledgeDocument & { projectId: string }> {
  return db.prepare(`
    SELECT id, project_id AS projectId, title, source_type AS sourceType, source_label AS sourceLabel,
      content, summary, keywords_json AS keywordsJson, metadata_json AS metadataJson,
      created_at AS createdAt, updated_at AS updatedAt
    FROM knowledge_documents
    WHERE project_id = ?
    ORDER BY created_at DESC, rowid DESC
  `).all(projectId).map((row) => ({
    id: row.id as string,
    projectId: row.projectId as string,
    title: row.title as string,
    sourceType: row.sourceType as WorkspaceKnowledgeDocument['sourceType'],
    sourceLabel: row.sourceLabel as string,
    content: row.content as string,
    summary: row.summary as string,
    keywords: parseJson(row.keywordsJson as string, [] as string[]),
    metadata: parseJson(row.metadataJson as string, {} as Record<string, unknown>),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string
  }))
}

function buildManifest(
  project: ProjectRecord,
  workspace: ProjectWorkspace,
  knowledgeDocuments: WorkspaceKnowledgeDocument[],
  referenceWorks: WorkspaceReferenceWork[],
  assetCount: number
): ProjectArchiveManifest {
  return {
    app: 'CharacterArc',
    archiveVersion: '1.0',
    appVersion: app.getVersion(),
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: new Date().toISOString(),
    modules: {
      project: { count: 1 },
      worldview: { count: workspace.worldviewEntries.length },
      characters: { count: workspace.characters.length + workspace.organizations.length },
      relations: { count: workspace.characterRelationships.length + workspace.organizationMemberships.length },
      inspiration: { count: workspace.inspirationEntries.length },
      outline: { count: workspace.outlineVolumes.length + workspace.outlineItems.length },
      plotThreads: { count: workspace.plotThreads.length },
      chapters: { count: workspace.chapters.length },
      chapterVersions: { count: workspace.chapterVersions.length },
      workflowDocuments: {
        count:
          workspace.workflowDocuments.length +
          workspace.outlineVolumes.reduce((total, volume) => total + (volume.workflowDocuments?.length ?? 0), 0)
      },
      knowledgeDocuments: { count: knowledgeDocuments.length },
      referenceWorks: { count: referenceWorks.length },
      aiRuns: { count: workspace.aiRuns.length },
      assistantSessions: { count: workspace.globalAssistantSessions.length + workspace.messages.length },
      referenceNovelAssets: { count: assetCount }
    }
  }
}

export function getProjectArchiveDefaultName(projectTitle: string): string {
  return `${safeArchiveName(projectTitle)}.carc`
}

export async function exportProjectArchive(options: ExportProjectArchiveOptions): Promise<void> {
  const snapshot = options.readWorkspaceSnapshot(options.db)
  const project = snapshot?.projects.find((item) => item.id === options.projectId)
  const workspace = project ? snapshot?.workspaces[project.id] : null

  if (!snapshot || !project || !workspace) {
    throw new Error('未找到要导出的当前项目。')
  }

  const referenceIdSet = new Set(project.selectedReferenceWorkIds ?? [])
  const referenceWorks = snapshot.referenceWorks.filter((work) => referenceIdSet.has(work.id))
  const knowledgeDocuments = readProjectKnowledgeDocuments(options.db, project.id)
  const zip = new JSZip()
  const assetDir = join(getWorkspaceDirPath(), 'reference-novels')
  let assetCount = 0

  // 原文资产按参考作品 ID 存放，导入时会随新的 referenceWork ID 重命名。
  for (const work of referenceWorks) {
    const sourcePath = join(assetDir, `${work.id}.txt`)
    if (!existsSync(sourcePath)) continue
    zip.file(`assets/reference-novels/${work.id}.txt`, await readFile(sourcePath))
    assetCount++
  }

  const manifest = buildManifest(project, workspace, knowledgeDocuments, referenceWorks, assetCount)
  addJson(zip, 'manifest.json', manifest)
  addJson(zip, 'project.json', project)
  addJson(zip, 'workspace/worldview.json', workspace.worldviewEntries)
  addJson(zip, 'workspace/characters.json', {
    characters: workspace.characters,
    organizations: workspace.organizations
  })
  addJson(zip, 'workspace/relations.json', {
    characterRelationships: workspace.characterRelationships,
    organizationMemberships: workspace.organizationMemberships
  })
  addJson(zip, 'workspace/inspiration.json', workspace.inspirationEntries)
  addJson(zip, 'workspace/outline.json', {
    outlineVolumes: workspace.outlineVolumes,
    outlineItems: workspace.outlineItems
  })
  addJson(zip, 'workspace/plotThreads.json', workspace.plotThreads)
  addJson(zip, 'workspace/chapters.json', workspace.chapters)
  addJson(zip, 'workspace/chapterVersions.json', workspace.chapterVersions)
  addJson(zip, 'workspace/workflowDocuments.json', workspace.workflowDocuments)
  addJson(zip, 'workspace/knowledgeDocuments.json', knowledgeDocuments)
  addJson(zip, 'workspace/referenceWorks.json', referenceWorks)
  addJson(zip, 'workspace/aiRuns.json', workspace.aiRuns)
  addJson(zip, 'workspace/assistantSessions.json', {
    messages: workspace.messages,
    globalAssistantSessions: workspace.globalAssistantSessions,
    activeGlobalAssistantSessionId: workspace.activeGlobalAssistantSessionId
  })

  await writeFile(options.filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

export async function inspectProjectArchive(filePath: string): Promise<ProjectArchivePreview> {
  const zip = await JSZip.loadAsync(await readFile(filePath))
  const manifest = await readZipJson<ProjectArchiveManifest | null>(zip, 'manifest.json', null)
  if (!manifest || manifest.app !== 'CharacterArc' || !manifest.projectId || !manifest.projectTitle) {
    throw new Error('这不是有效的 CharacterArc 项目归档包。')
  }

  return {
    filePath,
    archiveVersion: manifest.archiveVersion,
    appVersion: manifest.appVersion,
    projectId: manifest.projectId,
    projectTitle: manifest.projectTitle,
    exportedAt: manifest.exportedAt,
    modules: manifest.modules ?? {}
  }
}

async function readArchiveContent(filePath: string): Promise<ProjectArchiveContent> {
  const zip = await JSZip.loadAsync(await readFile(filePath))
  const manifest = await readZipJson<ProjectArchiveManifest | null>(zip, 'manifest.json', null)
  const project = await readZipJson<ProjectRecord | null>(zip, 'project.json', null)
  if (!manifest || manifest.app !== 'CharacterArc' || !project) {
    throw new Error('归档包缺少 manifest.json 或 project.json。')
  }

  const characterPayload = await readZipJson<{
    characters?: ProjectWorkspace['characters']
    organizations?: ProjectWorkspace['organizations']
  }>(zip, 'workspace/characters.json', {})
  const relationPayload = await readZipJson<{
    characterRelationships?: ProjectWorkspace['characterRelationships']
    organizationMemberships?: ProjectWorkspace['organizationMemberships']
  }>(zip, 'workspace/relations.json', {})
  const outlinePayload = await readZipJson<{
    outlineVolumes?: ProjectWorkspace['outlineVolumes']
    outlineItems?: ProjectWorkspace['outlineItems']
  }>(zip, 'workspace/outline.json', {})
  const assistantPayload = await readZipJson<{
    messages?: ProjectWorkspace['messages']
    globalAssistantSessions?: ProjectWorkspace['globalAssistantSessions']
    activeGlobalAssistantSessionId?: string
  }>(zip, 'workspace/assistantSessions.json', {})

  const workspace: ProjectWorkspace = {
    worldviewEntries: await readZipJson(zip, 'workspace/worldview.json', []),
    characters: characterPayload.characters ?? [],
    organizations: characterPayload.organizations ?? [],
    characterRelationships: relationPayload.characterRelationships ?? [],
    organizationMemberships: relationPayload.organizationMemberships ?? [],
    inspirationEntries: await readZipJson(zip, 'workspace/inspiration.json', []),
    outlineVolumes: outlinePayload.outlineVolumes ?? [],
    outlineItems: outlinePayload.outlineItems ?? [],
    chapters: await readZipJson(zip, 'workspace/chapters.json', []),
    chapterVersions: await readZipJson(zip, 'workspace/chapterVersions.json', []),
    messages: assistantPayload.messages ?? [],
    globalAssistantSessions: assistantPayload.globalAssistantSessions ?? [],
    activeGlobalAssistantSessionId: assistantPayload.activeGlobalAssistantSessionId ?? '',
    aiRuns: await readZipJson(zip, 'workspace/aiRuns.json', []),
    workflowDocuments: await readZipJson(zip, 'workspace/workflowDocuments.json', []),
    plotThreads: await readZipJson(zip, 'workspace/plotThreads.json', [])
  }
  const assets = new Map<string, Buffer>()
  for (const fileName of Object.keys(zip.files)) {
    const match = fileName.match(/^assets\/reference-novels\/(.+)\.txt$/)
    if (!match) continue
    assets.set(match[1], await zip.file(fileName)!.async('nodebuffer'))
  }

  return {
    manifest,
    project,
    workspace,
    knowledgeDocuments: await readZipJson(zip, 'workspace/knowledgeDocuments.json', []),
    referenceWorks: await readZipJson(zip, 'workspace/referenceWorks.json', []),
    referenceNovelAssets: assets
  }
}

function expandModules(modules?: ProjectArchiveModule[]): Set<ProjectArchiveModule> {
  const selected = new Set(modules ?? ALL_ARCHIVE_MODULES)
  if (selected.has('relations')) selected.add('characters')
  if (selected.has('chapters')) selected.add('outline')
  if (selected.has('chapterVersions')) selected.add('chapters').add('outline')
  if (selected.has('workflowDocuments')) selected.add('outline')
  if (selected.has('referenceNovelAssets')) selected.add('referenceWorks')
  if (selected.has('aiRuns')) selected.add('knowledgeDocuments')
  return selected
}

function mapId(map: Map<string, string>, oldId: string | undefined): string {
  if (!oldId) return ''
  return map.get(oldId) ?? oldId
}

function remapArchiveContent(
  content: ProjectArchiveContent,
  targetProjectId: string,
  modules: Set<ProjectArchiveModule>
): ProjectArchiveContent {
  const idMap = new Map<string, string>([[content.project.id, targetProjectId]])
  const assign = (id: string | undefined, prefix: string): string => {
    if (!id) return ''
    const existing = idMap.get(id)
    if (existing) return existing
    const next = idWithPrefix(prefix)
    idMap.set(id, next)
    return next
  }

  for (const work of content.referenceWorks) assign(work.id, 'ref')
  for (const document of content.knowledgeDocuments) assign(document.id, 'knowledge')
  for (const volume of content.workspace.outlineVolumes) assign(volume.id, 'volume')
  for (const item of content.workspace.outlineItems) assign(item.id, 'outline')
  for (const chapter of content.workspace.chapters) assign(chapter.id, 'chapter')
  for (const version of content.workspace.chapterVersions) assign(version.id, 'version')
  for (const character of content.workspace.characters) assign(character.id, 'character')
  for (const organization of content.workspace.organizations) assign(organization.id, 'org')
  for (const relationship of content.workspace.characterRelationships) assign(relationship.id, 'relation')
  for (const membership of content.workspace.organizationMemberships) assign(membership.id, 'member')
  for (const entry of content.workspace.worldviewEntries) assign(entry.id, 'world')
  for (const entry of content.workspace.inspirationEntries) assign(entry.id, 'idea')
  for (const thread of content.workspace.plotThreads) assign(thread.id, 'plot')
  for (const message of content.workspace.messages) assign(message.id, 'message')
  for (const session of content.workspace.globalAssistantSessions) assign(session.id, 'session')
  for (const run of content.workspace.aiRuns) assign(run.id, 'airun')

  const project: ProjectRecord = {
    ...content.project,
    id: targetProjectId,
    title: modules.has('project') ? content.project.title : content.project.title,
    lastEdited: new Date().toISOString(),
    selectedReferenceWorkIds: modules.has('referenceWorks')
      ? (content.project.selectedReferenceWorkIds ?? []).map((id) => mapId(idMap, id)).filter(Boolean)
      : []
  }
  const workspace: ProjectWorkspace = {
    worldviewEntries: modules.has('worldview')
      ? content.workspace.worldviewEntries.map((entry) => ({ ...entry, id: mapId(idMap, entry.id) }))
      : [],
    characters: modules.has('characters')
      ? content.workspace.characters.map((character) => ({ ...character, id: mapId(idMap, character.id) }))
      : [],
    organizations: modules.has('characters')
      ? content.workspace.organizations.map((organization) => ({ ...organization, id: mapId(idMap, organization.id) }))
      : [],
    characterRelationships: modules.has('relations')
      ? content.workspace.characterRelationships.map((relationship) => ({
          ...relationship,
          id: mapId(idMap, relationship.id),
          fromCharacterId: mapId(idMap, relationship.fromCharacterId),
          toCharacterId: mapId(idMap, relationship.toCharacterId)
        }))
      : [],
    organizationMemberships: modules.has('relations')
      ? content.workspace.organizationMemberships.map((membership) => ({
          ...membership,
          id: mapId(idMap, membership.id),
          characterId: mapId(idMap, membership.characterId),
          organizationId: mapId(idMap, membership.organizationId)
        }))
      : [],
    inspirationEntries: modules.has('inspiration')
      ? content.workspace.inspirationEntries.map((entry) => ({ ...entry, id: mapId(idMap, entry.id) }))
      : [],
    outlineVolumes: modules.has('outline')
      ? content.workspace.outlineVolumes.map((volume) => ({
          ...volume,
          id: mapId(idMap, volume.id),
          workflowDocuments: modules.has('workflowDocuments') ? volume.workflowDocuments : []
        }))
      : [],
    outlineItems: modules.has('outline')
      ? content.workspace.outlineItems.map((item) => ({
          ...item,
          id: mapId(idMap, item.id),
          volumeId: mapId(idMap, item.volumeId)
        }))
      : [],
    chapters: modules.has('chapters')
      ? content.workspace.chapters.map((chapter) => ({
          ...chapter,
          id: mapId(idMap, chapter.id),
          volumeId: mapId(idMap, chapter.volumeId),
          outlineItemId: mapId(idMap, chapter.outlineItemId)
        }))
      : [],
    chapterVersions: modules.has('chapterVersions')
      ? content.workspace.chapterVersions.map((version) => ({
          ...version,
          id: mapId(idMap, version.id),
          chapterId: mapId(idMap, version.chapterId)
        }))
      : [],
    messages: modules.has('assistantSessions')
      ? content.workspace.messages.map((chatMessage) => ({ ...chatMessage, id: mapId(idMap, chatMessage.id) }))
      : [],
    globalAssistantSessions: modules.has('assistantSessions')
      ? content.workspace.globalAssistantSessions.map((session) => ({
          ...session,
          id: mapId(idMap, session.id),
          messages: (session.messages ?? []).map((chatMessage) => ({
            ...chatMessage,
            id: mapId(idMap, chatMessage.id)
          }))
        }))
      : [],
    activeGlobalAssistantSessionId: modules.has('assistantSessions')
      ? mapId(idMap, content.workspace.activeGlobalAssistantSessionId)
      : '',
    aiRuns: modules.has('aiRuns')
      ? content.workspace.aiRuns.map((run) => ({
          ...run,
          id: mapId(idMap, run.id),
          chapterId: mapId(idMap, run.chapterId),
          usedKnowledge: (run.usedKnowledge ?? []).map((item) => ({
            ...item,
            documentId: mapId(idMap, item.documentId)
          }))
        }))
      : [],
    workflowDocuments: modules.has('workflowDocuments') ? content.workspace.workflowDocuments : [],
    plotThreads: modules.has('plotThreads')
      ? content.workspace.plotThreads.map((thread) => ({
          ...thread,
          id: mapId(idMap, thread.id),
          openedInChapterId: mapId(idMap, thread.openedInChapterId),
          closedInChapterId: mapId(idMap, thread.closedInChapterId)
        }))
      : []
  }

  const referenceWorks = modules.has('referenceWorks')
    ? content.referenceWorks.map((work) => ({ ...work, id: mapId(idMap, work.id) }))
    : []
  const knowledgeDocuments = modules.has('knowledgeDocuments')
    ? content.knowledgeDocuments.map((document) => ({
        ...document,
        id: mapId(idMap, document.id),
        projectId: targetProjectId
      }))
    : []
  const assets = new Map<string, Buffer>()
  if (modules.has('referenceNovelAssets')) {
    for (const [oldId, data] of content.referenceNovelAssets) {
      assets.set(mapId(idMap, oldId), data)
    }
  }

  return {
    ...content,
    project,
    workspace,
    knowledgeDocuments,
    referenceWorks,
    referenceNovelAssets: assets
  }
}

function mergeWorkspace(
  current: ProjectWorkspace,
  incoming: ProjectWorkspace,
  modules: Set<ProjectArchiveModule>,
  overwrite: boolean
): ProjectWorkspace {
  return {
    ...current,
    worldviewEntries: modules.has('worldview')
      ? overwrite ? incoming.worldviewEntries : [...current.worldviewEntries, ...incoming.worldviewEntries]
      : current.worldviewEntries,
    characters: modules.has('characters')
      ? overwrite ? incoming.characters : [...current.characters, ...incoming.characters]
      : current.characters,
    organizations: modules.has('characters')
      ? overwrite ? incoming.organizations : [...current.organizations, ...incoming.organizations]
      : current.organizations,
    characterRelationships: modules.has('relations')
      ? overwrite ? incoming.characterRelationships : [...current.characterRelationships, ...incoming.characterRelationships]
      : current.characterRelationships,
    organizationMemberships: modules.has('relations')
      ? overwrite ? incoming.organizationMemberships : [...current.organizationMemberships, ...incoming.organizationMemberships]
      : current.organizationMemberships,
    inspirationEntries: modules.has('inspiration')
      ? overwrite ? incoming.inspirationEntries : [...current.inspirationEntries, ...incoming.inspirationEntries]
      : current.inspirationEntries,
    outlineVolumes: modules.has('outline')
      ? overwrite ? incoming.outlineVolumes : [...current.outlineVolumes, ...incoming.outlineVolumes]
      : current.outlineVolumes,
    outlineItems: modules.has('outline')
      ? overwrite ? incoming.outlineItems : [...current.outlineItems, ...incoming.outlineItems]
      : current.outlineItems,
    chapters: modules.has('chapters')
      ? overwrite ? incoming.chapters : [...current.chapters, ...incoming.chapters]
      : current.chapters,
    chapterVersions: modules.has('chapterVersions')
      ? overwrite ? incoming.chapterVersions : [...current.chapterVersions, ...incoming.chapterVersions]
      : current.chapterVersions,
    messages: modules.has('assistantSessions')
      ? overwrite ? incoming.messages : [...current.messages, ...incoming.messages]
      : current.messages,
    globalAssistantSessions: modules.has('assistantSessions')
      ? overwrite ? incoming.globalAssistantSessions : [...incoming.globalAssistantSessions, ...current.globalAssistantSessions]
      : current.globalAssistantSessions,
    activeGlobalAssistantSessionId: modules.has('assistantSessions')
      ? incoming.activeGlobalAssistantSessionId || current.activeGlobalAssistantSessionId
      : current.activeGlobalAssistantSessionId,
    aiRuns: modules.has('aiRuns')
      ? overwrite ? incoming.aiRuns : [...current.aiRuns, ...incoming.aiRuns]
      : current.aiRuns,
    workflowDocuments: modules.has('workflowDocuments')
      ? overwrite ? incoming.workflowDocuments : [...current.workflowDocuments, ...incoming.workflowDocuments]
      : current.workflowDocuments,
    plotThreads: modules.has('plotThreads')
      ? overwrite ? incoming.plotThreads : [...current.plotThreads, ...incoming.plotThreads]
      : current.plotThreads
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[], replaceIds: Set<string>): T[] {
  const preserved = current.filter((item) => !replaceIds.has(item.id))
  return [...preserved, ...incoming]
}

async function restoreReferenceNovelAssets(assets: Map<string, Buffer>): Promise<void> {
  if (assets.size === 0) return
  const targetDir = join(getWorkspaceDirPath(), 'reference-novels')
  await mkdir(targetDir, { recursive: true })
  for (const [id, data] of assets) {
    await writeFile(join(targetDir, `${id}.txt`), data)
  }
}

export async function importProjectArchive(options: ImportProjectArchiveOptions): Promise<{ selectedProjectId: string }> {
  const snapshot = options.readWorkspaceSnapshot(options.db)
  if (!snapshot) {
    throw new Error('当前工作区尚未初始化，无法导入项目归档。')
  }

  const modules = expandModules(options.modules)
  const sourceContent = await readArchiveContent(options.filePath)
  const targetProjectId =
    options.mode === 'new-project'
      ? idWithPrefix('project')
      : (options.targetProjectId || snapshot.selectedProjectId || snapshot.projects[0]?.id || '').trim()
  if (!targetProjectId) {
    throw new Error('没有可覆盖的目标项目。')
  }

  const incoming = remapArchiveContent(sourceContent, targetProjectId, modules)
  const nextPayload: WorkspacePayload = {
    ...snapshot,
    // 项目归档不覆盖本机 AI Key、主题和公告相关设置，只更新项目内容。
    selectedProjectId: targetProjectId
  }

  if (options.mode === 'new-project') {
    nextPayload.projects = [...snapshot.projects, incoming.project]
    nextPayload.workspaces = {
      ...snapshot.workspaces,
      [targetProjectId]: incoming.workspace
    }
  } else {
    const currentProject = snapshot.projects.find((project) => project.id === targetProjectId)
    if (!currentProject) {
      throw new Error('目标项目不存在，无法导入归档。')
    }

    nextPayload.projects = snapshot.projects.map((project) => {
      if (project.id !== targetProjectId) return project
      if (!modules.has('project') && !modules.has('referenceWorks')) return project
      return {
        ...project,
        ...(modules.has('project')
          ? {
              title: incoming.project.title,
              genre: incoming.project.genre,
              novelLength: incoming.project.novelLength,
              cover: incoming.project.cover,
              targetPlatform: incoming.project.targetPlatform,
              writingStylePresetId: incoming.project.writingStylePresetId,
              writingStylePrompt: incoming.project.writingStylePrompt,
              novelWorkflowStages: incoming.project.novelWorkflowStages,
              projectSkills: incoming.project.projectSkills,
              chapterAssistantTemplates: incoming.project.chapterAssistantTemplates,
              coverHistory: incoming.project.coverHistory
            }
          : {}),
        ...(modules.has('referenceWorks') ? { selectedReferenceWorkIds: incoming.project.selectedReferenceWorkIds } : {}),
        lastEdited: new Date().toISOString()
      }
    })
    nextPayload.workspaces = {
      ...snapshot.workspaces,
      [targetProjectId]: mergeWorkspace(
        snapshot.workspaces[targetProjectId] ?? createEmptyWorkspace(),
        incoming.workspace,
        modules,
        true
      )
    }
  }

  if (modules.has('referenceWorks')) {
    // 参考作品是全局拆书库资源，覆盖项目时只更新当前项目的选择列表，不删除旧全局条目，避免影响其他项目复用。
    nextPayload.referenceWorks = mergeById(snapshot.referenceWorks, incoming.referenceWorks, new Set<string>())
  }

  if (modules.has('knowledgeDocuments')) {
    const replaceKnowledgeIds =
      options.mode === 'overwrite-project'
        ? new Set(readProjectKnowledgeDocuments(options.db, targetProjectId).map((document) => document.id))
        : new Set<string>()
    nextPayload.knowledgeDocuments = mergeById(
      snapshot.knowledgeDocuments as Array<WorkspaceKnowledgeDocument & { projectId?: string }>,
      incoming.knowledgeDocuments,
      replaceKnowledgeIds
    )
  }

  const normalized = normalizeWorkspacePayload(nextPayload)
  options.writeWorkspaceSnapshot(options.db, normalized)
  await restoreReferenceNovelAssets(incoming.referenceNovelAssets)
  return { selectedProjectId: targetProjectId }
}
