# PrimeRouter 发行版打包指南（macOS / Windows）

本文档说明如何在 **macOS** 和 **Windows** 本机把 PrimeRouter 发行版打成安装包。
本发行版已关闭自动更新（`createUpdaterArtifacts: false`、移除 `plugins.updater`），
因此**打包不需要 Tauri 更新签名私钥**，流程比上游简单。

> 三平台产物建议最终用 GitHub Actions 矩阵统一产出；本文针对你本机手动打包（mac/win）。

---

## 通用前置

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+（本仓库 `.node-version` = 22.12） | 前端构建 |
| pnpm | 跟随 `packageManager` | **本项目用 pnpm，不要用 npm/yarn** |
| Rust | stable（`rust-toolchain.toml` 固定） | 首次会自动安装对应 toolchain |

```bash
# 安装 Rust（若没有）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# 安装 pnpm（若没有）
npm i -g pnpm
```

拉取代码：

```bash
git clone https://github.com/iceymoss/cc-switch.git
cd cc-switch
git checkout feat/primerouter-distribution-spec   # 或已合并到 main 就用 main
pnpm install
```

---

## macOS 打包

### 1. 系统前置

```bash
xcode-select --install        # Xcode Command Line Tools（含 clang/链接器）
```

macOS 上 Tauri 不需要额外的 webkit 系统库（系统自带 WKWebView）。

### 2. 添加目标架构

```bash
# Apple Silicon + Intel 通用包需要两个 target
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

### 3. 打包

```bash
# 方式 A：通用包（同时支持 M 系列与 Intel，推荐对外分发）
pnpm tauri build --target universal-apple-darwin

# 方式 B：仅当前架构（更快，自用/测试）
pnpm tauri build
```

### 4. 产物位置

```
src-tauri/target/universal-apple-darwin/release/bundle/
├── macos/CC Switch.app          # 应用本体
└── dmg/CC Switch_3.16.3_universal.dmg   # 拖拽安装的 DMG
```

（用方式 B 时路径为 `src-tauri/target/release/bundle/...`）

### 5. 未签名 App 的打开方式（重要）

本发行版**未做 Apple 签名/公证**，用户首次打开会被 Gatekeeper 拦截（提示「无法验证开发者」）。给终端用户的说明二选一：

- **右键打开**：Finder 里右键 App →「打开」→ 弹窗里再点「打开」。
- **命令行去隔离属性**（适合在官网给出）：
  ```bash
  xattr -dr com.apple.quarantine "/Applications/CC Switch.app"
  ```

> 可选：本机自测时给 App 打**临时 ad-hoc 签名**减少弹窗（非正式签名，换机仍会提示）：
> ```bash
> codesign --force --deep --sign - "src-tauri/target/release/bundle/macos/CC Switch.app"
> ```
> 正式对外分发建议申请 Apple Developer 证书做签名+公证（见 spec 后续迭代）。

---

## Windows 打包

### 1. 系统前置

- **Visual Studio Build Tools**（含 *Desktop development with C++*：MSVC + Windows 10/11 SDK）
  下载：https://visualstudio.microsoft.com/visual-cpp-build-tools/
- **WebView2 Runtime**：Win10/11 通常已内置；缺失时从微软官网装 Evergreen Runtime。
- Rust 默认用 `x86_64-pc-windows-msvc` toolchain（装 Rust 时选 MSVC）。

WiX/NSIS 由 Tauri CLI 自动下载，无需手动安装。本仓库已配置 WiX 模板
`src-tauri/wix/per-user-main.wxs`（per-user 安装，无需管理员权限）。

### 2. 打包（PowerShell）

```powershell
pnpm install
pnpm tauri build
```

### 3. 产物位置

```
src-tauri\target\release\bundle\
├── msi\CC Switch_3.16.3_x64_en-US.msi     # WiX MSI 安装包
└── nsis\CC Switch_3.16.3_x64-setup.exe    # NSIS 安装程序
```

便携版可执行文件：`src-tauri\target\release\cc-switch.exe`

### 4. SmartScreen 提示

未做代码签名的安装包，Windows SmartScreen 首次运行会提示「Windows 已保护你的电脑」。
用户点「更多信息」→「仍要运行」即可。正式分发可考虑购买 EV 代码签名证书消除提示。

---

## 验收（打包后自检）

1. 安装并打开应用。
2. 进入「添加供应商」：Claude / Codex 列表**只有官方 + PrimeRouter（紫心置顶）**。
3. 选 PrimeRouter，填入官网生成的 `sk-` key，保存。
4. 终端跑 `claude`（或 `codex`），确认请求经 `https://www.primerouter.xyz` 正常返回。
5. 确认应用**无自动更新弹窗 / 无 GitHub 更新请求**。

---

## 常见问题

- **打包报错缺 `wix`/`nsis`**：联网让 Tauri CLI 自动下载；公司内网需配代理。
- **macOS 报 `failed to bundle project` 且与 updater 有关**：确认 `tauri.conf.json` 中
  `createUpdaterArtifacts` 为 `false`、且 `plugins` 下无 `updater`（本发行版已设好）。
- **版本号**：发版前改 `package.json` 与 `src-tauri/tauri.conf.json` 的 `version` 保持一致。
- **跟随上游**：rebase 上游后重新打包前，先跑
  `pnpm run typecheck && pnpm exec vitest run`，详见
  [primerouter-distribution-maintenance.md](./primerouter-distribution-maintenance.md)。
