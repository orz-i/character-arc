# Changelog

本项目所有显著变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-05-24

首个正式版本。详细发布说明见 [docs/release-notes/v1.0.0.md](docs/release-notes/v1.0.0.md)。

### Added

- **项目与资料**：项目中心、新建项目向导（AI 螺旋式生成首批设定与大纲）、知识中心、全局拆书知识库
- **世界观与结构**：世界观/角色/组织/关系管理、Cytoscape 关系图谱、双栏交错时间线剧情大纲、剧情线索
- **章节创作**：VS Code 风格三栏工作区（目录树 + TipTap 编辑器 + AI 侧边栏）、自动保存与历史快照、阅读/专注模式、字数目标、`.txt`/`.docx`/JSON 导出
- **AI 辅助**：润色、续写、改写、节奏调整、摘要、伏笔识别、后续剧情链；章节初稿整章流式生成；AI 对话流式输出与中途停止；Agent Loop 循环思考与工具调用；任务进度面板
- **封面工作台**：番茄/起点/晋江/知乎盐言/七猫/刺猬猫等多平台封面 Prompt 生成与历史版本对比
- **多厂商接入**：DeepSeek（含 reasoning_content）、通义千问、智谱 GLM、Kimi、SiliconFlow、OpenAI、Anthropic、Ollama、New API / One API 网关；Embedding 模型独立配置
- **Skill 系统**：内置 15 个 Skill，frontmatter 元数据驱动，支持项目级独立导入
- **架构**：Electron + Vue 3 + TypeScript，AI 管线基于 Vercel AI SDK，导入参考小说自动建立向量索引
- **UI/UX**：Nord 风格深色 + 暖色调浅色双主题，自定义标题栏（titleBarOverlay）

### Security

- 全部数据保存在本地 SQLite，不上传任何第三方服务

[1.0.0]: https://github.com/zhouyeshan/character-arc/releases/tag/v1.0.0
