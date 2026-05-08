<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { AlertCircle, BookCopy, LibraryBig, Search, Sparkles } from 'lucide-vue-next'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NInput,
  NModal,
  NScrollbar,
  NSelect,
  NTag,
  useDialog,
  useMessage
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import {
  buildKnowledgeCenterState,
  buildReferenceAssetLibraries,
  filterKnowledgeDocumentViews,
  resolveKnowledgeSourceTypeLabel,
  type KnowledgeConflictGroup,
  type KnowledgeDocumentView,
  type KnowledgeDuplicateGroup,
  type KnowledgeSourceFilter,
  type ReferenceAssetLibrary
} from '@/features/knowledge/knowledgeCenter'
import { workflowStageDocumentMap } from '@/features/novelWorkflow/documents'
import { loadEnabledProjectSkillsContext } from '@/features/projectSkills/context'
import { useAppStore } from '@/stores/app'
import type { KnowledgeDocumentSourceType } from '@/types/app'

const appStore = useAppStore()
const dialog = useDialog()
const message = useMessage()

const keyword = ref('')
const sourceFilter = ref<KnowledgeSourceFilter>('all')
const selectedDocument = ref<KnowledgeDocumentView | null>(null)
const isImportingReferenceNovel = ref(false)
const isGeneratingReferenceInsights = ref(false)
const activeReferenceSkillActionKey = ref<'long-scan' | 'short-scan' | 'long-analyze' | 'short-analyze' | ''>('')
const referenceImportProgress = ref<CharacterArcReferenceImportProgressPayload | null>(null)

const allState = computed(() => buildKnowledgeCenterState(appStore.knowledgeDocuments))
const filteredDocuments = computed(() =>
  filterKnowledgeDocumentViews(allState.value.documents, keyword.value, sourceFilter.value)
)
const visibleState = computed(() =>
  buildKnowledgeCenterState(filteredDocuments.value.map((item) => item.document))
)
const referenceAssets = computed(() =>
  buildReferenceAssetLibraries(appStore.currentProject?.referenceWorks ?? [], allState.value.documents)
)

const currentProjectTitle = computed(() => appStore.currentProject?.title?.trim() || '当前项目')
const currentProject = computed(() => appStore.currentProject)
const detailVisible = computed({
  get: () => Boolean(selectedDocument.value),
  set: (value: boolean) => {
    if (!value) {
      selectedDocument.value = null
    }
  }
})

const sourceTypeOrder: KnowledgeDocumentSourceType[] = [
  'workflow-document',
  'canon-fact',
  'chapter-summary',
  'reference-summary',
  'reference-chunk'
]

const sourceFilterOptions = computed<SelectOption[]>(() => {
  const typeCountMap = allState.value.documents.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.document.sourceType] = (accumulator[item.document.sourceType] ?? 0) + 1
    return accumulator
  }, {})

  return [
    { label: `全部来源 · ${allState.value.stats.totalDocuments}`, value: 'all' },
    { label: `项目记忆 · ${allState.value.stats.projectDocuments}`, value: 'project' },
    { label: `参考资料 · ${allState.value.stats.referenceDocuments}`, value: 'reference' },
    ...sourceTypeOrder
      .filter((sourceType) => typeCountMap[sourceType] > 0)
      .map((sourceType) => ({
        label: `${resolveKnowledgeSourceTypeLabel(sourceType)} · ${typeCountMap[sourceType]}`,
        value: sourceType
      }))
  ]
})

const healthTone = computed(() =>
  allState.value.stats.duplicateDocuments === 0 && allState.value.stats.conflictGroups === 0
    ? 'stable'
    : 'attention'
)

const heroSummary = computed(() => {
  if (healthTone.value === 'stable') {
    return '当前知识库没有发现完全重复项或同名冲突，项目记忆结构比较干净。'
  }

  return `当前发现 ${allState.value.stats.duplicateDocuments} 条重复记录、${allState.value.stats.conflictGroups} 组冲突项，建议先整理知识底座再继续扩写。`
})

const isReferenceOperationActive = computed(() =>
  isImportingReferenceNovel.value || isGeneratingReferenceInsights.value || Boolean(activeReferenceSkillActionKey.value)
)

const latestReferenceAsset = computed(() => referenceAssets.value[0] ?? null)

const librarySummaryCards = computed(() => [
  {
    key: 'assets',
    label: '参考资产',
    value: referenceAssets.value.length.toLocaleString(),
    hint: '已归档的参考作品与拆书簇'
  },
  {
    key: 'summaries',
    label: '总纲文档',
    value: referenceAssets.value.reduce((count, asset) => count + asset.summaryCount, 0).toLocaleString(),
    hint: '整书风格总纲与骨架'
  },
  {
    key: 'chunks',
    label: '分块文档',
    value: referenceAssets.value.reduce((count, asset) => count + asset.chunkCount, 0).toLocaleString(),
    hint: '原文分块与局部摘录'
  },
  {
    key: 'duplicate',
    label: '待去重',
    value: allState.value.stats.duplicateDocuments.toLocaleString(),
    hint: `${allState.value.stats.duplicateGroups} 组完全重复`
  },
  {
    key: 'conflict',
    label: '待核对',
    value: allState.value.stats.conflictGroups.toLocaleString(),
    hint: `${allState.value.stats.conflictDocuments} 条项目知识待统一`
  }
])

const cleanupReferenceImportProgress = window.characterArc.onReferenceImportProgress((payload) => {
  referenceImportProgress.value = payload
})

onBeforeUnmount(() => {
  cleanupReferenceImportProgress()
})

function setReferenceProgress(payload: CharacterArcReferenceImportProgressPayload | null): void {
  referenceImportProgress.value = payload
}

function resolveReferenceImportPhaseLabel(phase?: CharacterArcReferenceImportProgressPayload['phase']): string {
  switch (phase) {
    case 'extracting':
      return '读取正文'
    case 'chunking':
      return '切分分块'
    case 'chunk-analysis':
      return '逐块分析'
    case 'aggregating':
      return '汇总结论'
    case 'saving':
      return '回填知识库'
    case 'done':
      return '已完成'
    default:
      return '等待开始'
  }
}

function resolveReferenceSkillActionLabel(actionKey: 'long-scan' | 'short-scan' | 'long-analyze' | 'short-analyze'): string {
  switch (actionKey) {
    case 'long-scan':
      return '长篇扫榜'
    case 'short-scan':
      return '短篇扫榜'
    case 'long-analyze':
      return '长篇拆文整理'
    case 'short-analyze':
      return '短篇拆文整理'
    default:
      return '拆书动作'
  }
}

function resolveReferenceSkillPrompt(actionKey: 'long-scan' | 'short-scan' | 'long-analyze' | 'short-analyze'): string {
  const platform = currentProject.value?.targetPlatform?.trim() || '未指定'
  switch (actionKey) {
    case 'long-scan':
      return `请按照长篇网文扫榜的方式，结合当前题材、目标平台「${platform}」和已启用 skills，输出本项目此刻最值得追踪的题材风向、读者偏好、标题包装、开篇卖点和避坑结论。重点把结果写进 findings、task_plan 与 progress。`
    case 'short-scan':
      return `请按照短篇网文扫榜的方式，结合当前题材、目标平台「${platform}」和已启用 skills，输出本项目适合的情绪赛道、反转方向、平台偏好和开头钩子策略。重点把结果写进 findings、task_plan 与 progress。`
    case 'long-analyze':
      return '请按照长篇拆文的方式，综合当前已导入的参考作品与拆书资产，提炼黄金三章、节奏控制、人设骨架、爽点组织和可复用写法。重点把结果写进 findings、novel_setting 与 task_plan。'
    case 'short-analyze':
      return '请按照短篇拆文的方式，综合当前已导入的参考作品与拆书资产，提炼情绪曲线、反转布置、钩子设计和结尾余韵。重点把结果写进 findings、novel_setting 与 task_plan。'
    default:
      return '请整理当前参考阶段素材并输出适合继续创作的结论。'
  }
}

function buildReferenceSkillKnowledgeDocument(
  actionKey: 'long-scan' | 'short-scan' | 'long-analyze' | 'short-analyze',
  payload: Record<string, string>
): import('@/types/app').KnowledgeDocument | null {
  if (!currentProject.value) {
    return null
  }

  const now = new Date().toISOString()
  const title = `拆书知识库·${resolveReferenceSkillActionLabel(actionKey)}`
  const content = [payload.findings, payload.task_plan, payload.progress, payload.novel_setting]
    .filter((item) => String(item ?? '').trim())
    .join('\n\n')

  if (!content.trim()) {
    return null
  }

  return {
    id: `knowledge-reference-skill-${actionKey}-${Date.now()}`,
    projectId: currentProject.value.id,
    title,
    sourceType: 'workflow-document',
    sourceLabel: 'reference-skill',
    content,
    summary: String(payload.findings ?? payload.task_plan ?? '').trim().slice(0, 220) || title,
    keywords: [
      resolveReferenceSkillActionLabel(actionKey),
      currentProject.value.genre,
      currentProject.value.targetPlatform || ''
    ].map((item) => String(item).trim()).filter(Boolean),
    metadata: {
      sourceTitle: title,
      fileName: `reference-skill-${actionKey}.md`,
      actionKey
    },
    createdAt: now,
    updatedAt: now
  }
}

function mergeWritingStylePrompt(existingPrompt: string, incomingPrompt: string, sourceTitle: string): string {
  const nextBlock = [`【参考拆书：${sourceTitle}】`, incomingPrompt.trim()].join('\n')
  if (!existingPrompt.trim()) {
    return nextBlock
  }

  if (existingPrompt.includes(`【参考拆书：${sourceTitle}】`)) {
    return existingPrompt
  }

  return `${existingPrompt.trim()}\n\n${nextBlock}`
}

async function importReferenceNovelAnalysis(): Promise<void> {
  const project = currentProject.value
  if (!project || isImportingReferenceNovel.value) {
    return
  }

  isImportingReferenceNovel.value = true
  setReferenceProgress({
    phase: 'extracting',
    message: '准备打开文件并开始拆书分析...',
    current: 0,
    total: 1,
    percent: 2
  })
  try {
    const result = await window.characterArc.importReferenceNovelAnalysis(JSON.parse(JSON.stringify({
      settings: appStore.appSettings,
      projectId: project.id,
      projectTitle: project.title,
      projectGenre: project.genre,
      projectPlatform: project.targetPlatform || ''
    })))

    if (result.canceled) {
      setReferenceProgress(null)
      return
    }

    if (!result.success || !result.result) {
      throw new Error(result.error ?? '参考作品拆书失败')
    }

    const nextReferenceWorks = [...(project.referenceWorks ?? []), result.result.referenceWork]
    appStore.updateProject(project.id, {
      referenceWorks: nextReferenceWorks,
      writingStylePrompt: mergeWritingStylePrompt(
        project.writingStylePrompt,
        result.result.suggestedWritingStylePrompt,
        result.result.referenceWork.title
      )
    })
    appStore.mergeKnowledgeDocuments(project.id, result.result.knowledgeDocuments)
    if (appStore.activeWorkflowVolume?.id) {
      appStore.appendWorkflowDocumentEntry(
        appStore.activeWorkflowVolume.id,
        'findings',
        `${result.result.referenceWork.title} 拆书结果`,
        result.result.findingsMarkdown
      )
    }

    setReferenceProgress({
      phase: 'done',
      message: `《${result.result.referenceWork.title}》已加入拆书知识库，风格模板、参考档案和 findings 已同步更新。`,
      current: 1,
      total: 1,
      percent: 100,
      sourceTitle: result.result.referenceWork.title
    })
    message.success(`已完成《${result.result.referenceWork.title}》拆书并归档到知识库`)
  } catch (error) {
    setReferenceProgress({
      phase: 'done',
      message: error instanceof Error ? error.message : '参考作品拆书失败',
      current: 0,
      total: 1,
      percent: 0
    })
    message.error(error instanceof Error ? error.message : '参考作品拆书失败')
  } finally {
    isImportingReferenceNovel.value = false
  }
}

async function generateReferenceInsights(): Promise<void> {
  const project = currentProject.value
  if (!project || isGeneratingReferenceInsights.value) {
    return
  }

  isGeneratingReferenceInsights.value = true
  setReferenceProgress({
    phase: 'extracting',
    message: '正在整理拆书资产与当前流程文件...',
    current: 1,
    total: 3,
    percent: 12
  })
  try {
    window.setTimeout(() => {
      if (!isGeneratingReferenceInsights.value) {
        return
      }
      setReferenceProgress({
        phase: 'aggregating',
        message: '正在提炼参考阶段共性风格、题材爆点和平台偏好...',
        current: 2,
        total: 3,
        percent: 56
      })
    }, 240)

    const result = await window.characterArc.generateAi(JSON.parse(JSON.stringify({
      task: 'workflow-documents',
      settings: appStore.appSettings,
      context: {
        projectTitle: project.title,
        projectGenre: project.genre,
        projectPlatform: project.targetPlatform || '未指定',
        projectPhase: '选题与参考',
        stageId: 'reference',
        stageLabel: '选题与参考',
        requestedDocuments: workflowStageDocumentMap.reference,
        referenceWorks: project.referenceWorks,
        workflowDocuments: appStore.workflowDocuments.map((document) => ({
          key: document.key,
          content: document.content
        })),
        projectSkills: await loadEnabledProjectSkillsContext(project, 'reference'),
        userPrompt: '请重点提炼当前参考作品的风格共性、题材爆点、平台偏好，并写成适合后续立项使用的 findings 与 task_plan。'
      }
    })))

    if (!result.success || !result.result) {
      throw new Error(result.error ?? '参考阶段提炼失败')
    }

    const payload = result.result as Record<string, string>
    appStore.updateWorkflowDocuments(
      appStore.activeWorkflowVolume?.id ?? '',
      workflowStageDocumentMap.reference
        .map((key) => ({
          key,
          content: payload[key] ?? ''
        }))
        .filter((item) => item.content.trim())
    )
    const knowledgeDocument = buildReferenceSkillKnowledgeDocument('long-analyze', payload)
    if (knowledgeDocument) {
      appStore.mergeKnowledgeDocuments(project.id, [knowledgeDocument])
    }

    setReferenceProgress({
      phase: 'done',
      message: '参考阶段提炼已完成，结果已同步到拆书知识库。',
      current: 3,
      total: 3,
      percent: 100
    })
    message.success('已完成参考阶段提炼并同步到知识库')
  } catch (error) {
    setReferenceProgress({
      phase: 'done',
      message: error instanceof Error ? error.message : '参考阶段提炼失败',
      current: 0,
      total: 3,
      percent: 0
    })
    message.error(error instanceof Error ? error.message : '参考阶段提炼失败')
  } finally {
    isGeneratingReferenceInsights.value = false
  }
}

async function runReferenceSkillAction(actionKey: 'long-scan' | 'short-scan' | 'long-analyze' | 'short-analyze'): Promise<void> {
  const project = currentProject.value
  if (!project || activeReferenceSkillActionKey.value) {
    return
  }

  if ((actionKey === 'long-analyze' || actionKey === 'short-analyze') && !referenceAssets.value.length) {
    message.warning('请先导入参考小说并完成至少一次拆书，再执行拆文整理。')
    return
  }

  activeReferenceSkillActionKey.value = actionKey
  setReferenceProgress({
    phase: 'extracting',
    message: `正在整理${resolveReferenceSkillActionLabel(actionKey)}所需的项目上下文与已启用 skills...`,
    current: 1,
    total: 3,
    percent: 16
  })

  try {
    window.setTimeout(() => {
      if (activeReferenceSkillActionKey.value !== actionKey) {
        return
      }
      setReferenceProgress({
        phase: 'aggregating',
        message: `正在按${resolveReferenceSkillActionLabel(actionKey)}口径提炼关键信息...`,
        current: 2,
        total: 3,
        percent: 58
      })
    }, 240)

    const result = await window.characterArc.generateAi(JSON.parse(JSON.stringify({
      task: 'workflow-documents',
      settings: appStore.appSettings,
      context: {
        projectTitle: project.title,
        projectGenre: project.genre,
        projectPlatform: project.targetPlatform || '未指定',
        projectPhase: '选题与参考',
        stageId: 'reference',
        stageLabel: '选题与参考',
        requestedDocuments: workflowStageDocumentMap.reference,
        referenceWorks: project.referenceWorks,
        workflowDocuments: appStore.workflowDocuments.map((document) => ({
          key: document.key,
          content: document.content
        })),
        projectSkills: await loadEnabledProjectSkillsContext(project, 'reference'),
        userPrompt: resolveReferenceSkillPrompt(actionKey)
      }
    })))

    if (!result.success || !result.result) {
      throw new Error(result.error ?? `${resolveReferenceSkillActionLabel(actionKey)}失败`)
    }

    const payload = result.result as Record<string, string>
    appStore.updateWorkflowDocuments(
      appStore.activeWorkflowVolume?.id ?? '',
      workflowStageDocumentMap.reference
        .map((key) => ({
          key,
          content: payload[key] ?? ''
        }))
        .filter((item) => item.content.trim())
    )
    const knowledgeDocument = buildReferenceSkillKnowledgeDocument(actionKey, payload)
    if (knowledgeDocument) {
      appStore.mergeKnowledgeDocuments(project.id, [knowledgeDocument])
    }

    setReferenceProgress({
      phase: 'done',
      message: `${resolveReferenceSkillActionLabel(actionKey)}已完成，结论已加入拆书知识库。`,
      current: 3,
      total: 3,
      percent: 100
    })
    message.success(`${resolveReferenceSkillActionLabel(actionKey)}已完成`)
  } catch (error) {
    setReferenceProgress({
      phase: 'done',
      message: error instanceof Error ? error.message : `${resolveReferenceSkillActionLabel(actionKey)}失败`,
      current: 0,
      total: 3,
      percent: 0
    })
    message.error(error instanceof Error ? error.message : `${resolveReferenceSkillActionLabel(actionKey)}失败`)
  } finally {
    activeReferenceSkillActionKey.value = ''
  }
}

function openDocument(documentView: KnowledgeDocumentView): void {
  selectedDocument.value = documentView
}

function requestCleanDuplicateGroup(group: KnowledgeDuplicateGroup): void {
  if (!group.removeDocumentIds.length) {
    return
  }

  dialog.warning({
    title: '确认清理重复知识',
    content: `将为“${group.title}”保留最新 1 条记录，并移除其余 ${group.removeDocumentIds.length} 条完全重复项。`,
    positiveText: '确认清理',
    negativeText: '取消',
    autoFocus: false,
    closable: false,
    onPositiveClick: () => {
      appStore.removeKnowledgeDocuments(String(appStore.selectedProjectId ?? ''), group.removeDocumentIds)
      message.success(`已清理“${group.title}”的重复知识`)
    }
  })
}

function requestCleanAllDuplicates(): void {
  const duplicateIds = Array.from(
    new Set(allState.value.duplicateGroups.flatMap((group) => group.removeDocumentIds))
  )
  if (!duplicateIds.length) {
    return
  }

  dialog.warning({
    title: '确认一键清理重复项',
    content: `将为“${currentProjectTitle.value}”保留每组重复知识中的最新版本，并移除其余 ${duplicateIds.length} 条重复记录。`,
    positiveText: '确认清理',
    negativeText: '取消',
    autoFocus: false,
    closable: false,
    onPositiveClick: () => {
      appStore.removeKnowledgeDocuments(String(appStore.selectedProjectId ?? ''), duplicateIds)
      message.success('知识库重复项已清理')
    }
  })
}

function summarizeConflictTypes(group: KnowledgeConflictGroup): string {
  return Array.from(new Set(group.documents.map((item) => item.sourceTypeLabel))).join(' / ')
}

function openReferenceAsset(asset: ReferenceAssetLibrary): void {
  if (asset.primaryDocument) {
    openDocument(asset.primaryDocument)
    return
  }

  focusReferenceAsset(asset)
}

function focusReferenceAsset(asset: ReferenceAssetLibrary): void {
  keyword.value = asset.fileName || asset.title
  sourceFilter.value = 'reference'
}

const deepAnalyzingAssetId = ref<string | null>(null)

const SOURCE_TEXT_CHAR_CAP = 30_000

function buildDeepAnalyzeSourceText(asset: ReferenceAssetLibrary): string {
  const chunks = appStore.knowledgeDocuments
    .filter((doc) => doc.sourceType === 'reference-chunk' && asset.relatedDocumentIds.includes(doc.id))
    .map((doc) => ({
      label: String(doc.metadata?.chunkLabel ?? doc.title).trim() || doc.title,
      order: Number(doc.metadata?.chunkOrder ?? Number.MAX_SAFE_INTEGER),
      text: doc.content
    }))
    .sort((a, b) => a.order - b.order)

  if (!chunks.length) {
    return asset.primaryDocument?.document.content ?? ''
  }

  let acc = ''
  for (const chunk of chunks) {
    const piece = `\n\n【${chunk.label}】\n${chunk.text}`
    if (acc.length + piece.length > SOURCE_TEXT_CHAR_CAP) {
      acc += `\n\n[...剩余 ${chunks.length - chunks.indexOf(chunk)} 段已超出本次分析上限，本次只对前段拆解。]`
      break
    }
    acc += piece
  }
  return acc.trim()
}

async function handleAiDeepAnalyze(asset: ReferenceAssetLibrary): Promise<void> {
  const project = appStore.currentProject
  if (!project) {
    message.warning('请先选择一个项目再使用 AI 深度拆书。')
    return
  }
  if (deepAnalyzingAssetId.value) {
    message.info('上一次深度拆书还在进行中，请稍候。')
    return
  }

  const sourceText = buildDeepAnalyzeSourceText(asset)
  if (!sourceText.trim()) {
    message.error('找不到该参考作品的原文片段，无法进行深度拆书。')
    return
  }

  deepAnalyzingAssetId.value = asset.id
  const loading = message.loading(`AI 正在深度拆解《${asset.title}》，可能需要 1-3 分钟…`, { duration: 0 })
  try {
    const response = await window.characterArc.generateAi(JSON.parse(JSON.stringify({
      task: 'reference-deep-analyze',
      settings: appStore.appSettings,
      context: {
        projectId: project.id,
        projectTitle: project.title,
        projectGenre: project.genre,
        referenceTitle: asset.title,
        referenceFileName: asset.fileName,
        referenceGenre: asset.topKeywords.slice(0, 3).join('、'),
        sourceText
      }
    })))

    if (!response.success) {
      throw new Error(response.error ?? 'AI 深度拆书失败')
    }
    // 实际产出的 knowledge 文档由 ai-run-event → handleAiRunEvent 自动合并到 store。
    // 这里只给个用户可见的成功消息。
    message.success(`已完成《${asset.title}》深度拆书，新增的知识文档稍后会出现在列表中。`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'AI 深度拆书失败')
  } finally {
    loading.destroy()
    deepAnalyzingAssetId.value = null
  }
}
</script>

<template>
  <section class="knowledge-screen">
    <div class="knowledge-screen-topbar">
      <div class="knowledge-panel-title">
        <strong>拆书知识库</strong>
        <span>把参考作品、拆书总纲、分块原文和派生结论收束到一个工作面板里</span>
      </div>
      <div class="knowledge-screen-actions">
        <n-tag :type="healthTone === 'stable' ? 'success' : 'warning'" round :bordered="false">
          {{ healthTone === 'stable' ? '状态稳定' : '需要整理' }}
        </n-tag>
        <n-button
          v-if="allState.stats.duplicateDocuments > 0"
          type="primary"
          secondary
          size="small"
          @click="requestCleanAllDuplicates"
        >
          清理重复项
        </n-button>
      </div>
    </div>

    <div class="knowledge-center">
      <section class="deconstruction-command-deck">
        <div class="deconstruction-command-copy">
          <div class="deconstruction-command-badge">
            <LibraryBig :size="15" />
            <span>Reference Archive</span>
          </div>
          <h2>先归档参考作品，再在同一处做拆书、复盘和复用。</h2>
          <p>
            这里不再只是被动展示知识文档。它负责承接参考作品导入、拆书进度、资产归档、深度拆书和参考阶段方法论沉淀。
          </p>
        </div>
        <div class="deconstruction-command-actions">
          <div class="deconstruction-command-topline">
            <span>{{ resolveReferenceImportPhaseLabel(referenceImportProgress?.phase) }}</span>
            <small>{{ latestReferenceAsset ? `最近归档：${latestReferenceAsset.title}` : '还没有归档参考作品' }}</small>
          </div>
          <div class="deconstruction-command-buttons">
            <n-button round strong secondary :disabled="isReferenceOperationActive" @click="importReferenceNovelAnalysis">
              {{ isImportingReferenceNovel ? '拆书中...' : '导入小说并拆书' }}
            </n-button>
            <n-button type="primary" round strong :disabled="isReferenceOperationActive" @click="generateReferenceInsights">
              {{ isGeneratingReferenceInsights ? '提炼中...' : 'AI提炼参考结论' }}
            </n-button>
          </div>
        </div>
      </section>

      <section class="deconstruction-progress-card" :class="{ active: Boolean(referenceImportProgress) }">
        <div class="reference-progress-meta">
          <div>
            <span class="reference-progress-label">当前任务</span>
            <strong>{{ referenceImportProgress?.sourceTitle ? `正在处理《${referenceImportProgress.sourceTitle}》` : '等待开始归档参考作品' }}</strong>
          </div>
          <span>{{ referenceImportProgress?.percent ?? 0 }}%</span>
        </div>
        <div class="reference-progress-track">
          <div class="reference-progress-fill" :style="{ width: `${referenceImportProgress?.percent ?? 0}%` }" />
        </div>
        <p>{{ referenceImportProgress?.message || '导入后会依次完成：读取正文、切分分块、逐块分析、汇总结论、归档到拆书知识库。' }}</p>
        <small v-if="referenceImportProgress && referenceImportProgress.total > 1">
          当前进度：{{ referenceImportProgress.current }} / {{ referenceImportProgress.total }}
        </small>
        <div class="reference-progress-steps">
          <span :class="{ active: ['extracting', 'chunking', 'chunk-analysis', 'aggregating', 'saving', 'done'].includes(referenceImportProgress?.phase ?? '') }">读取/切分</span>
          <span :class="{ active: ['chunk-analysis', 'aggregating', 'saving', 'done'].includes(referenceImportProgress?.phase ?? '') }">逐块分析</span>
          <span :class="{ active: ['aggregating', 'saving', 'done'].includes(referenceImportProgress?.phase ?? '') }">汇总结论</span>
          <span :class="{ active: ['saving', 'done'].includes(referenceImportProgress?.phase ?? '') }">归档资产</span>
        </div>
      </section>

      <section class="knowledge-stats-grid">
        <article v-for="card in librarySummaryCards" :key="card.key" class="knowledge-stat-card">
          <span class="knowledge-stat-label">{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <p>{{ card.hint }}</p>
        </article>
      </section>

      <section class="knowledge-hero">
        <div class="knowledge-hero-copy">
          <div class="knowledge-hero-badge">
            <BookCopy :size="15" />
            <span>Deconstruction Map</span>
          </div>
          <h2>以拆书资产为中心，往外连接项目记忆和冲突治理。</h2>
          <p>{{ heroSummary }}</p>
        </div>
        <div class="knowledge-hero-side">
          <div class="knowledge-hero-chip">
            <component :is="healthTone === 'stable' ? Sparkles : AlertCircle" :size="15" />
            <span>{{ healthTone === 'stable' ? '可以继续扩写' : '建议先清理底座' }}</span>
          </div>
          <strong>{{ allState.stats.totalDocuments }}</strong>
          <span>条知识文档</span>
        </div>
      </section>

      <section class="knowledge-toolbar">
        <n-input
          v-model:value="keyword"
          clearable
          class="knowledge-toolbar-search"
          placeholder="搜索标题、摘要、来源标签或关键词"
        >
          <template #prefix>
            <Search :size="14" />
          </template>
        </n-input>

        <n-select
          v-model:value="sourceFilter"
          class="knowledge-toolbar-filter"
          :options="sourceFilterOptions"
        />

        <n-tag round :bordered="false" type="info">
          当前显示 {{ visibleState.documents.length }} / {{ allState.documents.length }} 条
        </n-tag>
      </section>

      <section class="knowledge-section">
        <div class="knowledge-section-head">
          <div>
            <h3>拆书资产库</h3>
            <p>每个参考作品都会被组织成一份资产档案，绑定总纲、分块、风格规则和深度拆书入口。</p>
          </div>
          <n-tag type="info" :bordered="false">
            {{ referenceAssets.length }} 项
          </n-tag>
        </div>

        <n-empty
          v-if="!referenceAssets.length"
          description="当前还没有沉淀参考资产，先在这里导入参考小说并拆书。"
        />

        <div v-else class="knowledge-asset-grid">
          <n-card
            v-for="asset in referenceAssets"
            :key="asset.id"
            size="small"
            :bordered="false"
            class="knowledge-asset-card"
          >
            <template #header>
              <div class="knowledge-group-headline">
                <strong>{{ asset.title }}</strong>
                <span>{{ asset.source }}<template v-if="asset.fileName"> · {{ asset.fileName }}</template></span>
              </div>
            </template>

            <template #header-extra>
              <div class="knowledge-asset-badge">
                <LibraryBig :size="14" />
                <span>{{ asset.documentCount }} 篇文档</span>
              </div>
            </template>

            <p class="knowledge-asset-summary">{{ asset.summary }}</p>

            <div class="knowledge-asset-metrics">
              <span>总纲 {{ asset.summaryCount }}</span>
              <span>分块 {{ asset.chunkCount }}</span>
              <span v-if="asset.chapterCount > 0">估算 {{ asset.chapterCount }} 章/段</span>
              <span v-if="asset.characterCount > 0">约 {{ asset.characterCount.toLocaleString() }} 字</span>
              <span>更新于 {{ asset.updatedAtLabel }}</span>
            </div>

            <div v-if="asset.styleRules.length" class="knowledge-document-keywords">
              <span v-for="rule in asset.styleRules.slice(0, 4)" :key="`${asset.id}-${rule}`">{{ rule }}</span>
            </div>

            <div v-else-if="asset.topKeywords.length" class="knowledge-document-keywords">
              <span v-for="tag in asset.topKeywords.slice(0, 6)" :key="`${asset.id}-${tag}`">{{ tag }}</span>
            </div>

            <div class="knowledge-asset-actions">
              <n-button tertiary type="primary" size="small" @click="openReferenceAsset(asset)">
                查看主文档
              </n-button>
              <n-button tertiary size="small" @click="focusReferenceAsset(asset)">
                筛到此资产
              </n-button>
              <n-button
                type="primary"
                size="small"
                :loading="deepAnalyzingAssetId === asset.id"
                :disabled="Boolean(deepAnalyzingAssetId) && deepAnalyzingAssetId !== asset.id"
                @click="handleAiDeepAnalyze(asset)"
              >
                <template #icon>
                  <Sparkles :size="14" />
                </template>
                AI 深度拆书
              </n-button>
            </div>
          </n-card>
        </div>
      </section>

      <section class="knowledge-section">
        <div class="knowledge-section-head">
          <div>
            <h3>拆书方法论工具台</h3>
            <p>把扫榜和拆文整理能力沉淀成可复用知识，而不是留在流程页里一次性消费。</p>
          </div>
          <n-tag type="default" :bordered="false">
            4 个动作
          </n-tag>
        </div>

        <div class="reference-skill-grid">
          <article class="reference-skill-card">
            <strong>长篇扫榜</strong>
            <p>适合起点、番茄、晋江等长篇项目，提炼题材风口、读者偏好和开篇卖点。</p>
            <n-button size="small" secondary :disabled="isReferenceOperationActive" @click="runReferenceSkillAction('long-scan')">
              {{ activeReferenceSkillActionKey === 'long-scan' ? '执行中...' : '运行长篇扫榜' }}
            </n-button>
          </article>
          <article class="reference-skill-card">
            <strong>短篇扫榜</strong>
            <p>适合盐言、番茄短篇等赛道，聚焦情绪方向、反转模式和短开头钩子。</p>
            <n-button size="small" secondary :disabled="isReferenceOperationActive" @click="runReferenceSkillAction('short-scan')">
              {{ activeReferenceSkillActionKey === 'short-scan' ? '执行中...' : '运行短篇扫榜' }}
            </n-button>
          </article>
          <article class="reference-skill-card">
            <strong>长篇拆文整理</strong>
            <p>基于已拆过的参考作品，整理黄金三章、节奏、人设骨架和爽点组织方式。</p>
            <n-button size="small" secondary :disabled="isReferenceOperationActive" @click="runReferenceSkillAction('long-analyze')">
              {{ activeReferenceSkillActionKey === 'long-analyze' ? '执行中...' : '整理长篇拆文' }}
            </n-button>
          </article>
          <article class="reference-skill-card">
            <strong>短篇拆文整理</strong>
            <p>基于已拆过的参考作品，提炼情绪曲线、反转布置、钩子设计和收束方式。</p>
            <n-button size="small" secondary :disabled="isReferenceOperationActive" @click="runReferenceSkillAction('short-analyze')">
              {{ activeReferenceSkillActionKey === 'short-analyze' ? '执行中...' : '整理短篇拆文' }}
            </n-button>
          </article>
        </div>
      </section>

      <section class="knowledge-section">
        <div class="knowledge-section-head">
          <div>
            <h3>重复项</h3>
            <p>只标记完全重复的知识记录，适合直接做安全去重。</p>
          </div>
          <n-tag v-if="visibleState.duplicateGroups.length" type="warning" :bordered="false">
            {{ visibleState.duplicateGroups.length }} 组
          </n-tag>
        </div>

        <n-alert
          v-if="visibleState.duplicateGroups.length"
          type="warning"
          :show-icon="false"
          class="knowledge-inline-alert"
        >
          当前筛选范围内发现 {{ visibleState.duplicateGroups.length }} 组完全重复项，可以保留最新版本并清理其余记录。
        </n-alert>

        <n-empty
          v-if="!visibleState.duplicateGroups.length"
          description="当前筛选范围内没有发现完全重复的知识文档。"
        />

        <div v-else class="knowledge-group-grid">
          <n-card
            v-for="group in visibleState.duplicateGroups"
            :key="group.id"
            size="small"
            :bordered="false"
            class="knowledge-group-card"
          >
            <template #header>
              <div class="knowledge-group-headline">
                <strong>{{ group.title }}</strong>
                <span>{{ group.sourceScopeLabel }} · {{ group.sourceTypeLabel }}</span>
              </div>
            </template>

            <template #header-extra>
              <n-button
                tertiary
                type="primary"
                size="small"
                @click="requestCleanDuplicateGroup(group)"
              >
                保留最新并清理
              </n-button>
            </template>

            <div class="knowledge-group-body">
              <button
                v-for="item in group.documents"
                :key="item.document.id"
                type="button"
                class="knowledge-group-item"
                @click="openDocument(item)"
              >
                <div class="knowledge-group-item-top">
                  <strong>{{ item.document.id === group.keepDocumentId ? '保留版本' : '重复版本' }}</strong>
                  <span>{{ item.updatedAtLabel }}</span>
                </div>
                <p>{{ item.preview || '暂无摘要，点击查看正文。' }}</p>
                <div class="knowledge-group-item-meta">
                  <span>{{ item.sourceLabelText }}</span>
                  <span>{{ item.document.keywords.slice(0, 4).join(' · ') || '无关键词' }}</span>
                </div>
              </button>
            </div>
          </n-card>
        </div>
      </section>

      <section class="knowledge-section">
        <div class="knowledge-section-head">
          <div>
            <h3>冲突项</h3>
            <p>聚焦项目记忆中的同名多版本知识，帮助你尽快核对口径差异。</p>
          </div>
          <n-tag v-if="visibleState.conflictGroups.length" type="error" :bordered="false">
            {{ visibleState.conflictGroups.length }} 组
          </n-tag>
        </div>

        <n-alert
          v-if="visibleState.conflictGroups.length"
          type="error"
          :show-icon="false"
          class="knowledge-inline-alert"
        >
          冲突项不会自动删除。建议先查看详情，再决定是否保留最新版本或回写统一结论。
        </n-alert>

        <n-empty
          v-if="!visibleState.conflictGroups.length"
          description="当前筛选范围内没有发现同名冲突的项目知识。"
        />

        <div v-else class="knowledge-group-grid">
          <n-card
            v-for="group in visibleState.conflictGroups"
            :key="group.id"
            size="small"
            :bordered="false"
            class="knowledge-group-card knowledge-group-card--conflict"
          >
            <template #header>
              <div class="knowledge-group-headline">
                <strong>{{ group.title }}</strong>
                <span>{{ summarizeConflictTypes(group) }}</span>
              </div>
            </template>

            <p class="knowledge-conflict-reason">{{ group.reason }}</p>

            <div class="knowledge-group-body">
              <button
                v-for="item in group.documents"
                :key="item.document.id"
                type="button"
                class="knowledge-group-item knowledge-group-item--conflict"
                @click="openDocument(item)"
              >
                <div class="knowledge-group-item-top">
                  <strong>{{ item.sourceTypeLabel }}</strong>
                  <span>{{ item.updatedAtLabel }}</span>
                </div>
                <p>{{ item.preview || '暂无摘要，点击查看正文。' }}</p>
                <div class="knowledge-group-item-meta">
                  <span>{{ item.sourceLabelText }}</span>
                  <span>{{ item.document.keywords.slice(0, 4).join(' · ') || '无关键词' }}</span>
                </div>
              </button>
            </div>
          </n-card>
        </div>
      </section>

      <section class="knowledge-section">
        <div class="knowledge-section-head">
          <div>
            <h3>全部知识文档</h3>
            <p>点击卡片查看全文、摘要、关键词和来源信息。</p>
          </div>
          <n-tag type="default" :bordered="false">
            {{ visibleState.documents.length }} 条
          </n-tag>
        </div>

        <n-empty
          v-if="!visibleState.documents.length"
          description="当前筛选条件下没有命中文档。"
        />

        <div v-else class="knowledge-document-grid">
          <n-card
            v-for="item in visibleState.documents"
            :key="item.document.id"
            size="small"
            :bordered="false"
            class="knowledge-document-card"
            @click="openDocument(item)"
          >
            <div class="knowledge-document-top">
              <div class="knowledge-document-headline">
                <div class="knowledge-document-tags">
                  <n-tag size="small" :bordered="false">{{ item.sourceScopeLabel }}</n-tag>
                  <n-tag size="small" type="info" :bordered="false">{{ item.sourceTypeLabel }}</n-tag>
                  <n-tag v-if="item.duplicateGroupId" size="small" type="warning" :bordered="false">重复</n-tag>
                  <n-tag v-if="item.conflictGroupId" size="small" type="error" :bordered="false">冲突</n-tag>
                </div>
                <h4>{{ item.document.title }}</h4>
                <span>{{ item.sourceLabelText }}</span>
              </div>
              <span class="knowledge-document-time">{{ item.updatedAtLabel }}</span>
            </div>

            <p class="knowledge-document-preview">
              {{ item.preview || '暂无摘要，点击查看正文。' }}
            </p>

            <div class="knowledge-document-bottom">
              <div class="knowledge-document-keywords">
                <span v-for="keyword in item.document.keywords.slice(0, 6)" :key="keyword">{{ keyword }}</span>
              </div>
              <n-button text type="primary" @click.stop="openDocument(item)">查看全文</n-button>
            </div>
          </n-card>
        </div>
      </section>
    </div>

    <n-modal v-model:show="detailVisible">
      <n-card
        class="knowledge-detail-modal"
        :bordered="false"
        title="知识详情"
        role="dialog"
        aria-modal="true"
      >
        <template #header>
          <div class="knowledge-detail-title">
            <strong>{{ selectedDocument?.document.title ?? '知识详情' }}</strong>
            <span>{{ selectedDocument?.sourceLabelText ?? '' }}</span>
          </div>
        </template>

        <template #header-extra>
          <n-tag v-if="selectedDocument" type="info" :bordered="false">
            {{ selectedDocument.sourceTypeLabel }}
          </n-tag>
        </template>

        <div v-if="selectedDocument" class="knowledge-detail">
          <div class="knowledge-detail-meta">
            <span>{{ selectedDocument.sourceScopeLabel }}</span>
            <span>{{ selectedDocument.updatedAtLabel }}</span>
            <span>{{ selectedDocument.document.keywords.length }} 个关键词</span>
          </div>

          <n-alert
            v-if="selectedDocument.document.summary"
            type="info"
            :show-icon="false"
            class="knowledge-inline-alert"
          >
            {{ selectedDocument.document.summary }}
          </n-alert>

          <div v-if="selectedDocument.document.keywords.length" class="knowledge-detail-keywords">
            <span v-for="keyword in selectedDocument.document.keywords" :key="keyword">{{ keyword }}</span>
          </div>

          <n-scrollbar class="knowledge-detail-scroll">
            <pre class="knowledge-detail-content">{{ selectedDocument.document.content || '暂无正文内容。' }}</pre>
          </n-scrollbar>
        </div>
      </n-card>
    </n-modal>
  </section>
</template>

<style scoped>
.knowledge-screen {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
}

.knowledge-screen-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.knowledge-panel-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.knowledge-panel-title strong {
  font-size: 16px;
  font-weight: 700;
}

.knowledge-panel-title span {
  color: var(--arc-text-secondary);
  font-size: 12px;
}

.knowledge-screen-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.knowledge-center {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.deconstruction-command-deck {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
  gap: 18px;
  border: 1px solid color-mix(in srgb, var(--arc-primary) 14%, var(--arc-border));
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--arc-primary) 16%, transparent) 0%, transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--arc-bg-surface) 92%, white) 0%, var(--arc-bg-surface) 100%);
  padding: 24px 26px;
}

.deconstruction-command-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deconstruction-command-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.92);
  color: rgba(241, 245, 249, 0.98);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  padding: 7px 12px;
  text-transform: uppercase;
}

.deconstruction-command-copy h2 {
  margin: 0;
  color: var(--arc-text-primary);
  font-size: 30px;
  line-height: 1.12;
  letter-spacing: -0.05em;
}

.deconstruction-command-copy p {
  margin: 0;
  max-width: 46rem;
  color: var(--arc-text-secondary);
  font-size: 14px;
  line-height: 1.78;
}

.deconstruction-command-actions {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid color-mix(in srgb, var(--arc-primary) 12%, var(--arc-border));
  border-radius: 22px;
  background: color-mix(in srgb, var(--arc-primary) 6%, var(--arc-bg-surface));
  padding: 18px;
}

.deconstruction-command-topline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deconstruction-command-topline span {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--arc-primary) 12%, var(--arc-bg-mix));
  color: var(--arc-primary);
  font-size: 11px;
  font-weight: 800;
  padding: 6px 10px;
}

.deconstruction-command-topline small {
  color: var(--arc-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.deconstruction-command-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.deconstruction-progress-card {
  border: 1px solid var(--arc-border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--arc-bg-surface) 92%, white);
  padding: 18px 20px;
}

.deconstruction-progress-card.active {
  border-color: color-mix(in srgb, var(--arc-primary) 24%, var(--arc-border));
  background: color-mix(in srgb, var(--arc-primary) 5%, var(--arc-bg-surface));
}

.knowledge-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.8fr);
  gap: 20px;
  border: 1px solid color-mix(in srgb, var(--arc-primary) 14%, var(--arc-border));
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--arc-primary) 20%, transparent) 0%, transparent 38%),
    linear-gradient(135deg, color-mix(in srgb, var(--arc-bg-surface) 88%, white) 0%, var(--arc-bg-surface) 100%);
  padding: 26px 28px;
}

.knowledge-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.knowledge-hero-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--arc-primary) 10%, transparent);
  color: var(--arc-primary);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.knowledge-hero-copy h2 {
  margin: 0;
  color: var(--arc-text-primary);
  font-size: 26px;
  line-height: 1.2;
}

.knowledge-hero-copy p {
  margin: 0;
  max-width: 720px;
  color: var(--arc-text-secondary);
  line-height: 1.7;
}

.knowledge-hero-side {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 20px;
  background: color-mix(in srgb, var(--arc-primary) 6%, var(--arc-bg-surface));
  padding: 18px 20px;
}

.knowledge-hero-chip {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  color: var(--arc-text-secondary);
  font-size: 12px;
}

.knowledge-hero-side strong {
  color: var(--arc-text-primary);
  font-size: 42px;
  line-height: 1;
}

.knowledge-hero-side span:last-child {
  color: var(--arc-text-secondary);
  font-size: 13px;
}

.knowledge-stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.knowledge-stat-card {
  border: 1px solid var(--arc-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--arc-bg-surface) 90%, white);
  padding: 18px 20px;
}

.knowledge-stat-label {
  display: block;
  color: var(--arc-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.knowledge-stat-card strong {
  display: block;
  margin-top: 10px;
  color: var(--arc-text-primary);
  font-size: 28px;
  line-height: 1.1;
}

.knowledge-stat-card p {
  margin: 10px 0 0;
  color: var(--arc-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.knowledge-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.knowledge-toolbar-search {
  min-width: min(100%, 320px);
  flex: 1;
}

.knowledge-toolbar-filter {
  width: 220px;
}

.knowledge-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.knowledge-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-section-head h3 {
  margin: 0;
  color: var(--arc-text-primary);
  font-size: 18px;
}

.knowledge-section-head p {
  margin: 6px 0 0;
  color: var(--arc-text-secondary);
  line-height: 1.6;
}

.knowledge-inline-alert {
  border-radius: 16px;
}

.knowledge-group-grid,
.knowledge-document-grid,
.knowledge-asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.knowledge-group-card,
.knowledge-document-card,
.knowledge-asset-card {
  border-radius: 20px;
  background: color-mix(in srgb, var(--arc-bg-surface) 92%, white);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.knowledge-group-card--conflict {
  border: 1px solid color-mix(in srgb, #ef4444 20%, var(--arc-border));
}

.knowledge-document-card {
  cursor: pointer;
}

.knowledge-group-card:hover,
.knowledge-document-card:hover,
.knowledge-asset-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.knowledge-group-headline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.knowledge-group-headline strong {
  color: var(--arc-text-primary);
}

.knowledge-group-headline span,
.knowledge-conflict-reason {
  color: var(--arc-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.knowledge-conflict-reason {
  margin: 0 0 14px;
}

.knowledge-group-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge-group-item {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--arc-border) 86%, transparent);
  border-radius: 16px;
  background: var(--arc-bg-surface);
  padding: 14px;
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.knowledge-group-item:hover {
  border-color: color-mix(in srgb, var(--arc-primary) 26%, var(--arc-border));
  background: color-mix(in srgb, var(--arc-primary) 4%, var(--arc-bg-surface));
}

.knowledge-group-item--conflict:hover {
  border-color: color-mix(in srgb, #ef4444 22%, var(--arc-border));
  background: color-mix(in srgb, #ef4444 4%, var(--arc-bg-surface));
}

.knowledge-group-item-top,
.knowledge-group-item-meta,
.knowledge-document-top,
.knowledge-document-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-group-item-top strong,
.knowledge-document-headline h4 {
  color: var(--arc-text-primary);
}

.knowledge-group-item-top span,
.knowledge-group-item-meta,
.knowledge-document-headline span,
.knowledge-document-time {
  color: var(--arc-text-secondary);
  font-size: 12px;
}

.knowledge-group-item p,
.knowledge-document-preview,
.knowledge-asset-summary {
  margin: 0;
  color: var(--arc-text-secondary);
  line-height: 1.7;
}

.knowledge-document-headline {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.knowledge-document-headline h4 {
  margin: 0;
  font-size: 16px;
}

.knowledge-document-tags,
.knowledge-document-keywords,
.knowledge-detail-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.knowledge-document-keywords span,
.knowledge-detail-keywords span {
  border-radius: 999px;
  background: color-mix(in srgb, var(--arc-primary) 10%, transparent);
  color: var(--arc-primary);
  padding: 4px 10px;
  font-size: 12px;
}

.knowledge-asset-badge,
.knowledge-asset-actions,
.knowledge-asset-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.knowledge-asset-badge {
  color: var(--arc-text-secondary);
  font-size: 12px;
}

.knowledge-asset-metrics {
  margin: 14px 0;
  color: var(--arc-text-secondary);
  font-size: 12px;
}

.knowledge-asset-actions {
  margin-top: 16px;
}

.reference-skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.reference-skill-card {
  border: 1px solid var(--arc-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--arc-bg-surface) 94%, white);
  padding: 16px;
}

.reference-skill-card strong {
  display: block;
  color: var(--arc-text-primary);
  font-size: 14px;
}

.reference-skill-card p {
  margin: 8px 0 12px;
  color: var(--arc-text-secondary);
  font-size: 12px;
  line-height: 1.72;
}

.knowledge-detail-modal {
  width: min(960px, 92vw);
  border-radius: 24px;
}

.knowledge-detail-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.knowledge-detail-title strong {
  color: var(--arc-text-primary);
  font-size: 18px;
}

.knowledge-detail-title span,
.knowledge-detail-meta {
  color: var(--arc-text-secondary);
  font-size: 13px;
}

.knowledge-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.knowledge-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.knowledge-detail-scroll {
  max-height: 56vh;
  border: 1px solid var(--arc-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--arc-bg-surface) 94%, black 2%);
  padding: 18px;
}

.knowledge-detail-content {
  margin: 0;
  color: var(--arc-text-primary);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .knowledge-stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .deconstruction-command-deck,
  .knowledge-hero,
  .knowledge-group-grid,
  .knowledge-document-grid,
  .knowledge-asset-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reference-skill-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-toolbar-filter {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .knowledge-hero,
  .knowledge-stat-card {
    padding: 18px;
  }

  .knowledge-stats-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-document-top,
  .knowledge-document-bottom,
  .knowledge-group-item-top,
  .knowledge-group-item-meta,
  .knowledge-section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
