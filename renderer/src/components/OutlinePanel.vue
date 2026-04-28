<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { GitMerge, MoreVertical, Plus, Sparkles } from 'lucide-vue-next'
import { NButton, NDropdown, NForm, NFormItem, NInput, useDialog, useMessage, NModal } from 'naive-ui'
import { useAppStore } from '@/stores/app'
import type { DropdownOption } from 'naive-ui'
import type { OutlineItem } from '@/types/app'

const props = defineProps<{
  searchQuery?: string
}>()

const appStore = useAppStore()
const dialog = useDialog()
const message = useMessage()
const isExpanding = ref(false)
const editorVisible = ref(false)
const editingOutlineId = ref<string | null>(null)
const form = reactive({
  title: '',
  wordTarget: '',
  conflict: '',
  summary: ''
})
const menuOptions: DropdownOption[] = [
  { key: 'edit', label: '编辑节点' },
  { key: 'delete', label: '删除节点' }
]
const filteredOutlineItems = computed(() => {
  const query = props.searchQuery?.trim().toLowerCase() ?? ''
  if (!query) {
    return appStore.outlineItems
  }

  return appStore.outlineItems.filter((item) =>
    `${item.title} ${item.conflict} ${item.summary}`.toLowerCase().includes(query)
  )
})

function handleCreateOutline(): void {
  editingOutlineId.value = null
  form.title = ''
  form.wordTarget = '预估 3000字'
  form.conflict = ''
  form.summary = ''
  editorVisible.value = true
}

function handleExpandOutline(): void {
  if (isExpanding.value) {
    return
  }

  isExpanding.value = true

  window.setTimeout(() => {
    appStore.createOutlineItem({
      title: `第${appStore.outlineItems.length + 1}章：夜城回响`,
      wordTarget: '预估 3200字',
      conflict: '旧记忆与现实情报发生冲突。',
      summary: '主角通过记忆回响锁定一段被篡改的线索，却因此暴露了自身的位置，被迫提前面对追猎者。'
    })
    isExpanding.value = false
    message.success('AI 已补充新的大纲节点')
  }, 700)
}

function openEditor(item?: OutlineItem): void {
  editingOutlineId.value = item?.id ?? null
  form.title = item?.title ?? ''
  form.wordTarget = item?.wordTarget ?? '预估 3000字'
  form.conflict = item?.conflict ?? ''
  form.summary = item?.summary ?? ''
  editorVisible.value = true
}

function submitOutline(): void {
  if (!form.title.trim() || !form.summary.trim()) {
    message.warning('请完整填写节点标题和剧情描述')
    return
  }

  if (editingOutlineId.value) {
    appStore.updateOutlineItem(editingOutlineId.value, form)
    message.success('大纲节点已更新')
  } else {
    appStore.createOutlineItem(form)
    message.success('已新增大纲节点')
  }

  editorVisible.value = false
}

function handleMenuSelect(action: string | number, item: OutlineItem): void {
  if (action === 'edit') {
    openEditor(item)
    return
  }

  dialog.warning({
    title: '确认删除节点',
    content: `确定要删除“${item.title}”吗？删除后该大纲节点将无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    autoFocus: false,
    closable: false,
    onPositiveClick: () => {
      appStore.deleteOutlineItem(item.id)
      message.success('大纲节点已删除')
    }
  })
}
</script>

<template>
  <section class="outline-panel">
    <div class="section-head">
      <div>
        <h2>剧情大纲</h2>
        <p>整理篇章结构与关键冲突，让章节推进更加稳定。</p>
      </div>
      <button class="soft-button" :disabled="isExpanding" @click="handleExpandOutline">
        <Sparkles :size="16" />
        <span>{{ isExpanding ? '扩写中...' : 'AI 扩写大纲' }}</span>
      </button>
    </div>

    <div class="outline-wrap">
      <div class="volume-title">第一卷：霓虹下的老鼠 (目标字数: 5万字)</div>
      <div class="outline-list">
        <article v-for="item in filteredOutlineItems" :key="item.id" class="outline-item" @click="openEditor(item)">
          <div class="outline-header">
            <span class="outline-title">{{ item.title }}</span>
            <div class="outline-actions">
              <span class="outline-word">{{ item.wordTarget }}</span>
              <n-dropdown :options="menuOptions" placement="bottom-end" @select="(key) => handleMenuSelect(key, item)">
                <button class="more-button" @click.stop>
                  <MoreVertical :size="14" />
                </button>
              </n-dropdown>
            </div>
          </div>
          <div class="outline-desc">
            <b>核心冲突：</b>{{ item.conflict }}<br />
            <b>剧情：</b>{{ item.summary }}
          </div>
        </article>
        <button v-if="!props.searchQuery" class="outline-add" @click="handleCreateOutline">
          <Plus :size="16" />
          <span>新增章节节点</span>
        </button>
      </div>
    </div>

    <div v-if="filteredOutlineItems.length === 0" class="arc-empty-state">
      没有匹配“{{ props.searchQuery }}”的大纲节点。
    </div>

    <n-modal
      :show="editorVisible"
      preset="card"
      class="arc-editor-modal"
      :title="editingOutlineId ? '编辑大纲节点' : '新建大纲节点'"
      :bordered="false"
      @close="editorVisible = false"
    >
      <n-form label-placement="top">
        <n-form-item label="节点标题">
          <n-input v-model:value="form.title" placeholder="例如：第4章：夜城回响" />
        </n-form-item>
        <n-form-item label="预估字数">
          <n-input v-model:value="form.wordTarget" placeholder="例如：预估 3200字" />
        </n-form-item>
        <n-form-item label="核心冲突">
          <n-input v-model:value="form.conflict" placeholder="概括这一节点的核心矛盾..." />
        </n-form-item>
        <n-form-item label="剧情描述">
          <n-input
            v-model:value="form.summary"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 7 }"
            placeholder="补充这一节点如何推进剧情..."
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="arc-modal-actions">
          <n-button round strong @click="editorVisible = false">取消</n-button>
          <n-button type="primary" round strong @click="submitOutline">
            {{ editingOutlineId ? '保存修改' : '创建节点' }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </section>
</template>

<style scoped>
.outline-panel {
  max-width: 960px;
  margin: 0 auto;
}

.section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 32px;
  gap: 16px;
  flex-wrap: wrap;
}

.section-head h2 {
  margin: 0 0 8px;
  font-size: clamp(30px, 3.4vw, 38px);
  font-weight: 650;
  letter-spacing: -0.04em;
}

.section-head p {
  margin: 0;
  color: #86868b;
  font-size: 15px;
}

.soft-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 999px;
  background: #f5f5f7;
  color: #1d1d1f;
  cursor: pointer;
  font-size: 14px;
  font-weight: 650;
  padding: 12px 18px;
}

.soft-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.soft-button :deep(svg) {
  color: var(--arc-primary);
}

.outline-wrap {
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

.volume-title {
  margin: 0 0 18px;
  font-size: 22px;
  font-weight: 650;
}

.outline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.outline-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(243, 244, 246, 0.9);
  border-radius: 20px;
  background: white;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
  padding: 16px 20px;
}

.outline-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.05);
}

.outline-item:hover .outline-title {
  color: var(--arc-primary);
}

.outline-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 15px;
  font-weight: 600;
}

.outline-title {
  flex: 1;
}

.outline-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.outline-word {
  color: var(--arc-text-secondary);
  font-size: 12px;
  font-weight: 400;
}

.more-button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #c4cad4;
  cursor: pointer;
}

.more-button:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #6b7280;
}

.outline-desc {
  border-radius: var(--arc-radius-sm);
  background: var(--arc-bg-surface-hover);
  color: var(--arc-text-secondary);
  font-size: 13px;
  line-height: 1.7;
  padding: 12px;
}

.outline-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: 1px dashed var(--arc-border);
  border-radius: var(--arc-radius-md);
  background: transparent;
  color: var(--arc-text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 18px 20px;
}

@media (max-width: 760px) {
  .soft-button {
    width: 100%;
    justify-content: center;
  }

  .outline-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
