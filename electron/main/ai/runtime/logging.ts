import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings, PromptPair } from '../shared-types'

const AI_PROMPT_LOG_DIR = join(process.cwd(), '.logs')
const AI_PROMPT_LOG_FILE = join(AI_PROMPT_LOG_DIR, 'ai-prompts.log')

async function writePromptLogFile(content: string): Promise<void> {
  try {
    await mkdir(AI_PROMPT_LOG_DIR, { recursive: true })
    await appendFile(AI_PROMPT_LOG_FILE, `${content}\n`, 'utf8')
  } catch (error) {
    console.error('[ai] failed to write prompt log file:', error)
  }
}

export function logPrompt(
  label: string,
  settings: AppSettings,
  prompt: PromptPair,
  taskName: string,
  usedSkills?: string[]
): void {
  const provider = settings.provider || 'unknown'
  const model = settings.model || 'unknown'
  const timestamp = new Date().toISOString()
  const skillLine = usedSkills?.length ? `技能: ${usedSkills.join(', ')}` : ''
  const content = [
    '',
    `===== AI 提示词 ${label} =====`,
    `时间: ${timestamp}`,
    `任务: ${taskName}`,
    `提供者: ${provider}`,
    `模型: ${model}`,
    skillLine,
    '--- SYSTEM ---',
    prompt.system || '',
    '--- USER ---',
    prompt.user || '',
    `===== END AI 提示词 ${label} =====`
  ].filter(Boolean).join('\n')

  console.log(`[ai] prompt logged: ${label} | task=${taskName} | provider=${provider} | model=${model}`)
  void writePromptLogFile(content)
}
