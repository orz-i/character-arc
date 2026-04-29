<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, Search } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import ChaptersPanel from '@/components/ChaptersPanel.vue'
import AiAssistantPanel from '@/components/AiAssistantPanel.vue'

const appStore = useAppStore()
const searchKeyword = ref('')

const normalizedSearch = computed(() => searchKeyword.value.trim())
const shouldShowAssistant = computed(() => appStore.aiVisible && normalizedSearch.value.length === 0)
const currentChapterTitle = computed(() => appStore.selectedChapter?.title || '未命名章节')
const currentVolumeTitle = computed(() => appStore.selectedChapterVolume?.title || '未分卷')

watch(
  () => appStore.selectedChapterId,
  () => {
    searchKeyword.value = ''
  }
)
</script>

<template>
  <section class="chapter-studio-page">
    <main class="chapter-studio-main">
      <header class="studio-header arc-drag-region">
        <div class="studio-header-main">
          <button class="studio-back arc-no-drag" @click="appStore.backToWorkbench()">
            <ChevronLeft :size="18" />
            <span>返回工作台</span>
          </button>

          <div class="studio-title">
            <span class="studio-kicker">Independent Writing Mode</span>
            <strong>{{ currentChapterTitle }}</strong>
            <p>{{ appStore.currentProject?.title }} · {{ currentVolumeTitle }}</p>
          </div>
        </div>

        <div class="studio-tools arc-no-drag">
          <div class="studio-search">
            <Search :size="14" />
            <input v-model="searchKeyword" type="text" placeholder="筛选章节或摘要..." />
          </div>
        </div>
      </header>

      <div class="studio-body arc-scrollbar">
        <ChaptersPanel :search-query="normalizedSearch" />
      </div>
    </main>

    <AiAssistantPanel v-if="shouldShowAssistant" />
  </section>
</template>

<style scoped>
.chapter-studio-page {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(180deg, #f4f4f1, #f8f8f5 24%, #f3f4f6 100%),
    radial-gradient(circle at top left, color-mix(in srgb, var(--arc-primary) 10%, white), transparent 24%);
}

.chapter-studio-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.studio-header {
  position: sticky;
  top: 0;
  z-index: 14;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(250, 250, 248, 0.84);
  backdrop-filter: blur(18px);
  padding:
    calc(var(--arc-titlebar-height) + 10px)
    max(24px, calc(var(--arc-window-controls-width) + 18px))
    18px
    24px;
}

.studio-header-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}

.studio-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: #475569;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 11px 14px;
  transition: all 0.2s ease;
}

.studio-back:hover {
  border-color: color-mix(in srgb, var(--arc-primary) 18%, white);
  color: var(--arc-primary);
  transform: translateY(-1px);
}

.studio-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.studio-kicker {
  color: color-mix(in srgb, var(--arc-primary) 76%, white);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.studio-title strong {
  overflow: hidden;
  color: #111827;
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio-title p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.studio-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.studio-search {
  display: inline-flex;
  width: clamp(200px, 24vw, 320px);
  min-width: 180px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #94a3b8;
  padding: 10px 14px;
  transition: all 0.24s ease;
}

.studio-search:focus-within {
  border-color: color-mix(in srgb, var(--arc-primary) 24%, white);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--arc-primary) 10%, transparent);
}

.studio-search input {
  width: 100%;
  border: none;
  background: transparent;
  color: #111827;
  font-size: 14px;
  outline: none;
}

.studio-search input::placeholder {
  color: #9ca3af;
}

.studio-body {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding: clamp(18px, 2vw, 28px);
}

@media (max-width: 980px) {
  .studio-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .studio-tools,
  .studio-search {
    width: 100%;
  }
}

@media (max-width: 1360px) {
  .chapter-studio-page {
    flex-direction: column;
  }

  .chapter-studio-main {
    min-height: 0;
  }

  .chapter-studio-page :deep(.assistant-shell) {
    width: 100%;
    min-width: 0;
    max-height: 340px;
    border-left: none;
    border-top: 1px solid rgba(226, 232, 240, 0.82);
  }
}

@media (max-width: 720px) {
  .studio-body {
    padding: 14px;
  }

  .studio-header {
    padding:
      calc(var(--arc-titlebar-height) + 10px)
      max(16px, calc(var(--arc-window-controls-width) + 14px))
      16px
      16px;
  }

  .studio-header-main {
    width: 100%;
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
