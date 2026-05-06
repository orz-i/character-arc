<script setup lang="ts">
import { computed } from 'vue'
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NScrollbar, NSpace, NTag } from 'naive-ui'
import type { AgentConfirmationState, AgentExecutionStep, AgentProposal, WorkflowDocumentKey } from '@/types/app'

const props = defineProps<{
  proposal: AgentProposal | null
  confirmationState: AgentConfirmationState | null
  executionStep: AgentExecutionStep
}>()

const emit = defineEmits<{
  approve: []
  reject: []
  clear: []
}>()

function resolveWorkflowDocumentLabel(key: WorkflowDocumentKey): string {
  switch (key) {
    case 'task_plan':
      return 'task_plan / 任务计划'
    case 'findings':
      return 'findings / 发现记录'
    case 'progress':
      return 'progress / 进度记录'
    case 'current_status':
      return 'current_status / 当前状态'
    case 'novel_setting':
      return 'novel_setting / 小说设定'
    case 'character_relationships':
      return 'character_relationships / 人物关系'
    case 'pending_hooks':
      return 'pending_hooks / 待回收钩子'
    case 'resource_ledger':
      return 'resource_ledger / 资源账本'
  }
}

const statusType = computed(() => {
  switch (props.proposal?.status) {
    case 'approved':
    case 'applied':
      return 'success'
    case 'rejected':
      return 'warning'
    default:
      return 'info'
  }
})

const statusLabel = computed(() => {
  switch (props.proposal?.status) {
    case 'approved':
      return '已确认'
    case 'applied':
      return '已执行'
    case 'rejected':
      return '已拒绝'
    default:
      return props.proposal?.requiresConfirmation ? '待确认' : '可直接执行'
  }
})

const destructiveLabel = computed(() => (props.proposal?.destructive ? '破坏性写入' : '安全写入'))

const commandTypeLabel = computed(() => {
  switch (props.proposal?.commandType) {
    case 'insert-into-chapter':
      return '写入正文'
    case 'update-chapter-title':
      return '更新标题'
    case 'update-chapter-summary':
      return '更新摘要'
    case 'create-outline-item':
      return '创建大纲'
    case 'append-workflow-document-entry':
      return '追加流程记录'
    case 'update-workflow-document':
      return '覆盖流程文档'
    case 'save-knowledge-document':
      return '沉淀项目知识'
    default:
      return '写作动作'
  }
})

const targetLabel = computed(() => {
  switch (props.proposal?.target) {
    case 'chapter-content':
      return '章节正文'
    case 'chapter-title':
      return '章节标题'
    case 'chapter-summary':
      return '章节摘要'
    case 'outline-item':
      return '大纲节点'
    case 'workflow-document':
      return '流程文档'
    case 'knowledge-document':
      return '项目知识库'
    default:
      return '当前项目'
  }
})

const beforeLabel = computed(() => {
  switch (props.proposal?.commandType) {
    case 'update-chapter-title':
      return '当前标题'
    case 'update-chapter-summary':
      return '当前摘要'
    case 'append-workflow-document-entry':
    case 'update-workflow-document':
      return '当前文档'
    default:
      return '当前内容'
  }
})

const afterLabel = computed(() => {
  switch (props.proposal?.commandType) {
    case 'update-chapter-title':
      return '提议标题'
    case 'update-chapter-summary':
      return '提议摘要'
    case 'save-knowledge-document':
      return '知识内容'
    default:
      return '提议内容'
  }
})

const detailItems = computed(() => {
  const proposal = props.proposal
  if (!proposal) {
    return []
  }

  const payload = proposal.payload as Record<string, unknown>
  const details: Array<{ label: string; value: string }> = [
    { label: '动作类型', value: commandTypeLabel.value },
    { label: '写入目标', value: targetLabel.value }
  ]

  switch (proposal.commandType) {
    case 'insert-into-chapter': {
      const mode = String(payload.mode ?? '').trim()
      details.push({
        label: '写入方式',
        value: mode === 'replace-selection' ? '替换选区' : mode === 'cursor' ? '插入光标处' : '追加到末尾'
      })
      break
    }
    case 'create-outline-item': {
      const title = String((payload.payload as Record<string, unknown> | undefined)?.title ?? '').trim()
      const volumeId = String((payload.payload as Record<string, unknown> | undefined)?.volumeId ?? '').trim()
      if (title) details.push({ label: '节点标题', value: title })
      if (volumeId) details.push({ label: '目标分卷', value: volumeId })
      break
    }
    case 'append-workflow-document-entry': {
      const documentKey = String(payload.documentKey ?? '').trim() as WorkflowDocumentKey
      const entryTitle = String(payload.entryTitle ?? '').trim()
      const volumeId = String(payload.volumeId ?? '').trim()
      if (documentKey) details.push({ label: '目标文档', value: resolveWorkflowDocumentLabel(documentKey) })
      if (entryTitle) details.push({ label: '条目标题', value: entryTitle })
      if (volumeId) details.push({ label: '目标分卷', value: volumeId })
      break
    }
    case 'update-workflow-document': {
      const documentKey = String(payload.documentKey ?? '').trim() as WorkflowDocumentKey
      const volumeId = String(payload.volumeId ?? '').trim()
      if (documentKey) details.push({ label: '目标文档', value: resolveWorkflowDocumentLabel(documentKey) })
      if (volumeId) details.push({ label: '目标分卷', value: volumeId })
      break
    }
    case 'save-knowledge-document': {
      const document = (payload.document ?? payload) as Record<string, unknown>
      const title = String(document.title ?? '').trim()
      const sourceType = String(document.sourceType ?? '').trim()
      const sourceLabel = String(document.sourceLabel ?? '').trim()
      const keywords = Array.isArray(document.keywords)
        ? document.keywords.map((item) => String(item).trim()).filter(Boolean).join('、')
        : ''
      if (title) details.push({ label: '知识标题', value: title })
      if (sourceType) details.push({ label: '知识来源', value: sourceType })
      if (sourceLabel) details.push({ label: '来源标记', value: sourceLabel })
      if (keywords) details.push({ label: '关键词', value: keywords })
      break
    }
  }

  return details
})

const confirmationMeta = computed(() => {
  if (props.confirmationState?.confirmedAt) {
    return `确认时间：${new Date(props.confirmationState.confirmedAt).toLocaleString()}`
  }
  if (props.confirmationState?.rejectedAt) {
    return `拒绝时间：${new Date(props.confirmationState.rejectedAt).toLocaleString()}`
  }
  return ''
})
</script>

<template>
  <section v-if="props.proposal" class="claude-assistant-proposal">
    <NCard size="small" embedded class="claude-assistant-proposal__card">
      <template #header>
        <div class="claude-assistant-proposal__header">
          <strong>{{ props.proposal.preview.title }}</strong>
          <NSpace size="small" align="center">
            <NTag size="small" :type="statusType" round>{{ statusLabel }}</NTag>
            <NTag size="small" :type="props.proposal.destructive ? 'warning' : 'success'" round>{{ destructiveLabel }}</NTag>
          </NSpace>
        </div>
      </template>

      <NSpace vertical size="small">
        <p class="claude-assistant-proposal__summary">{{ props.proposal.preview.summary }}</p>

        <NDescriptions
          size="small"
          label-placement="left"
          :column="1"
          bordered
          class="claude-assistant-proposal__details"
        >
          <NDescriptionsItem
            v-for="item in detailItems"
            :key="item.label"
            :label="item.label"
          >
            {{ item.value }}
          </NDescriptionsItem>
        </NDescriptions>

        <NAlert v-if="props.proposal.reason" type="info" :show-icon="false">
          {{ props.proposal.reason }}
        </NAlert>

        <NAlert v-if="confirmationMeta" type="default" :show-icon="false">
          {{ confirmationMeta }}
        </NAlert>

        <div v-if="props.proposal.preview.before || props.proposal.preview.after" class="claude-assistant-proposal__preview-grid">
          <div v-if="props.proposal.preview.before" class="claude-assistant-proposal__preview-block">
            <span>{{ beforeLabel }}</span>
            <NScrollbar class="claude-assistant-proposal__preview-scroll">
              <pre>{{ props.proposal.preview.before }}</pre>
            </NScrollbar>
          </div>
          <div v-if="props.proposal.preview.after" class="claude-assistant-proposal__preview-block">
            <span>{{ afterLabel }}</span>
            <NScrollbar class="claude-assistant-proposal__preview-scroll">
              <pre>{{ props.proposal.preview.after }}</pre>
            </NScrollbar>
          </div>
        </div>

        <NAlert v-if="props.proposal.destructive" type="warning" :show-icon="false">
          这个动作会修改现有内容，建议确认后再执行。
        </NAlert>

        <div class="claude-assistant-proposal__actions">
          <NButton
            v-if="props.proposal.status === 'pending'"
            type="primary"
            size="small"
            :loading="props.executionStep === 'applying'"
            @click="emit('approve')"
          >
            确认执行
          </NButton>
          <NButton
            v-if="props.proposal.status === 'pending'"
            size="small"
            secondary
            @click="emit('reject')"
          >
            暂不执行
          </NButton>
          <NButton
            v-if="props.proposal.status !== 'pending'"
            size="small"
            quaternary
            @click="emit('clear')"
          >
            关闭
          </NButton>
        </div>
      </NSpace>
    </NCard>
  </section>
</template>

<style scoped>
.claude-assistant-proposal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.claude-assistant-proposal__summary {
  margin: 0;
  line-height: 1.6;
  color: var(--arc-text-primary);
}

.claude-assistant-proposal__details :deep(.n-descriptions-table-wrapper) {
  background: var(--arc-bg-surface);
  border-radius: 10px;
}

.claude-assistant-proposal__details :deep(.n-descriptions-table) {
  color: var(--arc-text-primary);
}

.claude-assistant-proposal__details :deep(.n-descriptions-table-header),
.claude-assistant-proposal__details :deep(.n-descriptions-table-content) {
  color: var(--arc-text-primary);
}

.claude-assistant-proposal__preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.claude-assistant-proposal__preview-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.claude-assistant-proposal__preview-scroll {
  max-height: 164px;
  border-radius: 10px;
  background: var(--arc-bg-surface);
  border: 1px solid var(--arc-border);
}

.claude-assistant-proposal__preview-block > span {
  font-size: 12px;
  color: var(--arc-text-secondary);
}

.claude-assistant-proposal__preview-block pre {
  margin: 0;
  padding: 10px 12px;
  color: var(--arc-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  font-family: inherit;
  font-size: 12px;
}

.claude-assistant-proposal__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 900px) {
  .claude-assistant-proposal__preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
