# CharacterArc 小说助理 Agent 化进展与待办（2026-05-06）

- 版本：`v0.1`
- 日期：`2026-05-06`
- 对照基线：`C:\Users\Administrator\.claude\plans\cached-inventing-biscuit.md`
- 目标：梳理“小说助理升级为受控小说创作 Agent”这条计划当前**已经完成**、**部分完成**、**仍未完成**的内容，作为下一阶段继续开发的执行依据。

---

## 一、这份文档覆盖什么

这份文档不是重新写一份总规划，而是把当前代码与已批准方案做一次对照，明确：

1. 哪些能力已经落地
2. 哪些能力已经有基础但还没收口
3. 哪些计划项还没有开始
4. 下一步最值得继续推进的顺序

本次对照重点围绕以下方向：

- 受控 Agent Surface
- proposal → confirm → apply 回路
- workflow scratchpad / knowledge base 受控写入
- deterministic guard
- 主进程 structured task / prompt / retrieval 支撑
- 前端确认 UI 与状态接线

---

## 二、当前阶段的总体判断

当前代码已经**跨过了“普通聊天助理”阶段**，进入了“受控小说创作 Agent v1”的中段：

### 已经完成的核心跃迁

1. 助手已经不再只有纯文本回复，具备了**结构化动作提议**能力。
2. 已有明确的 **intent → proposal → confirm → apply** 基本回路。
3. 已支持对章节、摘要、大纲之外的 **workflow / knowledge** 受控写入。
4. 已加入 **deterministic guard**，不是完全信任模型输出。
5. 项目知识检索链路已经能为 `assistant-action-proposal` 提供上下文支撑。

### 当前还没完成的关键部分

1. 还没有把编排彻底拆成计划中的独立模块（如 `agentSession.ts`、`agentScratchpad.ts`）。
2. 还没有进入固定多步写作流（修订场景 / 规划下一章 / 生成草稿）。
3. scratchpad 与 knowledge 的“持续工作记忆编排”还没有真正形成闭环。
4. 缺少一轮完整的手工验收，尤其是 destructive proposal 与 workflow / knowledge 写入场景。

结论：**Phase 0 ~ Phase 2 的主体已基本落地，但 Phase 3 / Phase 4 仍明显未完成。**

---

## 三、已完成项

## 3.1 Proposal-first Agent Surface 已落地

已完成：

- 助手请求先经过意图判断，再决定走聊天还是动作提议。
- 已引入 `assistant-intent` 与 `assistant-action-proposal` 两个结构化任务。
- renderer 侧已能把结构化 proposal 映射为确定性的本地 command。

涉及文件：

- [renderer/src/features/assistant/useAssistantSession.ts](../renderer/src/features/assistant/useAssistantSession.ts)
- [electron/main/aiShared.ts](../electron/main/aiShared.ts)
- [electron/main/ai.ts](../electron/main/ai.ts)
- [electron/main/aiPrompts.ts](../electron/main/aiPrompts.ts)
- [electron/main/promptLibrary.ts](../electron/main/promptLibrary.ts)

当前意义：

- 助手已具备“先判断，再提议动作”的 Agent 入口，不再只是单一路径的聊天面板。

---

## 3.2 受控 proposal → confirm → apply 回路已落地

已完成：

- store 中已有当前 proposal、确认状态、执行阶段等状态。
- proposal 可被确认、拒绝、清除。
- proposal 执行前后有明确的状态切换。
- apply 逻辑仍然由 store 负责，保持 deterministic。

涉及文件：

- [renderer/src/stores/app.ts](../renderer/src/stores/app.ts)
- [renderer/src/features/assistant/agentTypes.ts](../renderer/src/features/assistant/agentTypes.ts)
- [renderer/src/components/assistant/ClaudeAssistantSurface.vue](../renderer/src/components/assistant/ClaudeAssistantSurface.vue)
- [renderer/src/components/assistant/AssistantProposalCard.vue](../renderer/src/components/assistant/AssistantProposalCard.vue)
- [electron/preload/index.ts](../electron/preload/index.ts)
- [renderer/src/env.d.ts](../renderer/src/env.d.ts)

当前意义：

- “模型提议、应用校验、用户确认、store 执行”的基本边界已经建立起来。

---

## 3.3 第一批写作动作已接通

已完成：

- `insert-into-chapter`
- `update-chapter-title`
- `update-chapter-summary`
- `create-outline-item`

其中重点是：

- 当前 command bus 不再只停留在正文插入。
- 标题、摘要、大纲这三类写作动作已进入 proposal / apply 体系。

涉及文件：

- [renderer/src/stores/app.ts](../renderer/src/stores/app.ts)
- [renderer/src/env.d.ts](../renderer/src/env.d.ts)
- [renderer/src/types/app.ts](../renderer/src/types/app.ts)

---

## 3.4 workflow / knowledge 的受控写入动作已落地

已完成新增动作：

- `append-workflow-document-entry`
- `update-workflow-document`
- `save-knowledge-document`

已完成内容：

- proposal 结果可映射到上述三类 command。
- store 已能执行 workflow 文档追加、workflow 文档覆盖、knowledge document 合并写入。
- proposal UI 已能展示 workflow / knowledge 的关键字段，便于用户确认。

涉及文件：

- [renderer/src/features/assistant/useAssistantSession.ts](../renderer/src/features/assistant/useAssistantSession.ts)
- [renderer/src/stores/app.ts](../renderer/src/stores/app.ts)
- [renderer/src/components/assistant/AssistantProposalCard.vue](../renderer/src/components/assistant/AssistantProposalCard.vue)
- [renderer/src/types/app.ts](../renderer/src/types/app.ts)
- [renderer/src/env.d.ts](../renderer/src/env.d.ts)

当前意义：

- 计划里提出的“workflow scratchpad + knowledge base 作为项目记忆层”的入口已经打开，不再只限于章节正文编辑。

---

## 3.5 deterministic guard 第一版已落地

已完成：

- 新增 `agentGuards.ts`，对 assistant command 做字段级和安全级校验。
- proposal 接入时会校验一次。
- 真正 apply 前会再校验一次。
- 可拦截 target 不匹配、空内容、非法 workflow key、非法 knowledge sourceType，以及危险提议配置。

已覆盖的重要规则：

- destructive proposal 不能绕过确认
- `replace-selection` 必须 destructive + requiresConfirmation
- 覆盖标题 / 摘要 / workflow 文档必须 destructive + requiresConfirmation
- 追加 workflow entry 不应标记 destructive，但仍必须确认
- 写入 knowledge document 必须要求确认

涉及文件：

- [renderer/src/features/assistant/agentGuards.ts](../renderer/src/features/assistant/agentGuards.ts)
- [renderer/src/stores/app.ts](../renderer/src/stores/app.ts)

当前意义：

- 这一步把系统从“模型建议 + UI 确认”进一步升级成“模型建议 + deterministic 守门 + UI 确认 + deterministic 执行”。

---

## 3.6 structured task / repair 支撑已接通到 Agent 路径

已完成：

- 主进程 `ai.ts` 已把 `assistant-intent` / `assistant-action-proposal` 纳入 structured result 体系。
- proposal 结果会经过 normalize / usable-check / repair 这条既有框架。
- `promptLibrary.ts` 已补齐这两个任务的 profile。

涉及文件：

- [electron/main/ai.ts](../electron/main/ai.ts)
- [electron/main/aiShared.ts](../electron/main/aiShared.ts)
- [electron/main/promptLibrary.ts](../electron/main/promptLibrary.ts)

当前意义：

- 这符合原计划“复用现有结构化任务底座，而不是再发明一套新 runtime”的方向。

---

## 3.7 项目知识检索已扩展到 Agent proposal 场景

已完成：

- `retrieveKnowledgeContext(...)` 已支持 `assistant-action-proposal`。
- 已扩展 `KnowledgeDocumentSourceType` 的项目内来源：
  - `workflow-document`
  - `canon-fact`
  - `chapter-summary`
- 检索排序上已优先项目内知识，再到参考资料类知识。
- prompt 中已区分项目知识与参考类来源。

涉及文件：

- [electron/main/index.ts](../electron/main/index.ts)
- [electron/main/aiShared.ts](../electron/main/aiShared.ts)
- [electron/main/aiPrompts.ts](../electron/main/aiPrompts.ts)
- [renderer/src/types/app.ts](../renderer/src/types/app.ts)

当前意义：

- Agent 在生成 proposal 时，已经能够参考项目记忆，而不是只靠当前聊天上下文。

---

## 3.8 proposal 确认 UI 已升级

已完成：

- proposal card 已不只是展示一句总结。
- 对 workflow proposal 可展示：动作类型、写入目标、目标文档、条目标题、目标分卷。
- 对 knowledge proposal 可展示：知识标题、来源类型、来源标记、关键词。
- 已显示 proposal 状态、确认/拒绝时间、danger 标识。

涉及文件：

- [renderer/src/components/assistant/AssistantProposalCard.vue](../renderer/src/components/assistant/AssistantProposalCard.vue)
- [renderer/src/components/assistant/ClaudeAssistantSurface.vue](../renderer/src/components/assistant/ClaudeAssistantSurface.vue)

当前意义：

- 用户现在更容易在确认前看懂 proposal 到底会写哪里、写什么。

---

## 四、部分完成项

这些项目已经有明显基础，但还没有完全达到计划中的理想状态。

## 4.1 Agent 状态与执行中心已存在，但仍集中在 `app.ts`

当前状态：

- 已有 proposal / confirmation / execution step 等核心状态。
- 但大量编排、执行、辅助转换逻辑仍堆叠在 [renderer/src/stores/app.ts](../renderer/src/stores/app.ts) 与 [renderer/src/features/assistant/useAssistantSession.ts](../renderer/src/features/assistant/useAssistantSession.ts)。

与计划差异：

- 计划中的 `agentSession.ts` 尚未落地。
- 计划中的 `agentTools.ts` 尚未落地。
- 状态虽然有了，但模块边界还不够清晰。

结论：**功能上可用，结构上仍偏集中。**

---

## 4.2 workflow / knowledge 已能写入，但 scratchpad 编排还未成型

当前状态：

- 已支持受控写入 workflow docs 与 knowledge docs。
- 但还没有专门的 scratchpad orchestration 模块。
- 还没有围绕 `task_plan` / `findings` / `progress` / `current_status` 做更明确的策略化写入流程。

与计划差异：

- `agentScratchpad.ts` 尚未实现。
- 还缺少“什么场景写哪个文档、如何自动记录 progress、如何把稳定内容沉淀到 KB”的清晰编排层。

结论：**写入口已具备，但项目记忆层的持续工作流还没有形成。**

---

## 4.3 destructive write 保护已具备第一层，但还不够深

当前状态：

- 已有 destructive / requiresConfirmation 的约束。
- 已有字段级 guard 和 target 校验。

仍欠缺：

- `replace-selection` 是否真的存在选区的更强校验
- stage-aware workflow 写入规则
- knowledge 文档去重 / 冲突检测
- 更强的上下文级业务规则（例如限制某些阶段只能追加、不能覆盖）

结论：**已从“无保护”进步到“有保护”，但还不是最终版安全策略。**

---

## 4.4 Knowledge Base 能力已纳入 v1，但仍是轻量版

当前状态：

- 已复用现有 `knowledgeDocuments`、检索链路和来源 taxonomy。
- 已支持通过 proposal 受控写入项目知识。

仍欠缺：

- 没有专门的 knowledge orchestration 模块
- 没有更明确的重复知识合并策略
- 没有更好的 canon / reference 展示与管理界面
- 没有专门的知识沉淀工作流入口

结论：**KB 已经不是空白，但目前仍是“可用底座”，不是成熟能力层。**

---

## 五、未完成项

以下内容仍然基本处于未完成状态，属于后续开发重点。

## 5.1 计划中的独立模块尚未补齐

未完成：

- `renderer/src/features/assistant/agentTools.ts`
- `renderer/src/features/assistant/agentSession.ts`
- `renderer/src/features/assistant/agentScratchpad.ts`
- 可选的 `renderer/src/features/assistant/agentKnowledge.ts`

现状说明：

- 当前 `renderer/src/features/assistant/` 下只有：
  - [renderer/src/features/assistant/agentTypes.ts](../renderer/src/features/assistant/agentTypes.ts)
  - [renderer/src/features/assistant/agentGuards.ts](../renderer/src/features/assistant/agentGuards.ts)
  - [renderer/src/features/assistant/useAssistantSession.ts](../renderer/src/features/assistant/useAssistantSession.ts)

---

## 5.2 固定多步写作流尚未开始

计划中明确应后续实现的 3 个固定流，目前都还没有真正落地：

1. 修订当前场景
2. 规划下一章
3. 生成章节草稿

当前缺口：

- 还没有 deterministic app-controlled pipeline
- 还没有“分析 → 提议 → 确认 → 回写 → 记录 progress”的固定工作流模板
- 当前仍以单次请求、单次 proposal 为主

---

## 5.3 workflow scratchpad 的自动记录与持续维护尚未完成

未完成：

- 将确认后的重要动作更系统地写入 `progress`
- 基于创作阶段维护 `task_plan`
- 在指定场景下更新 `current_status`
- 更系统地沉淀 `pending_hooks` / `resource_ledger`

当前缺口：

- 虽然能写，但还没有真正做到“Agent 工作记忆持续维护”。

---

## 5.4 更高层的业务规则与去重策略尚未完成

未完成：

- knowledge 写入去重策略
- knowledge 冲突检测
- workflow doc 更严格的范围控制
- proposal 审计摘要是否需要持久化
- 更细粒度的写入政策（如普通聊天禁止污染 scratchpad）

---

## 5.5 完整手工验收尚未完成

未完成的重点验证包括：

1. 普通聊天仍然稳定工作
2. freeform 请求触发 proposal 时不会直接写入
3. `insert-into-chapter` proposal 确认后能正确插入
4. `update-chapter-title` proposal 确认后能正确更新
5. `update-chapter-summary` proposal 确认后能正确更新
6. `create-outline-item` proposal 确认后能正确创建
7. `append-workflow-document-entry` / `update-workflow-document` 写入位置正确
8. `save-knowledge-document` 写入结果、来源类型、关键词是否正确
9. reject / cancel proposal 不产生副作用
10. destructive write 的快照 / 恢复链路是否稳定
11. assistant window 与主窗口之间的路由是否完全正常
12. 检索注入在 proposal 场景下是否准确且不过度重复

说明：

- 目前更接近“代码接通 + 构建通过”，还不是“完整场景验收已完成”。

---

## 六、和原计划阶段的对应关系

## 已基本完成

可视为已基本完成的计划块：

- Phase 0：把当前助理整理成 Agent Surface
- Phase 1：加 proposal → confirm → apply 回路
- Phase 2：接入结构化 Agent proposal task 与知识检索扩展（主体已完成）

## 部分完成

- Phase 2：deterministic schema validation / 规则约束已做，但还可继续加强
- Phase 3：workflow docs / knowledgeDocuments 作为项目记忆层，只完成了入口与部分执行能力

## 尚未开始或明显未完成

- Phase 3：独立 scratchpad / knowledge orchestration 层
- Phase 4：固定多步写作流

---

## 七、建议的下一步开发顺序

### Step 1：先补 `agentScratchpad` / 轻量编排层

建议优先做：

1. 新增 `agentScratchpad.ts`
2. 把以下行为从 `app.ts` 中抽出为更清晰的策略入口：
   - 追加 `progress`
   - 更新 `task_plan`
   - 更新 `current_status`
   - workflow 内容转 knowledge 提议

原因：

- 现在 workflow / knowledge 已能写，但缺少“何时写、写到哪、写完怎么串起来”的编排层。

### Step 2：做一轮真实场景手工验收

建议优先验证：

1. 更新章节摘要
2. 创建下一章大纲
3. 记录一条 progress
4. 沉淀一条 canon fact 到 knowledge
5. 替换选区并确认 destructive guard 生效

原因：

- 先把当前单步 proposal 流验证扎实，再继续扩功能更稳。

### Step 3：再补固定多步写作流

建议顺序：

1. 规划下一章
2. 修订当前场景
3. 生成章节草稿

原因：

- 这三条流最能体现“小说创作 Agent”的真实价值，但必须建立在单步 proposal 足够稳定的基础上。

### Step 4：最后再做更强的知识策略

例如：

- 去重
- 冲突检测
- 更好的 source 展示
- 更清晰的 scratch-only / canon 区分

---

## 八、当前阶段完成标准建议

若要认为“受控小说创作 Agent v1 的基础层”已经收口，建议至少满足：

1. 单步 proposal 流在章节、摘要、大纲、workflow、knowledge 五类目标上都能稳定工作。
2. deterministic guard 能稳定拦截非法 proposal。
3. destructive proposal 的确认与快照策略经手工验证可用。
4. workflow / knowledge 写入不会误污染普通聊天。
5. `assistant-action-proposal` 的知识检索命中能稳定提供有效上下文。
6. 核心场景完成一轮人工验收后没有严重回归。

---

## 九、结论

截至 `2026-05-06`，小说助理的 Agent 化工作已经完成了最关键的一段：

- 不是简单聊天助手了
- 已经具备受控动作提议能力
- 已进入 workflow / knowledge 可控写入阶段
- 已有 deterministic guard 保护底线

但距离原计划中的“更完整的小说创作 Agent”还有两块明显工作没有做完：

1. **把项目记忆层真正编排起来**
2. **把单步 proposal 升级为固定多步写作流**

因此，当前最合理的判断是：

**基础层已成型，编排层和工作流层仍待继续开发。**
