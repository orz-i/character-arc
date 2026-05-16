<script setup lang="ts">
import { ref } from 'vue'
import { ArrowUp, Square } from 'lucide-vue-next'

const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  send: [value: string]
  stop: []
}>()

const text = ref('')

type AiMode = '问答' | '改写' | '续写'
const modes: AiMode[] = ['问答', '改写', '续写']
const activeMode = ref<AiMode>('问答')

const placeholders: Record<AiMode, string> = {
  '问答': '向 AI 提问，或描述你想要的修改 (Enter 发送)',
  '改写': '描述你想如何改写选中的段落...',
  '续写': '给出续写方向，或留空让 AI 自由发挥...'
}

function handleSend(): void {
  const value = text.value.trim()
  if (!value || props.disabled) return
  const prefix = activeMode.value !== '问答' ? `[${activeMode.value}] ` : ''
  emit('send', prefix + value)
  text.value = ''
}

function handleKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="ai-input">
    <div class="wrap" :class="{ disabled }">
      <textarea
        v-model="text"
        :placeholder="disabled ? 'AI 正在生成...' : placeholders[activeMode]"
        :disabled="disabled"
        @keydown="handleKey"
      />
      <div class="input-toolbar">
        <div class="mode-toggle">
          <button
            v-for="mode in modes"
            :key="mode"
            class="mode-opt"
            :class="{ active: activeMode === mode }"
            @click="activeMode = mode"
          >
            {{ mode }}
          </button>
        </div>
        <button v-if="disabled" class="send stop" @click="$emit('stop')">
          <Square :size="12" />
        </button>
        <button v-else class="send" :disabled="!text.trim()" @click="handleSend">
          <ArrowUp :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-input {
  padding: 12px;
  border-top: 1px solid var(--arc-border);
  background: var(--arc-bg-surface);
}

.wrap {
  position: relative;
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-md);
  background: var(--arc-bg-weak);
  transition: 0.15s;
}

.wrap:focus-within {
  border-color: var(--arc-primary);
  background: var(--arc-bg-surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--arc-primary) 12%, transparent);
}

.wrap.disabled {
  opacity: 0.6;
}

.wrap textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 10px 12px 36px;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  font-family: inherit;
  color: var(--arc-text-primary);
  user-select: text;
  min-height: 72px;
  max-height: 160px;
}

.input-toolbar {
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-toggle {
  display: inline-flex;
  background: var(--arc-bg-surface-hover);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.mode-opt {
  padding: 3px 10px;
  font-size: 11px;
  color: var(--arc-text-secondary);
  cursor: pointer;
  border-radius: 4px;
  border: none;
  background: transparent;
  transition: 0.15s;
}

.mode-opt.active {
  background: var(--arc-bg-surface);
  color: var(--arc-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-weight: 500;
}

.send {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--arc-primary);
  color: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.send:hover:not(:disabled) {
  background: var(--arc-primary-hover);
}

.send:disabled {
  background: color-mix(in srgb, var(--arc-text-hint) 60%, transparent);
  cursor: not-allowed;
}

.send.stop {
  background: #ef4444;
  animation: pulse-stop 1.5s ease-in-out infinite;
}

.send.stop:hover {
  background: #dc2626;
}

@keyframes pulse-stop {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}
</style>
