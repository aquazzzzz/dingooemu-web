# DingooEmu Web

[中文](#中文) · [English](#english) · [日本語](#日本語)

[访问网站 / Open website / サイトを開く](https://aquazzzzz.github.io/dingooemu-web/)

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

### 今后计划

- **WebAssembly JIT**：探索浏览器端动态重编译方案，以改善游戏运行性能。
- **实体手柄接入**：利用现有输入接口，增加手柄连接状态显示和按键映射设置。

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

### Roadmap

- **WebAssembly JIT**: Explore dynamic recompilation in the browser to improve game performance.
- **Gamepad integration**: Use existing input interfaces to add gamepad connection status displays and button mapping settings.

### Open-source components and licenses

- [DingooEmu](https://github.com/AloysHF/DingooEmu) · AloysHF: source in `core/`, licensed under BSD 3-Clause. See [core/LICENSE](core/LICENSE).
- [RetroArch](https://github.com/libretro/RetroArch): source in `retroarch-src/`, licensed under GPL-3.0-or-later. See [retroarch-src/COPYING](retroarch-src/COPYING) and the license notices in individual source files.
- Third-party dependencies, fonts, and other assets retain their respective licenses. See [LICENSES.md](LICENSES.md) and the website's open-source licenses and third-party notices page.

## 日本語

### サイト概要

DingooEmu Web は、Dingoo A320 と Gemei A330 向けのネイティブゲームやアプリケーションをブラウザーで実行します。A320 の `.app` ファイル、A330 の `.cc`、`.c2s`、`.c3s` ファイル、および ZIP 形式のゲームパッケージに対応しています。

サイトは中国語、英語、日本語に対応し、デスクトップやホーム画面への追加、オフラインでの実行、ゲーム管理、ステートセーブ機能を備えています。ゲームはお使いの端末からインポートしてください。このリポジトリにゲームは含まれていません。

独自の Web インターフェースから、RetroArch の WebAssembly 実行環境を通じて DingooEmu のエミュレーションコアを利用しています。

### ディレクトリ構成

```text
dingooemu-web/
├── .github/workflows/pages.yml     # GitHub Pages の自動デプロイ設定
├── web/                           # Web アプリケーション
│   ├── src/                       # UI、スタイル、翻訳、ゲーム管理、実行処理
│   ├── public/                    # 静的リソース
│   │   ├── runtime/               # Wasm、JavaScript、フォント、実行用リソース
│   │   │   └── audioworklet/       # AudioWorklet 音声実行版
│   │   ├── devices/               # 携帯ゲーム機の画像
│   │   ├── icons/                 # PWA アイコン
│   │   └── licenses/              # サイトのライセンスページで使用する本文
│   ├── index.html                 # サイトの入口
│   ├── licenses.html              # ライセンスページの入口
│   ├── service-worker.js          # オフラインキャッシュのテンプレート
│   ├── vite.config.ts             # Web ビルド設定
│   ├── package.json               # npm コマンドと依存関係
│   └── package-lock.json          # 依存関係のバージョン固定ファイル
├── core/                          # DingooEmu の Rust ソースコード
│   └── crates/
│       ├── dingooemu-core/         # A320/A330 エミュレーションコア
│       └── dingooemu-libretro/     # libretro インターフェース
├── retroarch-src/                 # RetroArch のソースコードと依存関係
├── scripts/                       # ビルドとローカルプレビュー用スクリプト
├── runtime-manifest.json           # 実行用ファイル一覧とバージョン記録
└── LICENSES.md                     # 構成要素のライセンス一覧
```

### 今後の予定

- **WebAssembly JIT**：ブラウザー上での動的再コンパイル方式を検討し、ゲームの実行性能の改善を目指します。
- **ゲームパッドの接続**：既存の入力インターフェースを利用し、接続状態の表示とボタン割り当て設定を追加します。

### オープンソースの構成要素とライセンス

- [DingooEmu](https://github.com/AloysHF/DingooEmu) · AloysHF：ソースコードは `core/` にあり、BSD 3-Clause ライセンスで提供されています。[core/LICENSE](core/LICENSE) を参照してください。
- [RetroArch](https://github.com/libretro/RetroArch)：ソースコードは `retroarch-src/` にあり、GPL-3.0-or-later ライセンスで提供されています。[retroarch-src/COPYING](retroarch-src/COPYING) および各ソースファイルのライセンス表記を参照してください。
- 第三者の依存ライブラリー、フォント、その他のリソースには、それぞれのライセンスが適用されます。[LICENSES.md](LICENSES.md) と、サイトの「オープンソースライセンスと第三者の表記」を参照してください。
