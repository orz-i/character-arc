import type { PromptPair } from '../shared-types'

export function buildRepairPrompt(originalSystem: string, originalUser: string, brokenText: string): PromptPair {
  return {
    system: '你是 JSON 输出修复助手。你只负责把已有回复整理成合法 JSON，不能输出 Markdown、解释或额外文本。',
    user: `请根据原始任务要求，把下面这段回复修正为严格合法的 JSON。\n\n原始系统要求：\n${originalSystem}\n\n原始用户要求：\n${originalUser}\n\n模型原始回复：\n${brokenText}\n\n要求：\n1. 只返回一个合法 JSON 对象\n2. 不要补充与任务无关的解释\n3. 缺失字段时，根据原始任务要求补齐最合理的内容`
  }
}
