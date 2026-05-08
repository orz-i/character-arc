# Skill 代理化 + 知识中心改造 — 进度与待办

> 更新日期：2026-05-08
> 关联：[agent-plan-status-2026-05-06.md](agent-plan-status-2026-05-06.md)、`C:\Users\Administrator\.claude\plans\hashed-kindling-snail.md`

---

## Context

把 `electron/main/ai/` 的 skill 机制从「整段 SKILL.md 当 prompt 片段塞进去」升级为 Claude Code 风格的**渐进式披露 + 工具循环**：模型先看 skill 索引（id+description），按需通过工具加载主体、读取 references、运行脚本。同时打通**拆书产出 → 知识中心 → 写作时检索**的完整链路。

**约束**：保留全部 provider（Anthropic / OpenAI / DeepSeek / Qwen / Moonshot / Zhipu / SiliconFlow / new-api / one-api / Ollama）；renderer 与 IPC 输出契约零变更。

---

## 已完成

### 基础工具与诊断

| 改动 | 文件 | 说明 |
|---|---|---|
| 日志升级 | [logging.ts](../electron/main/ai/runtime/logging.ts) + [orchestrator.ts](../electron/main/ai/runtime/orchestrator.ts) | 加 `logSelection`（命中 skill+知识）、`logResponse`（完整响应+耗时），混写 `.logs/ai-prompts.log` |
| 章节初稿超字 + 切断 | [chapter-first-draft.ts](../electron/main/ai/tasks/chapter-first-draft.ts) + [ChaptersPanel.vue](../renderer/src/components/ChaptersPanel.vue) | 去掉 renderer 的 scene segmentation；改单次流式调用；放宽 max_tokens（target×1.5/0.8，封顶 8000）；prompt 软约束；`AI_REQUEST_TIMEOUT_MS` 60s→180s |
| IPC 双层包裹 bug | [ai/ipc.ts](../electron/main/ai/ipc.ts) | `return { success, result }` → `return { success, result: result.result }`，修复全 renderer 的 `outline-batch` / `outline-chain` / `inspiration-pack` / `plot-thread-detect` / 单条大纲、单角色卡等返回 fallback 占位符的问题 |

### 知识中心检索漏洞修复

| 改动 | 文件 | 说明 |
|---|---|---|
| 检索 task 白名单扩容 | [knowledge-retrieval.ts](../electron/main/knowledge-retrieval.ts) | 从 3 个扩到 10 个：补 outline-batch / outline-chain / outline-item / inspiration-pack / chapter-analysis / chapter-scene-plan / project-bootstrap |
| 拆书内容完整传入 | 同上 | reference-summary 用 document.content（含 styleRules/avoidRules/reusableStylePrompt/plotOutline 全字段，cap 2400 字）；reference-chunk cap 1400 字；项目记忆 cap 320 字 |
| 检索 prompt 排版升级 | [prompts/shared.ts](../electron/main/ai/prompts/shared.ts) | 项目记忆 / 参考资料各 section 顶部加显式用法说明；`【参考资料 N】` 风格、明确"模仿不照搬"约束 |

### Agent 化 PR1-PR4

#### PR1 — 抽象层（transport tool-use）

- [agent/tools/types.ts](../electron/main/ai/agent/tools/types.ts) — provider 中立的 `ToolDefinition` / `AssistantContentBlock` / `AgentMessage` / `AgentResponse` / `AgentRequestParams` / `Tool` / `ToolHandler`
- [transport/anthropic.ts](../electron/main/ai/transport/anthropic.ts)、[openai-compat.ts](../electron/main/ai/transport/openai-compat.ts)、[index.ts](../electron/main/ai/transport/index.ts) — 加 `requestAnthropicWithTools` / `requestOpenAiCompatibleWithTools` / 路由器 `requestAiWithTools` + 探测 `providerSupportsTools`
- [transport/http.ts](../electron/main/ai/transport/http.ts) — `performAiRequest` 加 `externalSignal` 参数（`AbortSignal.any` 同时尊重取消和超时）

#### PR2 — Skill 工具集

- [agent/tools/script-runner.ts](../electron/main/ai/agent/tools/script-runner.ts) — 受控 spawn：仅 .js + `process.execPath`、env 白名单（默认仅 PATH+windows 必备）、SIGTERM→1s→SIGKILL 超时杀、stdout/stderr 各 64KB cap
- [agent/tools/skill-tools.ts](../electron/main/ai/agent/tools/skill-tools.ts) — `skill_load` / `skill_read_reference` / `skill_glob` / `skill_run_script`
- [agent/tools/registry.ts](../electron/main/ai/agent/tools/registry.ts) — `createToolRegistry` + `dispatchTool`（异常包成 `tool_result(isError=true)`，loop 不被炸）
- [skills/loader.ts](../electron/main/ai/skills/loader.ts) — 加 `loadSkillReferenceFile` / `resolveSkillRelativePath`，双重 path traversal 防护

#### PR3 — Agent loop 主体

- [agent/system-prompt.ts](../electron/main/ai/agent/system-prompt.ts) — `buildSkillIndex`（紧凑 id+200字描述）+ `buildAgentBehaviorRules`（不重复调用、最终输出按 task 原格式）
- [agent/loop.ts](../electron/main/ai/agent/loop.ts) — `runAgentLoop`：循环到 `stop_reason=end_turn` 或撞 `AGENT_MAX_TOOL_ITERATIONS=8`；`AgentIterationLimitError`
- [agent/index.ts](../electron/main/ai/agent/index.ts) — `runAgentTask`（与 `runAiTask` 同签名）：复用 pickSkillsFor + handler.buildPrompt + 知识检索 + JSON repair；元信息回写 `toolCalls` / `agentIterations`
- [shared-types.ts](../electron/main/ai/shared-types.ts) — `ToolCallTrace`、`AGENT_MAX_TOOL_ITERATIONS=8`、`AiRunMeta` 加 `toolCalls?` / `agentIterations?`
- [settings.ts](../electron/main/ai/settings.ts) — `AGENT_TASK_WHITELIST`（首批：`outline-batch`，PR4 加入 `reference-deep-analyze`）
- [orchestrator.ts](../electron/main/ai/runtime/orchestrator.ts) — `runAiTask` 头部分流：白名单 + 支持 tool 的 provider → `runAgentTask`，否则原路径

#### PR4 — 拆书闭环（DB 直写）

- [agent/tools/knowledge-tools.ts](../electron/main/ai/agent/tools/knowledge-tools.ts) — `knowledge_save_document`：通过 closure 收集草稿；自动写 `metadata.sourceTitle` 让重复拆书替换旧文档；单文档 12K + 单 loop 30 份硬上限
- [tasks/reference-deep-analyze.ts](../electron/main/ai/tasks/reference-deep-analyze.ts) — 拆书 task：明确指令"先 skill_load + 逐维度调 knowledge_save_document"，列出必须产出的 7 类维度（总纲/主角/主线/黄金三章/设定/配角/支线）
- [tasks/index.ts](../electron/main/ai/tasks/index.ts) + [prompts/capability.ts](../electron/main/ai/prompts/capability.ts) — 注册新 task + 能力默认值
- [shared-types.ts](../electron/main/ai/shared-types.ts) — `AiKnowledgeDocumentDraft` 类型 + `AiRunMeta.producedKnowledgeDocuments?`
- [agent/index.ts](../electron/main/ai/agent/index.ts) — 实例化 knowledge tool（带 closure 收集），loop 后挂进 meta
- [renderer/stores/app.ts](../renderer/src/stores/app.ts) — `handleAiRunEvent` 监听 `producedKnowledgeDocuments` → 转换 → `mergeKnowledgeDocuments`
- [KnowledgeCenterPanel.vue](../renderer/src/components/KnowledgeCenterPanel.vue) + [NovelWorkflowPanel.vue](../renderer/src/components/NovelWorkflowPanel.vue) — 两个面板都加 "AI 深度拆书" 按钮（DB 直写、自动刷新到知识中心）

---

## 未做 / 待办

### PR5（收尾打磨）

- [ ] **白名单扩容**：把 `AGENT_TASK_WHITELIST` 加入 `outline-chain` / `inspiration-pack` / `chapter-analysis` / `outline-item` / `project-bootstrap` 等
- [ ] **`heuristics.ts` 解锁外部工具型 skill**：`browser-cdp` / `story-cover` 当前 `compatibility='external-only'` 默认禁用；agent 有了 `skill_run_script` 后这两个 skill 应可正常工作（前提是相关 env 已配置）。需要按 `metadata.openclaw.requires.env` 动态判断
- [ ] **去掉旧路径的 1200 字截断**：[shared.ts:53](../electron/main/ai/prompts/shared.ts#L53) `formatMountedSkills` 仍把 skill 内容截到 1200 字（用于非 agent 路径）。可去掉或改为更高的 cap
- [ ] **流式 agent loop**：`chapter-first-draft` / `chapter-assistant` 走 streaming，目前不能用 agent 路径（PR3 只覆盖 non-stream）。要加流式 transport tool 调用 + middle-turn 不推 chunk + final-turn 流式

### 知识中心进阶

- [ ] **章节自动 summarize → chapter-summary 类型**：用户写完/编辑章节自动调 `chapter-summarize` 落库，下一章生成时自动检索到"前 N 章发生了什么"。**最高 ROI 之一，待做**
- [ ] **手动笔记入口**："+ 添加笔记" 按钮，让用户存私货（设定、伏笔台账、世界观补丁等）
- [ ] **设定卡 → canon-fact 自动同步**：保存世界观/角色/组织时镜像一份 `canon-fact`，让全局检索能拉到
- [ ] **plot-thread-detect 输出自动 upsert canon-fact**：识别的伏笔自动入知识库
- [ ] **jieba 中文分词**：[knowledge-retrieval.ts:30](../electron/main/knowledge-retrieval.ts#L30) 当前 `value.split(/[^\p{L}\p{N}_]+/u)` 把中文整段当一个 token；项目已依赖 `@node-rs/jieba` 但没用上。换上后 chunk-level 检索召回率上一个台阶
- [ ] **chunk 按 plotFunction 标签检索**：reference-style-chunk 任务结果含 `plotFunction`（开场/冲突/收束等），但当前只按文本相似度匹配。写"开场章"时应优先拉对标书的"开场分块"
- [ ] **Knowledge Center 一键去重 / 合并冲突**：UI 已能识别，缺动作按钮
- [ ] **写章节时手动 pin 知识**：让用户白名单/黑名单 哪些知识进 prompt

### Agent 化 进阶能力

- [ ] **取消按钮接 generate API**：当前非流式（含 agent loop）没法取消，IPC 没有 `ai-generate-cancel` 接口。流式可以；非流式生成中如果用户按"停止"，目前只能等
- [ ] **project-scope skill 的 `skill_run_script` 闸门**：当前 `agent/index.ts` 写死 builtin 才能跑脚本。要在 settings 加显式开关，让 project skill 也能跑（需用户授权）
- [ ] **长篇拆书分段**：当前 `reference-deep-analyze` 把原文截到 30K 字；超过的部分丢失。要支持范围选择（"拆第 1-20 章" / "拆主线相关分块"等），或做多 task 拆分
- [ ] **拆书结果重跑去重逻辑测试**：`metadata.sourceTitle` 写入了，理论上重跑会替换旧文档；要在真实数据上验证一次
- [ ] **agent 元信息 UI 展示**：`meta.toolCalls` / `agentIterations` 已落到 `aiRuns`，但前端没有面板看到。可以在 AI 运行历史面板加"工具调用轨迹"展示，便于调试

### 路径 A 备选（如果 DB 直写不够用）

- [ ] **文件沙箱 + ingest 工具**：`workspace_write_file` / `workspace_read_file` / `workspace_glob`，沙箱到 `userData/reference-analysis/{taskId}/`。用户可手动查看物理文件，或委托给外部 Claude Code 会话复用。当前 PR4 走的是 DB 直写，没建文件层；如果用户想要"skill 输出按原设计的目录结构落到磁盘"再补这条路径

---

## 已知 Bug / 风险

- **章节生成 modal 取消按钮**：renderer ChapterPanel 的 `streamOneScene` 还在用旧的 streamId 通道；agent loop 路径走 `runAiTask` 没有 streamId，"停止"按钮形同虚设。流式 agent loop 完成后才能解决
- **OpenAI 兼容 provider 对 tool_use 支持参差**：DeepSeek/Qwen 一般 OK，但极少数模型可能：
  - 完全忽略工具，直接出 JSON（等价于老路径，OK）
  - 死循环调工具（撞 8 轮上限抛错；可观察 `.logs` 调整 prompt）
- **renderer 旧 stream 残留代码**：`ChaptersPanel.vue` 里的 `streamOneScene` / `sceneResolveCallback` / `sceneRejectCallback` / `chapterDraftStreamId` 仍存在但已不被 `generateChapterFirstDraft` 调用（dead code）。事件监听靠 streamId match 自动屏蔽，安全但脏
- **拆书 task 模型可能"偷懒"**：prompt 已强制要求逐维度落库，但部分模型可能凭训练数据写一份大 summary 就交差。需要观察实际 `meta.toolCalls` 数量
- **知识检索分词烂**（详见上方未做项）：当前命中率主要靠"标题/sourceLabel/keywords 严格命中"，对自然语言 query 召回很差

---

## 验证清单

下次跑端到端时挨个验：

1. [ ] `npm run dev`，main 进程日志 + `.logs/ai-prompts.log` 都打开
2. [ ] **"AI 补卷"**（outline-batch，已切到 agent 路径）：能正常返回 entries，`AGENT_REQUEST` 日志里 SYSTEM 段末尾有"## 可用 SKILLS"，meta.toolCalls 可能为空（模型不一定调工具）也可能有 1-2 次 skill_load
3. [ ] **"AI 深度拆书"**（reference-deep-analyze）：在已有参考作品上点击；1-3 分钟后弹 toast "已完成《xxx》深度拆书"；KnowledgeCenter 列表立即多出 N 条 reference-summary / reference-chunk 文档
4. [ ] **检索回流**：触发 outline-batch / chapter-first-draft，`.logs` 里 SELECTION 段能看到检索到刚拆出来的新文档；用法说明部分进入 prompt
5. [ ] **章节初稿字数**：3000 字目标，输出落在 ~3000-4500 字（不再像之前 4905+ 还被切）
6. [ ] **多 provider fallback**：临时切到 ollama → outline-batch 走老单次路径，仍能返回 entries
7. [ ] **撞循环上限**：构造一个让模型反复调工具的退化场景，确认第 9 轮抛 `AgentIterationLimitError` 而非死循环
