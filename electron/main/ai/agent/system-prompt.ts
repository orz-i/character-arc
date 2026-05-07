import type { SkillDefinition } from '../skills/types'

/**
 * 把候选 skills 编排成"渐进式披露"的 skill index 写进 system prompt。
 * 模型只看到 id + 简短描述；要看主体得调 skill_load 工具——这是 Claude Code 的 skill 协议。
 */
export function buildSkillIndex(skills: SkillDefinition[]): string {
  if (!skills.length) return ''

  const entries = skills.map((skill) => {
    const desc = (skill.description || '').replace(/\s+/g, ' ').trim().slice(0, 240)
    return `- ${skill.id}：${desc}`
  })

  return [
    '',
    '## 可用 SKILLS（按需加载，不要一次性全部加载）',
    '',
    '当前任务可访问的 skill 索引如下。每个 skill 仅展示了名称和摘要，',
    '如果你判断某个 skill 与当前任务相关，请用 `skill_load` 工具读取它的完整 SKILL.md，',
    '再按需用 `skill_read_reference` / `skill_glob` / `skill_run_script` 读取它的子文件或运行脚本。',
    '不相关的 skill 不要加载，避免浪费上下文。',
    '',
    ...entries
  ].join('\n')
}

/**
 * 在 system prompt 末尾追加 agent 行为规则——告诉模型：
 * 1) 在调用工具前先思考是否真的需要；
 * 2) 工具失败时要看 error 信息再决定下一步；
 * 3) 最终输出必须满足任务的原始格式约束（JSON / 正文等）。
 */
export function buildAgentBehaviorRules(): string {
  return [
    '',
    '## Agent 行为约束',
    '',
    '- 工具调用是可选的：如果你已经能根据上下文给出高质量结果，直接输出最终答案，不要为了调用而调用。',
    '- 工具失败（tool_result 带 error）时，先读 error 文本判断是参数错误还是环境问题，再决定是否重试或换路线。',
    '- 不要连续重复调用同一个工具+同一组参数；如果同一个 tool 已经返回过结果，直接用之前的结果。',
    '- 最终回复的格式必须严格满足任务的原始要求（如要求返回 JSON 就只输出 JSON，不要包裹 markdown fence）。'
  ].join('\n')
}
