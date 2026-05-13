# 待优化事项

## 高优先级（影响功能正确性）

### 1. 新检索未接入主流程

**现状**：`knowledge-retrieval.ts`（纯关键词匹配）仍是主路径，`knowledge-retrieval-v2.ts` 只用于状态注入，没有替代旧的知识文档检索。

**改动**：
- `orchestrator.ts` 中的 `retrieveKnowledgeContext` 调用替换为 v2 混合检索
- 保留旧检索作为 fallback（embedding 不可用时降级）
- 统一两套检索为一个模块

### 2. Embedding 兼容性

**现状**：Anthropic/Ollama 用户没有 embedding API，调用会静默失败，向量索引永远为空。

**改动**：
- 检测 provider 是否支持 embedding（Anthropic → 不支持，Ollama → 检测模型）
- 不支持时跳过向量索引，仅用关键词检索
- 可选：支持用户单独配置 embedding API（独立于聊天模型）

### 3. 已有项目状态补录

**现状**：已有章节的项目，状态库是空的，`story_character_state` 等表无数据。

**改动**：
- 新增"从已有章节批量提取状态"功能（遍历已有章节，逐章调用 `extractStateDeltaViaLLM`）
- 知识中心加"初始化状态库"按钮
- 首次写章节时如果状态库为空，提示用户是否要补录

---

## 中优先级（影响用户体验）

### 4. 轻检结果展示

**现状**：`_stateWarnings` 写入了 result 但前端没有展示。

**改动**：
- 章节编辑器组件读取 `_stateWarnings`
- 用 Naive UI 的 `n-alert` 或 `n-notification` 展示警告
- 用户可选择忽略或触发自动修复（调用 `chapter-repair`）

### 5. 深度审计入口

**现状**：`story-deep-audit` 任务已注册但前端没有触发按钮。

**改动**：
- 知识中心加"一致性审计"按钮
- 调用 `story-deep-audit` 任务，注入当前世界状态
- 审计报告存入 knowledge_documents，展示给用户
- 可选：每 50 章自动触发提醒

### 6. 状态面板 UI

**现状**：用户无法查看/手动修正角色状态、伏笔、关系。

**改动**：
- 新增 `StoryStatePanel.vue` 组件
- 展示：角色当前状态、活跃伏笔、关系网络、时间线
- 支持手动编辑（修正 AI 提取错误）
- 伏笔健康度可视化（超期警告）

### 7. 删除 `未知skills/` 文件夹

**现状**：已集成完毕，原始文件仍保留在 `resources/未知skills/`。

**改动**：直接删除该目录。

---

## 低优先级（技术债）

### 8. 统一检索模块

**现状**：`knowledge-retrieval.ts` 和 `knowledge-retrieval-v2.ts` 两套共存。

**改动**：
- 合并为单一模块，内部按 embedding 可用性自动选择策略
- 删除旧模块，更新所有引用

### 9. Embedding 维度校验

**现状**：不同模型返回不同维度（768/1024/1536），存储时没有校验。

**改动**：
- 首次 embedding 时记录维度到 `app_settings`
- 后续 embedding 校验维度一致性
- 模型切换时提示用户需要重建索引

### 10. 数据清理

**现状**：章节删除时 embedding 没有清理，会积累垃圾数据。

**改动**：
- 章节删除时级联删除 `story_embeddings` 中对应记录
- 参考作品删除时清理对应的 `reference_novel` embedding 和原文文件
- 可选：定期清理孤立记录

---

## 建议实施顺序

1. **第一批**（1-2天）：#7 删除未知skills + #4 轻检结果展示 + #5 审计入口
2. **第二批**（2-3天）：#1 新检索接入主流程 + #8 统一检索模块
3. **第三批**（1-2天）：#2 Embedding 兼容性 + #9 维度校验
4. **第四批**（3-5天）：#3 状态补录 + #6 状态面板 UI
5. **第五批**（半天）：#10 数据清理
