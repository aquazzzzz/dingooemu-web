# DingooEmu Web

## 中文

### 网站简介

DingooEmu Web 在浏览器中运行丁果 A320（Dingoo A320）和歌美 A330（Gemei A330）掌机的原生游戏与应用。支持导入 A320 的 `.app` 和 A330 的 `.cc`、`.c2s`、`.c3s` 文件，也支持 ZIP 游戏包。

网站支持中文、English、日本語，可添加到桌面／主屏幕，并提供离线运行、游戏管理与即时存档。游戏由您从本机导入，本仓库不包含游戏。

网站采用独立的网页界面，通过 RetroArch 的 WebAssembly 运行环境调用 DingooEmu 模拟核心。

### 目录结构

```text
dingooemu-web/
├── .github/workflows/pages.yml     # GitHub Pages 自动部署配置
├── web/                           # 网页工程
│   ├── src/                       # 界面、样式、翻译、游戏管理与运行器
│   ├── public/                    # 静态资源
│   │   ├── runtime/               # Wasm、JavaScript、字体与运行资源
│   │   │   └── audioworklet/       # AudioWorklet 音频运行版本
│   │   ├── devices/               # 掌机图片
│   │   ├── icons/                 # PWA 图标
│   │   └── licenses/              # 网站许可页面使用的许可文本
│   ├── index.html                 # 网站入口
│   ├── licenses.html              # 开源许可页面入口
│   ├── service-worker.js          # 离线缓存模板
│   ├── vite.config.ts             # 网页构建配置
│   ├── package.json               # npm 命令与依赖
│   └── package-lock.json          # 依赖版本锁定文件
├── core/                          # DingooEmu Rust 源码
│   └── crates/
│       ├── dingooemu-core/         # A320/A330 模拟器核心
│       └── dingooemu-libretro/     # libretro 接口
├── retroarch-src/                 # RetroArch 源码及其依赖
├── scripts/                       # 构建与本地预览脚本
├── runtime-manifest.json           # 运行文件清单与版本记录
└── LICENSES.md                     # 组件许可索引
```

### 开源组件与许可

- [DingooEmu](https://github.com/AloysHF/DingooEmu) · AloysHF：源码位于 `core/`，采用 BSD 3-Clause 许可，详见 [core/LICENSE](core/LICENSE)。
- [RetroArch](https://github.com/libretro/RetroArch)：源码位于 `retroarch-src/`，采用 GPL-3.0-or-later 许可，详见 [retroarch-src/COPYING](retroarch-src/COPYING) 及各源文件的许可声明。
- 第三方依赖、字体与其他资源采用各自的许可，详见 [LICENSES.md](LICENSES.md) 和网站的“开源许可与第三方声明”页面。

## English

### Overview

DingooEmu Web runs native games and applications for the Dingoo A320 and Gemei A330 handhelds in the browser. It supports A320 `.app` files, A330 `.cc`, `.c2s`, and `.c3s` files, as well as ZIP game packages.

The website supports Chinese, English, and Japanese. It can be added to your desktop or home screen and provides offline operation, game management, and save states. You import games from your own device; this repository does not include games.

The website uses a custom web interface that runs the DingooEmu emulation core through RetroArch's WebAssembly runtime.

### Project structure

```text
dingooemu-web/
├── .github/workflows/pages.yml     # GitHub Pages deployment workflow
├── web/                           # Web application
│   ├── src/                       # UI, styles, translations, game management, and runner
│   ├── public/                    # Static assets
│   │   ├── runtime/               # Wasm, JavaScript, fonts, and runtime assets
│   │   │   └── audioworklet/       # AudioWorklet runtime variant
│   │   ├── devices/               # Handheld images
│   │   ├── icons/                 # PWA icons
│   │   └── licenses/              # License texts used by the website
│   ├── index.html                 # Website entry point
│   ├── licenses.html              # License page entry point
│   ├── service-worker.js          # Offline cache template
│   ├── vite.config.ts             # Web build configuration
│   ├── package.json               # npm scripts and dependencies
│   └── package-lock.json          # Dependency lockfile
├── core/                          # DingooEmu Rust source
│   └── crates/
│       ├── dingooemu-core/         # A320/A330 emulation core
│       └── dingooemu-libretro/     # libretro interface
├── retroarch-src/                 # RetroArch source and dependencies
├── scripts/                       # Build and local preview scripts
├── runtime-manifest.json           # Runtime file manifest and version information
└── LICENSES.md                     # Component license index
```

### Open-source components and licenses

- [DingooEmu](https://github.com/AloysHF/DingooEmu) · AloysHF: source in `core/`, licensed under BSD 3-Clause. See [core/LICENSE](core/LICENSE).
- [RetroArch](https://github.com/libretro/RetroArch): source in `retroarch-src/`, licensed under GPL-3.0-or-later. See [retroarch-src/COPYING](retroarch-src/COPYING) and the license notices in individual source files.
- Third-party dependencies, fonts, and other assets retain their respective licenses. See [LICENSES.md](LICENSES.md) and the website's open-source licenses and third-party notices page.
