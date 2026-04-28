# CharacterArc

CharacterArc 是一个本地优先的 AI 小说创作桌面应用，面向需要同时管理项目、世界观、角色、大纲和章节正文的创作者。

当前项目基于 `Electron + Vue 3 + TypeScript + Naive UI + Pinia` 构建，支持本地 SQLite 持久化、项目隔离、多主题切换、AI 辅助创作，以及独立的章节创作页面。

## 当前能力

- 项目中心：展示项目卡片、进入项目、创建新项目
- 新建项目向导：支持填写题材、目标字数、简介，并可调用 AI 生成初始世界观与大纲
- 世界观管理：新增、编辑、删除设定条目
- 角色图鉴：新增、编辑、删除角色卡片
- 剧情大纲：按“卷”管理剧情节点，支持新增分卷、节点编辑和 AI 扩写
- 章节创作：独立创作页，支持分卷章节目录、正文编辑、版本快照、自动保存、AI 辅助
- AI 助手：仅在章节创作场景显示，支持润色、续写、设定查阅等快捷动作
- 项目设置：模型配置、主题色切换、自动保存间隔、导入导出
- 本地持久化：项目数据、章节、历史版本、AI 消息与设置保存在本地 SQLite

## 技术栈

- `Electron`
- `Vue 3`
- `TypeScript`
- `Pinia`
- `Naive UI`
- `electron-vite`
- `SQLite`（主进程持久化）

## 环境要求

- `Node.js` 18+
- `pnpm` 10+
- Windows 开发环境

说明：

- 当前 `package.json` 脚本使用了 Windows 的 `set` 语法，因此默认按 Windows 环境运行。

## 快速开始

```bash
pnpm install
pnpm run dev
```

开发启动后会同时拉起：

- Vite 渲染进程
- Electron 主进程

## 常用脚本

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run dist
```

说明：

- `pnpm run dev`：启动本地开发环境
- `pnpm run build`：执行类型检查并构建 Electron 应用
- `pnpm run preview`：预览构建结果
- `pnpm run dist`：打包桌面安装产物

## 本地数据

应用运行后会在 Electron 用户目录下创建本地数据目录，并使用 SQLite 保存工作区内容。

主要内容包括：

- 项目列表
- 世界观条目
- 角色资料
- 分卷与大纲节点
- 章节正文
- 章节历史版本
- AI 消息记录
- 应用设置

对应主进程实现可见：

- [electron/main/index.ts](./electron/main/index.ts)

## 目录结构

```text
character-arc/
├─ docs/                     # 产品与功能文档
├─ electron/                 # Electron 主进程 / preload
│  └─ main/
├─ renderer/                 # Vue 渲染层
│  └─ src/
│     ├─ components/         # 业务组件
│     ├─ features/           # 功能模块辅助逻辑
│     ├─ pages/              # 页面级视图
│     ├─ stores/             # Pinia 状态管理
│     ├─ theme/              # 主题与设计令牌
│     └─ types/              # 共享类型
├─ prototypeDesign/          # 参考原型
├─ electron.vite.config.ts   # Electron + Vite 配置
└─ package.json
```

## 关键页面说明

- `ProjectCenter`：项目首页
- `ProjectWizardPage`：项目创建向导
- `WorkbenchPage`：项目工作台
- `ChapterStudioPage`：独立章节创作页

## AI 相关说明

- AI 能力通过主进程统一调用
- API Key 等敏感信息保存在主进程侧配置中
- AI 助手当前只在章节创作场景展示

相关实现可见：

- [electron/main/ai.ts](./electron/main/ai.ts)
- [renderer/src/components/AiAssistantPanel.vue](./renderer/src/components/AiAssistantPanel.vue)

## 相关文档

- 功能文档：[docs/functional-spec.md](./docs/functional-spec.md)

## 当前状态

当前版本为 `v0.1`，已完成首批真实可用的创作工作流闭环，重点在于：

- 本地优先
- 单项目工作区隔离
- 可持续写作的章节编辑体验
- 围绕章节上下文的 AI 辅助能力

如果后续继续扩展，比较适合优先推进：

- 分卷排序与迁移
- 更完整的章节管理能力
- 更强的导入导出格式
- 更沉浸的写作模式
