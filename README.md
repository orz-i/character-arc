# CharacterArc

CharacterArc 是一个本地优先的 AI 小说创作桌面应用，面向需要同时维护项目、设定、角色、剧情结构和章节正文的长线创作者。

当前仓库基于 `Electron + Vue 3 + TypeScript + Pinia + Naive UI` 构建，核心特征是：

- 本地优先：项目数据保存在本机 SQLite，不依赖自建后端
- 单项目工作区隔离：每个项目独立维护设定、章节、知识库和 AI 运行记录
- 双窗口协作：主写作窗口之外，支持独立 AI 助手窗口
- 章节中心工作流：大纲、灵感、知识和 AI 能力最终都围绕章节写作落地

## 当前能力

- 项目中心：查看、创建、编辑、删除项目
- 新建项目向导：填写题材、篇幅、简介，并可调用 AI 生成首批世界观、大纲和起始章节骨架
- 小说流程面板：按分卷维护流程文档，并支持导入参考小说进行“拆书”分析
- 知识中心：沉淀项目事实、参考文档、流程文档和风格分析结果
- 世界观 / 角色 / 组织 / 关系管理：维护项目基础设定资产
- 剧情大纲：按“卷”组织剧情节点，支持新增、编辑、移动和扩写
- 章节创作：独立写作页面，支持富文本编辑、自动保存、版本快照、阅读模式和分卷章节管理
- AI 写作辅助：章节润色、续写、摘要生成、伏笔识别、初稿生成、动作提议
- 独立助手窗口：与主窗口同步当前项目、章节和选中文本上下文
- 导入导出：支持 JSON、纯文本导出，以及项目数据导入
- 本地项目技能：支持扫描和导入项目级 Skill 包，参与 AI 上下文构建

## 它是怎么工作的

应用主要由三层组成：

1. Electron 主进程

- 创建主窗口和助手窗口
- 注册 IPC 接口
- 负责本地 SQLite 读写
- 统一执行 AI 请求、流式输出和模型能力探测

2. Preload 桥接层

- 通过 `window.characterArc` 暴露安全的 IPC API
- 渲染进程只能通过桥接访问文件、窗口、AI 和持久化能力

3. Vue 渲染层

- 使用 Pinia 维护完整工作区状态
- 启动时先从 SQLite 水合状态，再挂载界面
- 用户操作先更新 Store，再通过防抖持久化同步回主进程

一个典型链路是：

`启动应用 -> 主进程建窗 -> 渲染层初始化 Store -> 从 SQLite 加载工作区 -> 用户编辑章节 -> Pinia 更新状态 -> 自动保存写回 SQLite -> 需要 AI 时通过主进程统一调用模型`

## 关键工作流

### 1. 新建项目

- 在创建向导中填写标题、题材、篇幅和简介
- 可选择空白创建，或执行 `project-bootstrap` 生成首批设定与大纲
- 最终在本地创建新的项目摘要和独立工作区

### 2. 工作台组织素材

- 在工作台维护世界观、角色、组织、关系、灵感、大纲和知识中心
- 这些内容会作为后续章节创作与 AI 调用的上下文来源

### 3. 章节写作

- 章节页是独立创作页，围绕当前章节进行编辑
- 支持章节目录、分卷切换、目标字数、版本快照、阅读模式
- AI 初稿生成会先规划场景，再按段流式生成正文

### 4. 助手协作

- 助手窗口会同步当前项目、当前章节和选中文本
- 它既能直接返回文本，也能生成“动作提议”
- 动作提议需要主窗口确认后才会真正落地到正文或大纲

## AI 能力说明

AI 调用统一发生在主进程，主要包括：

- `project-bootstrap`：创建项目时生成初始设定与大纲
- `chapter-assistant`：章节润色、续写、改写、问答
- `chapter-first-draft`：整章初稿生成
- `chapter-scene-plan`：初稿前的场景拆分规划
- `chapter-summarize`：生成章节摘要
- `plot-thread-detect`：识别当前章节中的伏笔或剧情线
- `assistant-intent` / `assistant-action-proposal`：让独立助手判断意图并生成可确认的动作提议
- `reference-style-chunk` / `reference-style-analysis`：对导入参考小说进行风格拆解

AI 在章节相关任务中，会自动结合当前项目的知识文档做一次本地检索，再把命中的上下文一并送入 prompt。

## 本地数据与持久化

应用运行后会在 Electron 用户目录下创建本地数据目录，并维护 `workspace.db`。

当前数据库保存的核心数据包括：

- 项目摘要
- 世界观条目
- 角色、组织、关系和成员归属
- 分卷与大纲节点
- 章节正文与章节版本
- AI 消息记录
- 知识文档
- AI 运行记录
- 应用设置
- 每卷流程文档

当前实现采用“完整工作区快照”写回策略：渲染层维护完整状态，主进程以事务方式写回 SQLite。

## 技术栈

- `Electron`
- `Vue 3`
- `TypeScript`
- `Pinia`
- `Naive UI`
- `electron-vite`
- `TipTap`
- `SQLite`（Node `sqlite` / 主进程持久化）
- `Cytoscape`（关系图）
- `mammoth`（`.docx` 解析，用于参考小说导入）

## 环境要求

- `Node.js` 18+
- `pnpm` 10+
- Windows 开发环境

说明：

- 当前脚本使用了 Windows 的 `set` 语法，默认以 Windows 为主要开发环境

## 快速开始

```bash
pnpm install
pnpm run dev
```

开发模式会同时启动：

- Electron 主进程
- Vite 渲染进程

## 常用脚本

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run dist
```

- `pnpm run dev`：启动本地开发环境
- `pnpm run build`：执行类型检查并构建 Electron 应用
- `pnpm run preview`：预览构建结果
- `pnpm run dist`：打包 Windows 安装产物

## 目录结构

```text
CharacterArc/
├─ docs/                        # 产品文档、流程资料、阶段记录
├─ electron/
│  ├─ main/                     # 主进程、SQLite、IPC、AI runtime、窗口管理
│  └─ preload/                  # 渲染层桥接 API
├─ renderer/
│  └─ src/
│     ├─ components/            # 业务组件
│     ├─ features/              # 功能模块与上下文拼装逻辑
│     ├─ pages/                 # 页面级视图
│     ├─ stores/                # Pinia Store
│     ├─ theme/                 # 主题与设计令牌
│     ├─ types/                 # 共享类型
│     └─ utils/                 # 工具函数
├─ resources/                   # 应用图标等资源
├─ electron.vite.config.ts      # Electron + Vite 配置
├─ package.json
└─ README.md
```

## 关键文件

- `electron/main/index.ts`：主进程入口
- `electron/main/register-main-ipc.ts`：文件、窗口、导入导出、工作区等 IPC
- `electron/main/ai/ipc.ts`：AI IPC 注册
- `electron/main/ai/runtime/orchestrator.ts`：AI 任务调度入口
- `electron/main/workspace-store.ts`：SQLite 建表、迁移、读写快照
- `electron/main/window-manager.ts`：主窗口 / 助手窗口管理
- `electron/preload/index.ts`：`window.characterArc` 桥接层
- `renderer/src/stores/app.ts`：应用核心状态与持久化调度
- `renderer/src/pages/ProjectCenter.vue`：项目中心
- `renderer/src/pages/ProjectWizardPage.vue`：项目创建向导
- `renderer/src/pages/WorkbenchPage.vue`：项目工作台
- `renderer/src/pages/ChapterStudioPage.vue`：章节创作页
- `renderer/src/pages/AssistantWindowPage.vue`：独立助手窗口页面

## 当前状态

当前版本已经形成一套可实际使用的小说创作闭环，重点在于：

- 本地优先的数据安全感
- 单项目工作区隔离
- 章节导向的写作体验
- 围绕知识中心和流程文档的 AI 辅助
- 主窗口与独立助手窗口协同

仍适合继续加强的方向包括：

- 更细粒度的 SQLite 增量写入，而不是全量快照
- 更完整的排序、批量编辑和跨卷迁移能力
- 更丰富的导入导出格式
- 更强的写作审校、风格一致性和知识冲突检测
- 更成熟的项目技能与提示词编排能力

## 相关实现入口

- [electron/main/index.ts](./electron/main/index.ts)
- [electron/main/workspace-store.ts](./electron/main/workspace-store.ts)
- [electron/main/ai/ipc.ts](./electron/main/ai/ipc.ts)
- [electron/main/ai/runtime/orchestrator.ts](./electron/main/ai/runtime/orchestrator.ts)
- [renderer/src/stores/app.ts](./renderer/src/stores/app.ts)
- [renderer/src/components/ChaptersPanel.vue](./renderer/src/components/ChaptersPanel.vue)
- [renderer/src/features/assistant/useAssistantSession.ts](./renderer/src/features/assistant/useAssistantSession.ts)
