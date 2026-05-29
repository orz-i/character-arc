<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Minimize } from 'lucide-vue-next'
import ChapterTreeSidebar from './ChapterTreeSidebar.vue'
import ChapterEditorPane from './ChapterEditorPane.vue'
import ChapterAiPanel from './ChapterAiPanel.vue'

const COMPACT_BREAKPOINT = 1180
const COMPACT_BREAKPOINT_AI_OPEN = 1440

const aiOpen = ref(true)
const focusMode = ref(false)
const sidebarDrawerVisible = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const isCompact = computed(() => {
  const threshold = aiOpen.value ? COMPACT_BREAKPOINT_AI_OPEN : COMPACT_BREAKPOINT
  return viewportWidth.value <= threshold
})
const aiPanelRef = ref<InstanceType<typeof ChapterAiPanel> | null>(null)

function toggleAi(): void {
  aiOpen.value = !aiOpen.value
}

function toggleFocus(): void {
  focusMode.value = !focusMode.value
}

function toggleSidebar(): void {
  sidebarDrawerVisible.value = !sidebarDrawerVisible.value
}

function handleSelectionAction(action: string, text: string): void {
  aiOpen.value = true
  const snippet = text.length > 60 ? text.slice(0, 60) + '...' : text
  const prompt = `[${action}] ${snippet}`
  nextTick(() => {
    aiPanelRef.value?.sendPrompt(prompt)
  })
}

function handleGenerateDraft(): void {
  aiOpen.value = true
  nextTick(() => {
    aiPanelRef.value?.triggerDraft()
  })
}

function syncViewport(): void {
  viewportWidth.value = window.innerWidth
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'F11') {
    event.preventDefault()
    toggleFocus()
    return
  }
  if (event.key === 'Escape' && focusMode.value) {
    toggleFocus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', syncViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', syncViewport)
})
</script>

<template>
  <section
    class="chapter-workspace"
    :class="{ 'ai-open': aiOpen, focus: focusMode, compact: isCompact }"
  >
    <ChapterTreeSidebar v-if="!focusMode && !isCompact" class="ws-sidebar" />
    <ChapterEditorPane
      class="ws-editor"
      :ai-open="aiOpen"
      :focus-mode="focusMode"
      :show-sidebar-toggle="!focusMode && isCompact"
      @toggle-ai="toggleAi"
      @toggle-focus="toggleFocus"
      @toggle-sidebar="toggleSidebar"
      @selection-action="handleSelectionAction"
      @generate-draft="handleGenerateDraft"
    />
    <ChapterAiPanel v-if="aiOpen" ref="aiPanelRef" class="ws-ai" @close="aiOpen = false" />
    <button v-if="focusMode" class="focus-exit" @click="toggleFocus">
      <Minimize :size="13" />
      <span>退出专注 (Esc)</span>
    </button>

    <Transition name="sidebar-slide">
      <div v-if="isCompact && sidebarDrawerVisible && !focusMode" class="sidebar-overlay">
        <div class="sidebar-backdrop" @click="sidebarDrawerVisible = false" />
        <div class="sidebar-panel">
          <ChapterTreeSidebar @navigate="sidebarDrawerVisible = false" />
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.chapter-workspace {
  position: relative;
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  width: 100%;
  background: var(--arc-bg-body);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.chapter-workspace.ai-open {
  grid-template-columns: 280px 1fr 380px;
}

.chapter-workspace.focus {
  grid-template-columns: 1fr;
}

.chapter-workspace.focus.ai-open {
  grid-template-columns: 1fr 380px;
}

.chapter-workspace.compact {
  grid-template-columns: 1fr;
}

.chapter-workspace.compact.ai-open {
  grid-template-columns: 1fr 320px;
}

.ws-sidebar,
.ws-editor,
.ws-ai {
  min-width: 0;
  min-height: 0;
}

.focus-exit {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--arc-bg-surface);
  border: 1px solid var(--arc-border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--arc-text-secondary);
  cursor: pointer;
  box-shadow: var(--arc-shadow-sm);
}

.focus-exit:hover {
  color: var(--arc-text-primary);
}

.sidebar-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
}

.sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
}

.sidebar-panel {
  position: relative;
  width: 300px;
  height: 100%;
  box-shadow: var(--arc-shadow-lg);
  z-index: 1;
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: opacity 0.2s ease;
}

.sidebar-slide-enter-active .sidebar-panel,
.sidebar-slide-leave-active .sidebar-panel {
  transition: transform 0.2s ease;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  opacity: 0;
}

.sidebar-slide-enter-from .sidebar-panel,
.sidebar-slide-leave-to .sidebar-panel {
  transform: translateX(-100%);
}
</style>
