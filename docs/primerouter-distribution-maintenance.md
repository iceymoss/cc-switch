# PrimeRouter 发行版维护指南（跟随上游 cc-switch）

本仓库是 [cc-switch](https://github.com/farion1231/cc-switch) 的 PrimeRouter 二开发行版。
核心原则：**改动收敛、可持续跟随上游迭代**。本文记录改了哪些文件、为什么这样改、以及如何 rebase 上游新版本。

## 改动总览（overlay 面）

发行版只在以下「最小集合」上叠加改动，其余完全沿用上游：

| 文件 | 改动性质 | 冲突风险 |
|------|---------|---------|
| `src/config/distributionWhitelist.ts` | **新增**（白名单 helper） | 无（新文件） |
| `src/config/claudeProviderPresets.ts` | 注入 PrimeRouter 预设 + 导出处套 `applyDistributionWhitelist` | 低（数组首部插入 + 末尾一行包装） |
| `src/config/codexProviderPresets.ts` | 注入 PrimeRouter 预设 + `hidden?` 字段 + 导出包装 | 低 |
| `src/components/providers/forms/ProviderForm.tsx` | codex 分支加 `.filter(!hidden)`（1 处） | 低 |
| `src/icons/extracted/index.ts` | `icons` map 首部新增 `primerouter` 内联 SVG（1 条） | 低（该文件由脚本生成，见下） |
| `src/i18n/locales/{zh,en,zh-TW,ja}.json` | `providerForm.partnerPromotion.primerouter` 文案各 1 条 | 低 |
| `src/lib/updater.ts` | `checkForUpdate` 短路为 up-to-date；上游实现保留为 `checkForUpdateUpstream` | 低 |
| `src-tauri/tauri.conf.json` | 移除 `plugins.updater`、`createUpdaterArtifacts: false` | 中（版本号每次发版会变） |
| `docs/specs/primerouter-distribution.md` | 需求规范 | 无 |
| `tests/config/primerouterDistribution.test.ts`、`tests/lib/updaterDisabled.test.ts` | 回归测试 | 无 |

## 关键设计：为什么用「白名单 = hidden」而非删除

- **不删上游任何预设定义**：上游 40+ 个预设原样保留，只在导出处把非白名单项标记 `hidden`。
- 好处：上游对这些预设的增改在 rebase 时**自动合并**，不产生冲突；上游自带的预设测试全部继续通过。
- 白名单（`Claude Official` / `OpenAI Official` / `PrimeRouter`）置于各数组**最前**，保证「过滤后下标」与「原始下标」对齐（多处代码按下标反查 preset）。
- 新增工具时若也要走白名单，只需在 `DISTRIBUTION_VISIBLE_PRESETS` 加官方名、在该工具预设文件导出处套 `applyDistributionWhitelist`、并确保展示列表 `.filter(!hidden)`。

## 同步上游的流程

```bash
# 1. 配置上游 remote（首次）
git remote add upstream https://github.com/farion1231/cc-switch.git

# 2. 拉取上游
git fetch upstream

# 3. 在发行版分支上 rebase（或 merge）上游某个 tag
git rebase upstream/main          # 或 git merge upstream/v3.x.y

# 4. 解决冲突后，跑回归确认发行版改动仍生效
pnpm install
pnpm run typecheck
pnpm exec vitest run tests/config/primerouterDistribution.test.ts tests/lib/updaterDisabled.test.ts
pnpm run build:renderer
```

### 易冲突点与处理

- **`src/icons/extracted/index.ts` 是脚本生成**（`scripts/extract-icons.js`，文件头标注 "Do not edit manually"）。
  上游重新生成该文件时会覆盖我们手加的 `primerouter` 条目。
  rebase 后若该条目丢失，重新在 `icons` map 首部加回（内容见 git 历史 commit），或将 PrimeRouter logo 纳入 `assets/partners/logos/` 让生成脚本自动收录。
- **`tauri.conf.json`**：上游每次发版改 `version`，rebase 时接受上游版本号即可；保持我们对 `plugins`（已移除 updater）与 `createUpdaterArtifacts: false` 的改动。
- **`updater.ts`**：上游若重构 `checkForUpdate`，保留我们的短路版本、把上游新实现并入 `checkForUpdateUpstream`。

## 验收清单（每次发版前）

- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm exec vitest run` 通过（App 集成测试在并行高负载下偶发超时，为上游既有 flaky，可单独重跑确认）
- [ ] 启动应用：Claude / Codex 列表仅见「官方 + PrimeRouter（紫心置顶）」
- [ ] 填入 `sk-` key 后实际请求经 PrimeRouter 成功
- [ ] 应用无 GitHub 自动更新行为（无 badge、无自动下载）
- [ ] 三平台 `tauri build` 产物正常（见下）

## 打包（步骤 5）

三平台安装包通过各自 OS 或 CI 产出（WSL/Linux 本机只能产 Linux 包）：

```bash
pnpm tauri build        # 当前平台
```

- macOS：本期不做签名/公证，用户首次打开需在「系统设置 → 隐私与安全性」放行（详见 spec 后续迭代）。
- 推荐用 GitHub Actions 矩阵分别在 windows/macos/ubuntu runner 上 `tauri build`，产物上传到 PrimeRouter 官网供下载。
