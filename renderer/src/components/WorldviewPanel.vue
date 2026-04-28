<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { MoreVertical, Plus, Sparkles } from 'lucide-vue-next'
import { NButton, NDropdown, NForm, NFormItem, NInput, NModal, NSelect, useDialog, useMessage } from 'naive-ui'
import { useAppStore } from '@/stores/app'
import type { DropdownOption } from 'naive-ui'
import type { WorldviewEntry } from '@/types/app'

const props = defineProps<{
  searchQuery?: string
}>()

const appStore = useAppStore()
const dialog = useDialog()
const message = useMessage()
const isGenerating = ref(false)
const editorVisible = ref(false)
const editingEntryId = ref<string | null>(null)
const form = reactive({
  type: '地理',
  title: '',
  content: ''
})

const entryTypes = ['地理', '法则', '物种']
const typeOptions = entryTypes.map((type) => ({ label: type, value: type }))
const filteredEntries = computed(() => {
  const query = props.searchQuery?.trim().toLowerCase() ?? ''
  if (!query) {
    return appStore.worldviewEntries
  }

  return appStore.worldviewEntries.filter((entry) =>
    `${entry.type} ${entry.title} ${entry.content}`.toLowerCase().includes(query)
  )
})
const isEditing = computed(() => Boolean(editingEntryId.value))
const menuOptions: DropdownOption[] = [
  { key: 'edit', label: '编辑词条' },
  { key: 'delete', label: '删除词条' }
]

function handleCreateEntry(): void {
  editingEntryId.value = null
  form.type = '地理'
  form.title = ''
  form.content = ''
  editorVisible.value = true
}

function handleGenerateEntry(): void {
  if (isGenerating.value) {
    return
  }

  isGenerating.value = true

  // Keep this mocked generation light for now; later it can be replaced with the real AI pipeline.
  window.setTimeout(() => {
    appStore.createWorldviewEntry({
      title: '新法则：记忆回响',
      content: '某些高强度情绪会在夜城的义体网络中留下“记忆回响”，被特定接口捕捉后可重现他人的感官残影。'
    })
    isGenerating.value = false
    message.success('AI 已生成新的世界观词条草稿')
  }, 700)
}

function openEditor(entry?: WorldviewEntry): void {
  editingEntryId.value = entry?.id ?? null
  form.type = entry?.type ?? '地理'
  form.title = entry?.title ?? ''
  form.content = entry?.content ?? ''
  editorVisible.value = true
}

function submitEntry(): void {
  if (!form.title.trim() || !form.content.trim()) {
    message.warning('请完整填写词条标题和词条内容')
    return
  }

  if (editingEntryId.value) {
    appStore.updateWorldviewEntry(editingEntryId.value, form)
    message.success('世界观词条已更新')
  } else {
    appStore.createWorldviewEntry(form)
    message.success('已新增世界观词条')
  }

  editorVisible.value = false
}

function handleMenuSelect(action: string | number, entry: WorldviewEntry): void {
  if (action === 'edit') {
    openEditor(entry)
    return
  }

  dialog.warning({
    title: '确认删除词条',
    content: `确定要删除“${entry.title}”吗？删除后词条内容将无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    autoFocus: false,
    closable: false,
    onPositiveClick: () => {
      appStore.deleteWorldviewEntry(entry.id)
      message.success('世界观词条已删除')
    }
  })
}
</script>

<template>
  <section class="world-panel">
    <div class="section-head">
      <div>
        <h2>世界观设定</h2>
        <p>AI 协助构建的世界基石，所有的故事都在这里发生。</p>
      </div>
      <div class="head-actions">
        <button class="soft-button" :disabled="isGenerating" @click="handleGenerateEntry">
          <Sparkles :size="16" />
          <span>{{ isGenerating ? '生成中...' : 'AI 扩写' }}</span>
        </button>
        <button class="primary-button" @click="handleCreateEntry">
          <Plus :size="16" />
          <span>新建词条</span>
        </button>
      </div>
    </div>

    <div class="world-grid">
      <article
        v-for="(entry, index) in filteredEntries"
        :key="entry.id"
        class="world-card"
        :style="{ animationDelay: `${index * 70}ms` }"
        @click="openEditor(entry)"
      >
        <div class="card-top">
          <span class="entry-type">{{ entry.type }}</span>
          <n-dropdown :options="menuOptions" placement="bottom-end" @select="(key) => handleMenuSelect(key, entry)">
            <button class="more-button" @click.stop>
              <MoreVertical :size="14" />
            </button>
          </n-dropdown>
        </div>
        <h3>{{ entry.title }}</h3>
        <p>{{ entry.content }}</p>
      </article>

      <button v-if="!props.searchQuery" class="empty-card" @click="handleCreateEntry">
        <Plus :size="28" />
        <span>添加新设定</span>
      </button>
    </div>

    <div v-if="filteredEntries.length === 0" class="arc-empty-state">
      没有匹配“{{ props.searchQuery }}”的世界观设定。
    </div>

    <n-modal
      :show="editorVisible"
      preset="card"
      class="arc-editor-modal"
      :title="isEditing ? '编辑世界观词条' : '新建世界观词条'"
      :bordered="false"
      @close="editorVisible = false"
    >
      <n-form label-placement="top">
        <n-form-item label="词条分类">
          <n-select v-model:value="form.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="词条标题">
          <n-input v-model:value="form.title" placeholder="例如：新法则 / 地理区域 / 势力设定" />
        </n-form-item>
        <n-form-item label="词条内容">
          <n-input
            v-model:value="form.content"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 8 }"
            placeholder="补充这个词条的核心设定与作用..."
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="arc-modal-actions">
          <n-button round strong @click="editorVisible = false">取消</n-button>
          <n-button type="primary" round strong @click="submitEntry">
            {{ isEditing ? '保存修改' : '创建词条' }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </section>
</template>

<style scoped>
.world-panel {
  max-width: 1180px;
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
  color: #1d1d1f;
  font-size: clamp(30px, 3.4vw, 38px);
  font-weight: 650;
  letter-spacing: -0.04em;
}

.section-head p {
  margin: 0;
  color: #86868b;
  font-size: 15px;
}

.head-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.soft-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 650;
  padding: 12px 18px;
  transition: all 0.24s ease;
}

.soft-button:disabled,
.primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.soft-button {
  background: #f5f5f7;
  color: #1d1d1f;
}

.soft-button :deep(svg) {
  color: var(--arc-primary);
}

.soft-button:hover {
  background: #ebedf0;
}

.primary-button {
  background: var(--arc-primary);
  color: white;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--arc-primary) 24%, transparent);
}

.primary-button:hover {
  background: var(--arc-primary-hover);
  transform: translateY(-2px);
}

.world-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.world-card {
  border: 1px solid rgba(243, 244, 246, 0.9);
  border-radius: 28px;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  padding: 24px;
  animation: floatIn 0.42s ease both;
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease;
}

.world-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
}

.world-card::after {
  content: '点击编辑';
  display: inline-flex;
  margin-top: 14px;
  color: rgba(31, 41, 55, 0);
  font-size: 11px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.world-card:hover h3 {
  color: var(--arc-primary);
}

.world-card:hover::after {
  color: #9ca3af;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.entry-type {
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
  background: #f8fafc;
  color: #86868b;
  font-size: 12px;
  font-weight: 650;
  padding: 7px 10px;
  transition: all 0.2s ease;
}

.world-card:hover .entry-type {
  background: color-mix(in srgb, var(--arc-primary) 10%, white);
  color: var(--arc-primary);
}

.more-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #c4cad4;
  cursor: pointer;
}

.more-button:hover {
  color: #6b7280;
}

.world-card h3 {
  margin: 0 0 12px;
  color: #1d1d1f;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.03em;
}

.world-card p {
  margin: 0;
  color: #86868b;
  font-size: 14px;
  line-height: 1.8;
}

.empty-card {
  display: flex;
  min-height: 212px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 2px dashed rgba(229, 231, 235, 0.95);
  border-radius: 28px;
  background: transparent;
  color: #86868b;
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
  transition: all 0.24s ease;
}

.empty-card:hover {
  background: color-mix(in srgb, var(--arc-primary) 5%, white);
  border-color: color-mix(in srgb, var(--arc-primary) 20%, white);
  color: var(--arc-primary);
}

@media (max-width: 760px) {
  .soft-button,
  .primary-button {
    flex: 1 1 100%;
    justify-content: center;
  }

  .world-grid {
    grid-template-columns: 1fr;
  }
}

@keyframes floatIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
