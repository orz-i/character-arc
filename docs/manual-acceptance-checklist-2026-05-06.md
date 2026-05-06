# CharacterArc Agent 手工验收清单（2026-05-06）

## 一、目标

这份清单用于验证当前“受控小说创作 Agent v1 基础层”是否可稳定使用，重点覆盖：

1. 普通聊天与 proposal 路由是否正常
2. proposal → confirm → apply 链路是否正常
3. 五类写入目标是否写入正确位置
4. destructive guard 是否生效
5. workflow scratchpad 自动记录是否生效
6. assistant window 与主窗口同步是否正常

---

## 二、验收前准备

### 运行前置

1. 启动应用并进入一个已有项目
2. 确认当前项目至少有：
   - 1 个分卷
   - 1 个章节
   - 1 条章节摘要
   - workflow 面板可正常打开
3. 打开 AI 助手窗口
4. 准备一段当前章节正文，确保可以选中文本

### 建议记录方式

每完成 1 个用例，记录：

- 结果：通过 / 失败
- 现象截图：可选
- 实际写入位置
- 是否有副作用

---

## 三、通过标准

若以下条件同时满足，可认为本轮基础层验收通过：

1. 普通聊天稳定，不会误写项目数据
2. proposal 不会绕过确认直接写入
3. 章节 / 大纲 / workflow / knowledge 写入位置正确
4. destructive proposal 必须确认后才执行
5. reject / clear proposal 不产生副作用
6. scratchpad 自动记录正常，且不会递归污染自己
7. assistant window 与主窗口状态同步正常

---

## 四、验收用例

## Case 01 普通聊天稳定

**操作步骤**

1. 在助手窗口输入一个普通问题，例如“帮我分析这一章的情绪节奏，但先不要修改任何内容”
2. 等待 AI 返回
3. 检查是否出现 proposal 卡片
4. 检查章节标题、摘要、正文、大纲、workflow、knowledge 是否变化

**预期结果**

- 返回普通聊天内容
- 不出现 proposal 卡片，或即使出现也不自动执行
- 项目数据无任何写入

**失败判定**

- 普通聊天直接触发写入
- 未确认就修改了章节或 workflow

---

## Case 02 freeform 请求触发 proposal，但不自动写入

**操作步骤**

1. 输入“把这一章摘要整理成一句更紧凑的版本，并给我一个可直接应用的建议”
2. 等待 proposal 出现
3. 不点击确认
4. 直接去查看当前章节摘要

**预期结果**

- 出现 proposal 卡片
- proposal 状态为待确认
- 章节摘要尚未变化

**失败判定**

- proposal 生成后立即改写摘要

---

## Case 03 更新章节摘要

**操作步骤**

1. 触发一个 `update-chapter-summary` proposal
2. 记录 proposal 中展示的 before / after
3. 点击确认
4. 回到章节面板检查摘要
5. 打开当前分卷 workflow，查看 `progress`、`current_status`

**预期结果**

- 摘要被正确更新
- proposal 状态变为已应用
- `progress` 自动追加一条“更新章节摘要”记录
- `current_status` 被自动刷新或保持安全不覆盖

**失败判定**

- 摘要内容不一致
- proposal 已确认但未写入
- `progress` 没记录

---

## Case 04 更新章节标题

**操作步骤**

1. 触发一个 `update-chapter-title` proposal
2. 点击确认
3. 检查章节标题是否更新
4. 如有版本快照入口，检查是否生成章节版本
5. 检查 `progress`

**预期结果**

- 章节标题更新正确
- destructive proposal 先确认后执行
- `progress` 有“更新章节标题”记录

**失败判定**

- 标题被错误覆盖
- 未确认直接改标题

---

## Case 05 插入章节正文

**操作步骤**

1. 触发一个 `insert-into-chapter` proposal，模式为 `append`
2. 点击确认
3. 回到章节正文，检查内容是否追加到目标位置
4. 检查 `progress`

**预期结果**

- 正文被追加到正确位置
- 不会错误替换现有正文
- `progress` 记录“追加正文”或等价描述

**失败判定**

- 写到了错误章节
- 内容丢失或重复

---

## Case 06 替换选区 guard

**操作步骤**

1. 在正文中手动选中一段文本
2. 在助手中触发“替换选区”动作
3. 观察 proposal 是否标记为 destructive
4. 不确认时检查正文是否变化
5. 确认后检查仅选区部分是否被替换

**预期结果**

- proposal 明确要求确认
- 未确认前正文不变
- 确认后只替换选区，不波及其他段落

**失败判定**

- `replace-selection` 不要求确认
- 未确认直接替换
- 替换范围错误

---

## Case 07 创建大纲节点

**操作步骤**

1. 触发一个 `create-outline-item` proposal
2. 记录 proposal 中的标题、摘要、冲突
3. 点击确认
4. 去当前分卷大纲列表检查新节点
5. 检查 `progress`
6. 检查 `task_plan` 是否有新的后续建议

**预期结果**

- 节点创建在正确分卷
- 标题、摘要、冲突与 proposal 基本一致
- `progress` 自动记录
- `task_plan` 追加后续待办建议

**失败判定**

- 节点插入到错误分卷
- 缺字段或内容错位
- `task_plan` 未更新

---

## Case 08 追加 workflow 条目

**操作步骤**

1. 触发一个 `append-workflow-document-entry` proposal，例如写入 `pending_hooks`
2. 点击确认
3. 打开目标 workflow 文档
4. 检查新条目标题和正文
5. 检查 `progress`

**预期结果**

- 条目追加到正确 workflow 文档
- 原文档已有内容不被覆盖
- `progress` 记录一次流程文档更新

**失败判定**

- 追加变成覆盖
- 写错文档
- 写入后又自动反复追加同类记录

---

## Case 09 覆盖 workflow 文档

**操作步骤**

1. 触发一个 `update-workflow-document` proposal
2. 观察是否标记 destructive 且要求确认
3. 点击确认
4. 检查目标 workflow 文档正文是否被整体更新
5. 检查 `progress`

**预期结果**

- proposal 明确为 destructive
- 必须确认后执行
- workflow 文档更新正确
- `progress` 自动记录一次覆盖动作

**失败判定**

- 覆盖类 workflow proposal 未要求确认
- 写入到错误文档

---

## Case 10 沉淀 knowledge document

**操作步骤**

1. 触发一个 `save-knowledge-document` proposal
2. 记录标题、sourceType、summary、keywords
3. 点击确认
4. 检查 knowledgeDocuments 中是否新增或合并成功
5. 检查 `progress`

**预期结果**

- 知识文档成功写入知识库
- 标题、摘要、sourceType、keywords 合理
- `progress` 记录“沉淀项目知识”

**失败判定**

- 知识未写入
- sourceType 非法
- 写入后字段明显缺失

---

## Case 11 reject proposal 无副作用

**操作步骤**

1. 触发任意 proposal
2. 点击拒绝
3. 检查章节、workflow、knowledge 是否有变化
4. 检查 proposal 状态

**预期结果**

- proposal 状态为 rejected
- 所有业务数据不发生变化

**失败判定**

- reject 后仍发生写入

---

## Case 12 clear proposal 无副作用

**操作步骤**

1. 触发任意 proposal
2. 点击清除 / 关闭
3. 检查 proposal 卡片是否消失
4. 检查业务数据是否变化

**预期结果**

- proposal 被清理
- 不发生任何写入

**失败判定**

- clear 后仍然执行了 proposal

---

## Case 13 assistant window 与主窗口同步

**操作步骤**

1. 在助手窗口触发 proposal
2. 在主窗口观察 proposal 状态是否同步
3. 在任一窗口执行确认 / 拒绝 / 清除
4. 回到另一窗口观察状态

**预期结果**

- proposal 内容同步
- 确认状态同步
- 执行阶段同步

**失败判定**

- 两个窗口状态不一致
- 已确认但另一端仍显示 pending

---

## Case 14 proposal 场景知识检索

**操作步骤**

1. 准备一个明显依赖项目知识的问题，例如要求引用既有设定、当前 workflow 结论或章节摘要
2. 触发 proposal
3. 观察最终 proposal 是否与项目现有设定一致
4. 检查 AI run 中的 usedKnowledge（如界面可见）

**预期结果**

- proposal 能参考项目知识
- 不会明显违背既有设定
- usedKnowledge 命中合理，不过度重复

**失败判定**

- proposal 明显脱离项目上下文
- 检索重复严重或无关内容过多

---

## Case 15 scratchpad 不递归污染

**操作步骤**

1. 连续确认 2 到 3 个 proposal
2. 打开 `progress`
3. 检查每次动作是否只追加 1 条记录
4. 打开 `task_plan` 和 `current_status`
5. 检查是否存在“写入 scratchpad 后再次因为 scratchpad 触发更多 scratchpad 写入”的异常

**预期结果**

- 每个 proposal 只带来有限、可解释的自动记录
- `progress` 不出现爆炸式重复条目
- `task_plan` / `current_status` 更新频率可控

**失败判定**

- 一次确认带来多轮重复写入
- 文档被自动刷屏

---

## 五、建议的本轮最小验收路径

如果时间有限，优先跑这 6 个：

1. Case 02 freeform proposal 不自动写入
2. Case 03 更新章节摘要
3. Case 06 替换选区 guard
4. Case 07 创建大纲节点
5. Case 08 追加 workflow 条目
6. Case 10 沉淀 knowledge document

这 6 个用例通过后，基本能覆盖当前阶段最关键的风险点。

---

## 六、验收结果记录模板

可直接按下面格式记录：

```md
## 验收结果

- Case 01：通过 / 失败
  - 现象：
  - 备注：

- Case 02：通过 / 失败
  - 现象：
  - 备注：
```

