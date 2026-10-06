# 开源组件与许可文件

各目录保留原有版权与许可声明。本文件作为许可索引，不替换组件自己的许可。

| 组件／资源 | 来源及对应源码 | 许可文本 |
| --- | --- | --- |
| DingooEmu 核心与 libretro 接口 | [AloysHF/DingooEmu](https://github.com/AloysHF/DingooEmu)，本地修改源码位于 `core/` | `core/LICENSE`（BSD 3-Clause） |
| DingooEmu 的第三方组件 | `core/Cargo.toml`、`core/Cargo.lock` 与各 crate 声明 | `core/THIRD_PARTY_LICENSES.md` |
| RetroArch 与浏览器运行器 | [libretro/RetroArch](https://github.com/libretro/RetroArch)，本地修改源码位于 `retroarch-src/` | `retroarch-src/COPYING`（GPL），以及各源文件的声明 |
| RetroArch 内含的依赖 | `retroarch-src/deps/`、`retroarch-src/libretro-common/` 等目录 | 对应目录内的 LICENSE、COPYING 及文件声明 |
| RetroArch 字体与加载图标 | `web/public/runtime/font.ttf`、`retroarch.png` | `web/public/runtime/ASSETS-COPYING` |

网站对外提供的许可文本位于 `web/public/licenses/`；许可页面入口为 `web/licenses.html`。重新分发或修改组件时，应保留适用的版权声明及许可文件，并同步网站中的副本。

`web/public/runtime/` 包含已编译的 DingooEmu＋RetroArch WebAssembly 运行文件；相应修改源码和构建脚本随本仓库一起提供。上游链接不能代替本项目使用的修改源码。
