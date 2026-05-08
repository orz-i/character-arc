<script setup lang="ts">
import { ChevronLeft, Wrench } from 'lucide-vue-next'
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import ProjectSkillsPanel from '@/components/ProjectSkillsPanel.vue'
import { resolveNovelLengthLabel } from '@/features/wizard/projectGenres'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const projectMeta = computed(() =>
  [
    appStore.currentProject?.title?.trim(),
    appStore.currentProject?.genre?.trim(),
    resolveNovelLengthLabel(appStore.currentProject?.novelLength),
    appStore.currentProject?.targetPlatform?.trim()
  ]
    .filter(Boolean)
    .join(' · ')
)

function backToProjectCenter(): void {
  appStore.backToProjects()
}
</script>

<template>
  <section class="skills-page">
    <header class="skills-header arc-drag-region">
<!--      <div class="skills-header-copy">
        <span class="skills-header-kicker">
          <Wrench :size="14" />
          Skills
        </span>
        <strong>内置能力与项目扩展</strong>
        <p>集中查看软件内置 skills，并为当前项目导入、启用和分配适用阶段。</p>
        <span v-if="projectMeta" class="skills-header-meta">{{ projectMeta }}</span>
      </div>-->

      <div class="skills-header-actions arc-no-drag">
        <n-button quaternary @click="backToProjectCenter">
          <template #icon><ChevronLeft :size="16" /></template>
          返回项目中心
        </n-button>
      </div>
    </header>

    <main class="skills-main">
      <div class="skills-body arc-scrollbar">
        <ProjectSkillsPanel />
      </div>
    </main>
  </section>
</template>

<style scoped>
.skills-page {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, #f97316 12%, transparent) 0%, transparent 32%),
    linear-gradient(180deg, color-mix(in srgb, var(--arc-bg-body) 92%, #f97316 8%) 0%, var(--arc-bg-body) 100%);
}

.skills-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding:
    calc(var(--arc-titlebar-height) + 18px)
    max(20px, calc(var(--arc-window-controls-width) + 18px))
    14px
    20px;
}

.skills-header-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.skills-header-kicker {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #f97316 12%, transparent);
  color: #f97316;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 6px 10px;
  text-transform: uppercase;
}

.skills-header-copy strong {
  color: var(--arc-text-primary);
  font-size: clamp(28px, 3vw, 34px);
  font-weight: 760;
  letter-spacing: -0.05em;
}

.skills-header-copy p {
  max-width: 46rem;
  margin: 0;
  color: var(--arc-text-secondary);
  font-size: 13px;
  line-height: 1.75;
}

.skills-header-meta {
  color: var(--arc-text-hint);
  font-size: 12px;
}

.skills-header-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.skills-main {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.skills-body {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 0 clamp(16px, 2vw, 24px) clamp(16px, 2vw, 24px);
}

@media (max-width: 860px) {
  .skills-header {
    flex-direction: column;
    padding:
      calc(var(--arc-titlebar-height) + 16px)
      max(14px, calc(var(--arc-window-controls-width) + 14px))
      12px
      14px;
  }

  .skills-header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
