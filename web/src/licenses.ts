import './styles.css';
import {setupLanguages} from './i18n';
import {setupSourceLink} from './source-link';
import dingooLicense from '../public/licenses/DingooEmu-BSD-3-Clause.txt?raw';
import retroarchLicense from '../public/licenses/RetroArch-GPL-3.0.txt?raw';
import assetsLicense from '../public/runtime/ASSETS-COPYING?raw';
import thirdPartyNotices from '../public/licenses/DingooEmu-THIRD_PARTY_LICENSES.md?raw';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<main class="license-page"><header><div class="header-top"><a href="./">返回模拟器</a><div class="language-placeholder" role="group" aria-label="界面语言"><div class="language-options"><button data-language="zh-CN" class="selected" aria-pressed="true" lang="zh-CN">中文</button><button data-language="en" aria-pressed="false" lang="en">English</button><button data-language="ja" aria-pressed="false" lang="ja">日本語</button></div></div></div><h1>开源许可与第三方声明</h1><p>本站使用以下开源项目与资源。完整许可文本保留原文。</p></header>
<section id="dingooemu"><h2>DingooEmu · BSD 3-Clause</h2><p>Copyright (c) 2025, Aloys (AloysHF)</p><p><a href="https://github.com/AloysHF/DingooEmu" target="_blank" rel="noopener noreferrer">项目主页</a> · <a href="licenses/DingooEmu-BSD-3-Clause.txt" download>下载许可文本</a></p><details open><summary>许可全文</summary><pre id="dingoo-license" class="license-copy" tabindex="0"></pre></details></section>
<section id="retroarch"><h2>RetroArch · GPL-3.0-or-later</h2><p><a href="https://github.com/libretro/RetroArch" target="_blank" rel="noopener noreferrer">项目主页</a> · <a href="licenses/RetroArch-GPL-3.0.txt" download>下载许可文本</a></p><p>本站将 DingooEmu 的 libretro 核心与 RetroArch 编译为 WebAssembly，并提供网页操作界面。</p><p><a data-site-source hidden target="_blank" rel="noopener noreferrer">本站源码</a></p><details><summary>许可全文</summary><pre id="retroarch-license" class="license-copy" tabindex="0"></pre></details></section>
<section id="assets"><h2>第三方资源</h2><p>字体和载入动画图标来自 RetroArch 网页资源包，随包附带 CC BY 4.0 许可。</p><p>本网站使用的资源：font.ttf（原文件名 chinese-fallback-font.ttf）和 retroarch.png；图标缩放用于载入动画。</p><p><a href="https://github.com/libretro/retroarch-assets" target="_blank" rel="noopener noreferrer">RetroArch Assets</a> · <a href="runtime/ASSETS-COPYING" download>下载许可文本</a></p><details><summary>许可全文</summary><pre id="assets-license" class="license-copy" tabindex="0"></pre></details></section>
<section id="third-party"><h2>DingooEmu 附带的第三方声明</h2><p>上游文档列出了启用 JIT 的构建所使用的第三方组件；此处保留原始声明。</p><p><a href="licenses/DingooEmu-THIRD_PARTY_LICENSES.md" download>下载许可文本</a></p><details><summary>许可全文</summary><pre id="third-party-notices" class="license-copy" tabindex="0"></pre></details></section>
<footer class="site-footer"><p>本文所列许可分别适用于对应组件。</p><a href="./">返回模拟器</a></footer></main>`;
for(const [id,text] of [['dingoo-license',dingooLicense],['retroarch-license',retroarchLicense],['assets-license',assetsLicense],['third-party-notices',thirdPartyNotices]])document.getElementById(id)!.textContent=text;
setupSourceLink(app);
setupLanguages(app);
