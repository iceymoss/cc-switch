# PrimeRouter 发行版（中转站预设注入与二开打包）

## 状态
- 创建日期: 2026-06-23
- 状态: 实现中（步骤 1/2/3 已完成：预设注入 + 白名单 + 图标 + 关闭自动更新）

## 实现决策补记（2026-06-23）
「只留官方+PrimeRouter」最终采用**白名单 = 给非白名单预设打 `hidden` 标记**，而非物理删除：
- 新增 `src/config/distributionWhitelist.ts`（`applyDistributionWhitelist` + 可见名单），在 `claudeProviderPresets.ts` / `codexProviderPresets.ts` 的导出处统一套用。
- 保留上游全部预设定义不删，上游测试全绿、rebase 冲突最小。
- 白名单项（`Claude Official` / `OpenAI Official` / `PrimeRouter`）置于各数组最前，保证「过滤后下标」与「原始下标」对齐（多处按下标反查 preset）。
- Codex 侧补 `CodexProviderPreset.hidden?` 字段 + `ProviderForm` codex 分支 `.filter(!hidden)`。

## 目标
以**最小改动**对 cc-switch 进行二次开发，把 PrimeRouter 中转站作为**置顶/默认预设**注入到 **Claude Code 与 Codex 两类工具**，关闭自动更新、改走官网手动下载，产出 Windows / macOS / Linux 三平台安装包。让不懂技术概念的普通用户「官网下载 → 安装 → 注册拿 key → 填入 key」即可用上 Claude Code 等 Agent 工具，降低使用门槛。

核心约束：**所有改动必须收敛、易于 rebase 到上游 cc-switch**，因为本项目核心功能仍需持续跟随开源社区版本迭代。

## 非目标
- 不改 cc-switch 应用品牌（`productName` / `identifier` / 应用图标 / deep-link scheme 保持原样）。
- 不引入账号体系，不做应用内登录/注册（用户去 PrimeRouter 官网拿 key）。
- 不修改 PrimeRouter 后端任何代码。
- 不自建自动更新服务器（本期直接关闭自动更新）。
- 本期不注入 Gemini CLI 预设（官网接入文档未发布、模型名未确认，留作后续）。
- 本期不做 macOS 签名/公证（详见待定事项，先跑通功能）。
- 不锁死「添加自定义供应商」能力（保留 cc-switch 原有开放性，待定）。

## 用户故事
作为一个**不熟悉 base_url / 模型映射等概念的普通用户**，我想要下载一个开箱即用的客户端、只填一个 key 就能用上 Claude Code，以便低门槛地用上优先大模型和 Agent 工具。

作为**PrimeRouter 运营方**，我想要用最小改动维护一个注入了自家中转站预设的 cc-switch 发行版，以便持续跟随上游迭代而不积累维护负担。

## 核心流程（Happy Path）
1. 用户在 PrimeRouter 官网下载对应平台安装包并安装。
2. 打开应用，供应商（Claude）列表中 **PrimeRouter 置顶且默认选中**，并带置顶徽章/推广文案。
3. 用户点击预设上的「获取 API Key」链接（`apiKeyUrl`），跳转 PrimeRouter 官网注册并生成 `sk-` 开头的 key。
4. 用户把 key 粘贴进输入框，保存。
5. cc-switch 把 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / 模型映射写入 `~/.claude/settings.json`。
6. 用户在终端运行 Claude Code，请求经 PrimeRouter `/v1/messages` 中转，正常返回。

## 异常处理
| 场景 | 处理方式 |
|------|---------|
| key 为空就保存 | 沿用 cc-switch 现有校验，提示填入 key（不写入空 token） |
| key 错误/额度不足 | 由 PrimeRouter 上游返回错误，Claude Code 透传错误信息（不在客户端吞掉） |
| base_url 不可达/超时 | Claude Code 自身报错；预设提供 `endpointCandidates` 备用地址（待定是否需要） |
| 用户误删 PrimeRouter 预设 | 预设为内置模板，重启或「恢复预设」可重新出现（沿用 cc-switch 现有机制） |
| 自动更新被关闭后版本陈旧 | 文案/链接引导用户「前往官网检查更新」（UI 入口处理见待定项） |
| 上游 cc-switch 升级与本地改动冲突 | 改动集中在少数文件，通过 patch/overlay 方式 rebase（见技术设计） |

## 技术设计

### 架构现状（调研结论）
- cc-switch 是 **Tauri（Rust + React/Vite）** 桌面应用，纯本地工具、无账号体系。
- 各工具的预置供应商分别定义在 `src/config/*ProviderPresets.ts`，其中 Claude Code 用 `src/config/claudeProviderPresets.ts`。
- 单条预设结构（`ProviderPreset`）关键字段：`name` / `nameKey` / `websiteUrl` / `apiKeyUrl` / `settingsConfig.env`（含 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL` 及 haiku/sonnet/opus 映射）/ `isOfficial` / `isPartner` / `primePartner`（置顶心形徽章）/ `partnerPromotionKey` / `apiKeyField` / `theme` / `icon`。
- PrimeRouter（基于 new-api）**原生兼容 Anthropic Messages `/v1/messages`**，key 为 `sk-` 格式；客户端只需填 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`。
- 品牌与更新配置在 `src-tauri/tauri.conf.json`：`productName: "CC Switch"`、`identifier: com.ccswitch.desktop`、`plugins.updater.endpoints` 指向 `github.com/farion1231/cc-switch`。

### 数据模型
无新增/变更数据库 schema（cc-switch 为本地 JSON 配置）。仅改动前端 TS 预设模板与 i18n 文案、Tauri 配置。

### PrimeRouter 接入参数（来自官网文档 https://www.primerouter.xyz/docs/coding-tools/）
统一注册/拿 key：官网 `https://www.primerouter.xyz/` → 控制台 → 令牌 → 添加令牌（分组选 `default`）→ 复制 `sk-` key。

| 工具 | cc-switch 写入位置 | 关键配置 |
|------|------|------|
| Claude Code | `claudeProviderPresets.ts` → `settingsConfig.env`（`apiKeyField: "ANTHROPIC_AUTH_TOKEN"`） | `ANTHROPIC_BASE_URL=https://www.primerouter.xyz`（**不带 /v1**，客户端自动追加 `/v1/messages`）、`ANTHROPIC_AUTH_TOKEN=<key>`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、`ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4-6`、`ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-7` |
| Codex | `codexProviderPresets.ts` → `auth`(auth.json `OPENAI_API_KEY`) + `config`(config.toml 字符串) | `base_url=https://www.primerouter.xyz/v1`、`wire_api="chat"`、`model=claude-sonnet-4-6`（PrimeRouter 文档明确用 chat completions，而非 cc-switch 默认的 `responses`） |

> Gemini CLI 本期不做（端点 `/v1beta` 存在但官网文档未发布、默认模型名未确认），留作后续迭代。

### 品牌资源（已确认）
- Logo：取自 PrimeRouter `web/public/logo.svg`（紫色渐变 `#6366F1 → #8B5CF6 → #A855F7`，白色节点图形）。
- 预设主题：`theme.backgroundColor = "#6366F1"`（靛紫主色）、`theme.textColor = "#FFFFFF"`。
- 需把 logo 接入 cc-switch 图标体系（svg 资源 + `iconInference`/`icon` 名称登记）。

### 改动文件清单（最小化，便于跟随上游）
| 文件 | 改动 |
|------|------|
| `src/config/claudeProviderPresets.ts` | 新增 `PrimeRouter` 预设（`primePartner: true` 置顶 + 上表 env + 主题色）；删除/注释其它第三方中转站预设，仅保留 `Claude Official` + `PrimeRouter` |
| `src/config/codexProviderPresets.ts` | 新增 `PrimeRouter` 预设（`auth` + `config.toml`，`wire_api="chat"`）；仅保留官方 + `PrimeRouter` |
| `src/i18n/locales/{zh,en,zh-TW}.json` | 新增 PrimeRouter 的 `nameKey` 与 `partnerPromotion` 文案条目（两类工具共用） |
| `src-tauri/tauri.conf.json` | 移除/禁用 `plugins.updater`（关闭自动更新与更新产物） |
| 「检查更新」UI 入口 | 隐藏或改为「前往官网」外链（具体入口待定位） |
| 图标资源 | 接入 PrimeRouter 图标 svg（`#6366F1` 主题） |

### 实现步骤（每步可独立 commit）
1. [ ] 注入 PrimeRouter 两类预设（Claude / Codex）+ 置顶（`primePartner`）+ 主题色 + i18n 文案
2. [ ] 精简各预设列表：仅保留各自官方 + `PrimeRouter`
3. [ ] 关闭自动更新：移除 `tauri.conf.json` updater 段 + 处理「检查更新」UI 入口
4. [ ] 接入 PrimeRouter 图标 svg 资源
5. [ ] 三平台打包验证（复用现有 `pnpm tauri build` 与 GitHub workflow / 本地构建）
6. [ ] 沉淀「跟随上游」的 rebase/overlay 流程文档

### 参考的现有模式
- `src/config/claudeProviderPresets.ts` 中 `Shengsuanyun` 条目 —— partner 预设的完整写法（`settingsConfig.env` 模型映射、`isPartner`、`partnerPromotionKey`、`icon`、`category: "aggregator"`），PrimeRouter 直接照此模板写并升级为 `primePartner` 置顶。
- `src-tauri/tauri.conf.json` 的 `plugins.updater` 段 —— 关闭自动更新的改动点。
- `src/config/geminiProviderPresets.ts` / `codexProviderPresets.ts` —— 后续迭代注入 Gemini/Codex 预设的参考。

## 测试计划
- [ ] 单元：`claudeProviderPresets` 仅含 `Claude Official` + `PrimeRouter`，且 PrimeRouter `primePartner === true`、env 字段齐全（`test:unit` / vitest）
- [ ] 单元：i18n 三语言文件均含 PrimeRouter 文案 key，无缺失
- [ ] 手动：打开应用，PrimeRouter 置顶且默认选中，无其它第三方中转站预设
- [ ] 手动：填入真实 `sk-` key 后写入 `~/.claude/settings.json`，Claude Code 实际请求经 PrimeRouter 成功返回
- [ ] 手动：确认应用内无 GitHub 自动更新弹窗/请求
- [ ] 构建：三平台 `tauri build` 产出安装包成功

## 待定事项
- Claude Code 的 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 文档未给值，是否需要设置（留空则走上游默认）。
- 「检查更新」UI 入口的确切位置与处理方式（隐藏 vs 改外链官网）。
- 是否需要隐藏/限制「添加自定义供应商」，还是保留 cc-switch 原有开放能力。
- 跟随上游的工程化方式：fork 后用 overlay/patch 分层维护，使改动（预设、i18n、tauri 配置）最小冲突。

## 后续迭代（本期不做）
- Gemini CLI 预设：待 PrimeRouter 发布接入文档并确认默认 `GEMINI_MODEL` 后注入（`/v1beta` 端点已具备）。
- **macOS 签名/公证**：不签名的安装包，macOS 用户首次打开会被 Gatekeeper 拦截（提示「无法验证开发者」，需右键打开或在系统设置放行）。本期先跑通功能、暂不处理；正式对外分发前再补 Apple 开发者签名+公证。
- 应用内引导注册、自建更新源、自定义品牌换皮。

## MVP 范围
- ✅ Claude Code 与 Codex 两类工具均注入 PrimeRouter 置顶预设（`#6366F1` 主题 + 三语言文案）。
- ✅ 各预设仅保留各自官方 + `PrimeRouter`，移除其它第三方中转站预设。
- ✅ 关闭自动更新，引导官网下载。
- ✅ Windows / macOS / Linux 三平台安装包（macOS 暂不签名）。
