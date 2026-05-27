<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Cpu, Download, Image, MonitorCog, Moon, Palette, PlugZap, RefreshCw, Save } from 'lucide-vue-next'
import { NButton, NFormItem, NInput, NModal, NSelect, NSwitch, useMessage } from 'naive-ui'
import { autoSaveOptions } from '@/features/settings/autoSave'
import { getProviderPreset, providerOptions, resolveProviderDefaults } from '@/features/settings/providerPresets'
import { imageProviderOptions, resolveImageProviderDefaults } from '@/features/settings/imageProviderPresets'
import { useAppStore } from '@/stores/app'
import { darkModePresets, themePresets } from '@/theme/presets'
import { toIpcPayload } from '@/utils/ipcPayload'
import type { AppSettings, DarkModeStyle, ThemeName } from '@/types/app'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const appStore = useAppStore()
const message = useMessage()
const isTestingAiConnection = ref(false)
const isFetchingModels = ref(false)
const fetchedModels = ref<Array<{ id: string; ownedBy: string | null }>>([])
const isFetchingImageModels = ref(false)
const fetchedImageModels = ref<Array<{ id: string; ownedBy: string | null }>>([])

const autoSaveSelectOptions = [...autoSaveOptions]
const uiScaleOptions = [
  { label: '75%', value: 0.75 },
  { label: '85%', value: 0.85 },
  { label: '100%', value: 1 },
  { label: '110%', value: 1.1 },
  { label: '125%', value: 1.25 },
  { label: '140%', value: 1.4 }
]

const draftSettings = reactive<AppSettings>({
  provider: '',
  model: '',
  apiKey: '',
  baseUrl: '',
  imageProvider: '',
  imageModel: '',
  imageApiKey: '',
  imageBaseUrl: '',
  autoSaveInterval: '5m',
  uiScale: 1,
  darkMode: false,
  darkModeStyle: 'nord'
})
const draftTheme = ref<ThemeName>('ocean')

const scrollContainer = ref<HTMLElement | null>(null)
const activeNav = ref('sec-ai')
const navItems = [
  { id: 'sec-ai', label: 'AI 接口配置', icon: Cpu },
  { id: 'sec-image', label: '图片生成配置', icon: Image },
  { id: 'sec-theme', label: '界面主题', icon: Palette },
  { id: 'sec-prefs', label: '应用偏好', icon: MonitorCog }
]

function scrollToSection(id: string): void {
  activeNav.value = id
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleScroll(): void {
  const container = scrollContainer.value
  if (!container) return
  const sections = container.querySelectorAll<HTMLElement>('.settings-section')
  for (const section of sections) {
    const rect = section.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (rect.top - containerRect.top < 80) {
      activeNav.value = section.id
    }
  }
}

const activeProviderPreset = computed(() => getProviderPreset(draftSettings.provider))
const currentVersion = window.characterArc.version
const modelSelectOptions = computed(() =>
  fetchedModels.value.map((m) => ({ label: m.id, value: m.id }))
)
const imageModelSelectOptions = computed(() =>
  fetchedImageModels.value.map((m) => ({ label: m.id, value: m.id }))
)
const hasPendingChanges = computed(() =>
  draftTheme.value !== appStore.theme
  || draftSettings.provider !== appStore.appSettings.provider
  || draftSettings.model !== appStore.appSettings.model
  || draftSettings.apiKey !== appStore.appSettings.apiKey
  || draftSettings.baseUrl !== appStore.appSettings.baseUrl
  || draftSettings.imageProvider !== appStore.appSettings.imageProvider
  || draftSettings.imageModel !== appStore.appSettings.imageModel
  || draftSettings.imageApiKey !== appStore.appSettings.imageApiKey
  || draftSettings.imageBaseUrl !== appStore.appSettings.imageBaseUrl
  || draftSettings.autoSaveInterval !== appStore.appSettings.autoSaveInterval
  || draftSettings.uiScale !== appStore.appSettings.uiScale
  || draftSettings.darkMode !== appStore.appSettings.darkMode
  || draftSettings.darkModeStyle !== appStore.appSettings.darkModeStyle
)

function syncDraftFromStore(): void {
  draftSettings.provider = appStore.appSettings.provider
  draftSettings.model = appStore.appSettings.model
  draftSettings.apiKey = appStore.appSettings.apiKey
  draftSettings.baseUrl = appStore.appSettings.baseUrl
  draftSettings.imageProvider = appStore.appSettings.imageProvider
  draftSettings.imageModel = appStore.appSettings.imageModel
  draftSettings.imageApiKey = appStore.appSettings.imageApiKey
  draftSettings.imageBaseUrl = appStore.appSettings.imageBaseUrl
  draftSettings.autoSaveInterval = appStore.appSettings.autoSaveInterval
  draftSettings.uiScale = appStore.appSettings.uiScale
  draftSettings.darkMode = appStore.appSettings.darkMode
  draftSettings.darkModeStyle = appStore.appSettings.darkModeStyle
  draftTheme.value = appStore.theme
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      syncDraftFromStore()
    }
  },
  { immediate: true }
)

function closeModal(): void {
  syncDraftFromStore()
  emit('update:show', false)
}

function handleProviderChange(provider: string): void {
  const defaults = resolveProviderDefaults(provider)
  draftSettings.provider = provider
  draftSettings.model = defaults.model
  draftSettings.baseUrl = defaults.baseUrl
  fetchedModels.value = []
}

function handleImageProviderChange(value: string): void {
  draftSettings.imageProvider = value
  const defaults = resolveImageProviderDefaults(value)
  draftSettings.imageModel = defaults.model
  draftSettings.imageBaseUrl = defaults.baseUrl
  fetchedImageModels.value = []
}

async function handleFetchImageModels(): Promise<void> {
  if (isFetchingImageModels.value) return
  isFetchingImageModels.value = true
  try {
    const result = await window.characterArc.fetchImageModels(toIpcPayload({ ...draftSettings }))
    if (!result.success) throw new Error(result.error ?? '获取图片模型列表失败')
    fetchedImageModels.value = result.result ?? []
    if (fetchedImageModels.value.length === 0) {
      message.warning('该接口未返回任何可用图片模型，请手动输入模型名称。')
    } else {
      message.success(`获取到 ${fetchedImageModels.value.length} 个可用模型`)
    }
  } catch (error) {
    fetchedImageModels.value = []
    message.error(error instanceof Error ? error.message : '获取图片模型列表失败')
  } finally {
    isFetchingImageModels.value = false
  }
}

async function handleFetchModels(): Promise<void> {
  if (isFetchingModels.value) return
  isFetchingModels.value = true
  try {
    const result = await window.characterArc.fetchModels(toIpcPayload({ ...draftSettings }))
    if (!result.success) throw new Error(result.error ?? '获取模型列表失败')
    fetchedModels.value = result.result ?? []
    if (fetchedModels.value.length === 0) {
      message.warning('该供应商未返回任何可用模型，请手动输入模型名称。')
    } else {
      message.success(`获取到 ${fetchedModels.value.length} 个可用模型`)
    }
  } catch (error) {
    fetchedModels.value = []
    message.error(error instanceof Error ? error.message : '获取模型列表失败')
  } finally {
    isFetchingModels.value = false
  }
}

async function handleTestAiConnection(): Promise<void> {
  if (isTestingAiConnection.value) return
  isTestingAiConnection.value = true
  try {
    const result = await window.characterArc.testAiConnection(toIpcPayload({ ...draftSettings }))
    if (!result.success) throw new Error(result.error ?? '模型连接测试失败')
    const payload = result.result as { provider?: string; model?: string } | undefined
    message.success(`模型连接成功：${payload?.provider ?? draftSettings.provider} / ${payload?.model ?? draftSettings.model}`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模型连接测试失败')
  } finally {
    isTestingAiConnection.value = false
  }
}

async function saveSettings(): Promise<void> {
  appStore.updateAppSetting('provider', draftSettings.provider)
  appStore.updateAppSetting('model', draftSettings.model)
  appStore.updateAppSetting('apiKey', draftSettings.apiKey)
  appStore.updateAppSetting('baseUrl', draftSettings.baseUrl)
  appStore.updateAppSetting('imageProvider', draftSettings.imageProvider)
  appStore.updateAppSetting('imageModel', draftSettings.imageModel)
  appStore.updateAppSetting('imageApiKey', draftSettings.imageApiKey)
  appStore.updateAppSetting('imageBaseUrl', draftSettings.imageBaseUrl)
  appStore.updateAppSetting('autoSaveInterval', draftSettings.autoSaveInterval)
  appStore.updateAppSetting('uiScale', draftSettings.uiScale)
  appStore.updateAppSetting('darkMode', draftSettings.darkMode)
  appStore.updateAppSetting('darkModeStyle', draftSettings.darkModeStyle)

  if (draftTheme.value !== appStore.theme) {
    appStore.setTheme(draftTheme.value)
  }

  await appStore.persistWorkspace()
  if (appStore.persistenceError) {
    message.error(appStore.persistenceError)
    return
  }

  message.success('设置已保存')
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="arc-settings-modal"
    title="设置"
    :bordered="false"
    @close="closeModal"
  >
    <div class="settings-layout">
      <nav class="settings-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: activeNav === item.id }"
          @click="scrollToSection(item.id)"
        >
          <component :is="item.icon" :size="18" />
          {{ item.label }}
        </button>
        <div class="nav-version">v{{ currentVersion }}</div>
      </nav>

      <div ref="scrollContainer" class="settings-main arc-scrollbar" @scroll="handleScroll">
        <section id="sec-ai" class="settings-section">
          <div class="section-title">
            <Cpu :size="18" />
            <div>
              <strong>AI 接口配置</strong>
              <p>选择协议类型，填写接口地址和密钥，然后拉取或手动输入模型名称。</p>
            </div>
          </div>
          <div class="settings-grid">
            <n-form-item label="协议类型">
              <n-select
                :options="providerOptions"
                :value="draftSettings.provider"
                @update:value="(value) => handleProviderChange(value ?? 'openai-compatible')"
              />
            </n-form-item>
            <n-form-item label="Base URL">
              <n-input
                :value="draftSettings.baseUrl"
                :placeholder="draftSettings.provider === 'anthropic' ? '例如：https://api.anthropic.com（自动补 /v1）' : '例如：https://api.deepseek.com/v1'"
                @update:value="(value) => { draftSettings.baseUrl = value }"
              />
            </n-form-item>
          </div>
          <div class="settings-grid">
            <n-form-item label="API Key">
              <n-input
                type="password"
                show-password-on="click"
                :value="draftSettings.apiKey"
                placeholder="填写接口对应的 API Key / Token"
                @update:value="(value) => { draftSettings.apiKey = value }"
              />
            </n-form-item>
            <n-form-item label="模型名称">
              <div class="model-input-row">
                <n-select
                  v-if="fetchedModels.length > 0"
                  :options="modelSelectOptions"
                  :value="draftSettings.model"
                  filterable
                  tag
                  placeholder="选择或输入模型名称"
                  @update:value="(value: string) => { draftSettings.model = value }"
                />
                <n-input
                  v-else
                  :value="draftSettings.model"
                  placeholder="填写 URL 和 Key 后可点右侧按钮拉取"
                  @update:value="(value) => { draftSettings.model = value }"
                />
                <n-button
                  quaternary
                  class="model-fetch-btn"
                  :disabled="isFetchingModels || !draftSettings.baseUrl.trim()"
                  @click="handleFetchModels"
                >
                  <template #icon>
                    <RefreshCw v-if="fetchedModels.length > 0" :size="16" :class="{ 'spin-icon': isFetchingModels }" />
                    <Download v-else :size="16" :class="{ 'spin-icon': isFetchingModels }" />
                  </template>
                </n-button>
              </div>
            </n-form-item>
          </div>
          <div class="provider-hint-block">
            <p>{{ activeProviderPreset.hint }}</p>
          </div>
          <div class="section-actions">
            <n-button round strong secondary :disabled="isTestingAiConnection" @click="handleTestAiConnection">
              <template #icon>
                <PlugZap :size="16" />
              </template>
              {{ isTestingAiConnection ? '测试中...' : '测试模型连接' }}
            </n-button>
          </div>
        </section>

        <section id="sec-image" class="settings-section">
          <div class="section-title">
            <Image :size="18" />
            <div>
              <strong>图片生成配置</strong>
              <p>封面工作台使用专用的图片生成接口，需单独配置。</p>
            </div>
          </div>
          <div class="settings-grid">
            <n-form-item label="图片服务预设">
              <div class="preset-field">
                <n-select
                  :options="imageProviderOptions"
                  :value="draftSettings.imageProvider"
                  placeholder="选择预设快速填充模型和地址"
                  clearable
                  @update:value="(value) => handleImageProviderChange(value ?? '')"
                />
                <span class="preset-hint">切换预设仅更新模型名和 Base URL，API Key 不会被覆盖。</span>
              </div>
            </n-form-item>
            <n-form-item label="图片模型名称">
              <div class="model-input-row">
                <n-select
                  v-if="fetchedImageModels.length > 0"
                  :options="imageModelSelectOptions"
                  :value="draftSettings.imageModel"
                  filterable
                  tag
                  placeholder="选择或输入图片模型名称"
                  @update:value="(value: string) => { draftSettings.imageModel = value }"
                />
                <n-input
                  v-else
                  :value="draftSettings.imageModel"
                  placeholder="例如：gpt-image-1 / flux.1-dev"
                  @update:value="(value) => { draftSettings.imageModel = value }"
                />
                <n-button
                  quaternary
                  class="model-fetch-btn"
                  :disabled="isFetchingImageModels || !draftSettings.imageBaseUrl.trim()"
                  @click="handleFetchImageModels"
                >
                  <template #icon>
                    <RefreshCw v-if="fetchedImageModels.length > 0" :size="16" :class="{ 'spin-icon': isFetchingImageModels }" />
                    <Download v-else :size="16" :class="{ 'spin-icon': isFetchingImageModels }" />
                  </template>
                </n-button>
              </div>
            </n-form-item>
          </div>
          <div class="settings-grid">
            <n-form-item label="图片 Base URL">
              <n-input
                :value="draftSettings.imageBaseUrl"
                placeholder="例如：https://api.openai.com/v1"
                @update:value="(value) => { draftSettings.imageBaseUrl = value }"
              />
            </n-form-item>
            <n-form-item label="图片 API Key">
              <n-input
                type="password"
                show-password-on="click"
                :value="draftSettings.imageApiKey"
                placeholder="图片接口专用 API Key"
                @update:value="(value) => { draftSettings.imageApiKey = value }"
              />
            </n-form-item>
          </div>
        </section>

        <section id="sec-theme" class="settings-section">
          <div class="section-title">
            <Palette :size="18" />
            <div>
              <strong>界面主题</strong>
              <p>统一首页与工作台的主色体验。</p>
            </div>
          </div>
          <div class="theme-swatches">
            <button
              v-for="preset in themePresets"
              :key="preset.name"
              class="theme-dot"
              :class="{ active: draftTheme === preset.name }"
              :style="{ background: preset.primary }"
              @click="draftTheme = preset.name"
            >
              <span>{{ preset.label }}</span>
            </button>
          </div>
        </section>

        <section id="sec-prefs" class="settings-section">
          <div class="section-title">
            <MonitorCog :size="18" />
            <div>
              <strong>应用偏好</strong>
              <p>保存节奏与显示比例。</p>
            </div>
          </div>
          <div class="settings-grid">
            <n-form-item label="自动保存时间间隔">
              <n-select
                :options="autoSaveSelectOptions"
                :value="draftSettings.autoSaveInterval"
                @update:value="(value) => { draftSettings.autoSaveInterval = value ?? '5m' }"
              />
            </n-form-item>
            <n-form-item label="界面缩放比例">
              <n-select
                :options="uiScaleOptions"
                :value="draftSettings.uiScale"
                @update:value="(value) => { draftSettings.uiScale = value ?? 1 }"
              />
            </n-form-item>
          </div>
          <div class="dark-mode-row">
            <div class="dark-mode-label">
              <Moon :size="15" />
              <div>
                <span class="dark-mode-text">深色模式</span>
                <span class="dark-mode-hint">适合夜间长时间写作</span>
              </div>
            </div>
            <n-switch
              :value="draftSettings.darkMode"
              @update:value="(value) => { draftSettings.darkMode = value }"
            />
          </div>
          <div v-if="draftSettings.darkMode" class="dark-style-grid">
            <button
              v-for="preset in darkModePresets"
              :key="preset.name"
              type="button"
              class="dark-style-card"
              :class="{ active: draftSettings.darkModeStyle === preset.name }"
              @click="draftSettings.darkModeStyle = preset.name as DarkModeStyle"
            >
              <div
                class="dark-style-swatch"
                :style="{
                  background: preset.bgBody,
                  borderColor: preset.border,
                  color: preset.textPrimary
                }"
              >
                <span
                  class="dark-style-swatch-surface"
                  :style="{ background: preset.bgSurface, borderColor: preset.border }"
                ></span>
                <span
                  class="dark-style-swatch-text"
                  :style="{ color: preset.textPrimary }"
                >Aa</span>
              </div>
              <div class="dark-style-meta">
                <strong>{{ preset.label }}</strong>
                <p>{{ preset.description }}</p>
              </div>
            </button>
          </div>
<!--          <div class="storage-note">-->
<!--            <Save :size="16" />-->
<!--            <span>{{ appStore.persistenceError || '当前工作区内容已接入本地 SQLite 持久化。' }}</span>-->
<!--          </div>-->
        </section>
      </div>
    </div>

    <template #footer>
      <div class="settings-footer-actions">
        <n-button round strong @click="closeModal">取消</n-button>
        <n-button type="primary" round strong :disabled="!hasPendingChanges" @click="saveSettings">保存设置</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 192px minmax(0, 1fr);
  gap: 0;
  min-height: 0;
}

/* ── Left Nav ── */
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 12px;
  border-right: 1px solid var(--arc-border);
  background: var(--arc-bg-weak);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--arc-text-secondary);
  font-size: 13.5px;
  font-weight: 550;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s;
}

.nav-item:hover {
  background: var(--arc-bg-surface-hover);
  color: var(--arc-text-primary);
}

.nav-item.active {
  background: color-mix(in srgb, var(--arc-primary) 8%, var(--arc-bg-surface));
  color: var(--arc-primary);
}

.nav-item :deep(svg) {
  opacity: 0.7;
  flex-shrink: 0;
}

.nav-item.active :deep(svg) {
  opacity: 1;
}

.nav-version {
  margin-top: auto;
  padding: 12px 12px 4px;
  color: var(--arc-text-hint);
  font-size: 11px;
  font-weight: 500;
}

/* ── Right Content ── */
.settings-main {
  max-height: min(76vh, 720px);
  overflow-y: auto;
  padding: 24px 28px;
  scroll-behavior: smooth;
}

.settings-section {
  padding-bottom: 28px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--arc-bg-surface-hover);
}

.settings-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 8px;
}

.section-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.section-title :deep(svg) {
  margin-top: 2px;
  color: var(--arc-primary);
}

.section-title strong {
  display: block;
  color: var(--arc-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.section-title p {
  margin: 4px 0 0;
  color: var(--arc-text-hint);
  font-size: 12.5px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.provider-hint-block {
  margin: -2px 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--arc-bg-weak);
  color: var(--arc-text-hint);
  font-size: 12px;
  line-height: 1.7;
}

.provider-hint-block p {
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.model-input-row {
  display: flex;
  gap: 6px;
  width: 100%;
}

.model-input-row .n-select,
.model-input-row .n-input {
  flex: 1;
}

.model-fetch-btn {
  flex-shrink: 0;
}

.preset-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.preset-hint {
  color: var(--arc-text-hint);
  font-size: 12px;
  line-height: 1.5;
}

.spin-icon {
  animation: arc-spin 1s linear infinite;
}

@keyframes arc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.theme-swatches {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.theme-dot {
  display: flex;
  min-height: 64px;
  align-items: flex-end;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 650;
  padding: 10px;
  transition:
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.18s,
    border-color 0.18s;
}

.theme-dot:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.theme-dot:active {
  transform: scale(0.97);
}

.theme-dot.active {
  border-color: white;
  box-shadow: 0 0 0 2px var(--arc-bg-surface), 0 0 0 4px color-mix(in srgb, var(--arc-primary) 34%, transparent);
}

.dark-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  border: 1px solid var(--arc-border);
  border-radius: 10px;
  padding: 12px 16px;
}

.dark-mode-label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dark-mode-label :deep(svg) {
  color: var(--arc-primary);
  flex-shrink: 0;
}

.dark-mode-text {
  font-size: 13.5px;
  font-weight: 620;
  color: var(--arc-text-primary);
}

.dark-mode-hint {
  display: block;
  color: var(--arc-text-hint);
  font-size: 12px;
  font-weight: 400;
}

.dark-style-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.dark-style-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--arc-border);
  border-radius: 12px;
  background: var(--arc-bg-surface);
  color: var(--arc-text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.dark-style-card:hover {
  border-color: color-mix(in srgb, var(--arc-primary) 36%, var(--arc-border));
  transform: translateY(-1px);
}

.dark-style-card.active {
  border-color: var(--arc-primary);
  background: color-mix(in srgb, var(--arc-primary) 6%, var(--arc-bg-surface));
}

.dark-style-swatch {
  position: relative;
  height: 58px;
  border: 1px solid var(--arc-border);
  border-radius: 8px;
  overflow: hidden;
}

.dark-style-swatch-surface {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 40%;
  height: 58%;
  border: 1px solid var(--arc-border);
  border-radius: 6px;
}

.dark-style-swatch-text {
  position: absolute;
  left: 10px;
  top: 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.dark-style-meta strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--arc-text-primary);
}

.dark-style-meta p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--arc-text-secondary);
}

.storage-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin-top: 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--arc-primary) 5%, var(--arc-bg-weak));
  color: var(--arc-text-secondary);
  font-size: 12px;
  padding: 0 12px;
}

.storage-note :deep(svg) {
  color: var(--arc-primary);
}

.settings-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 960px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    display: none;
  }
}

@media (max-width: 720px) {
  .settings-grid,
  .theme-swatches {
    grid-template-columns: 1fr;
  }

  .dark-style-grid {
    grid-template-columns: 1fr;
  }

  .settings-footer-actions {
    width: 100%;
  }

  .settings-footer-actions :deep(.n-button) {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-dot {
    transition: none;
  }
}
</style>
