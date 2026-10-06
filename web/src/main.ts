import {t,setText,literal,setupLanguages,localize,onLanguageChange} from './i18n';
import './styles.css';
import {setupPwa} from './pwa';
import {setupSiteCache,clearOfflineCache,reloadAfterCacheClear} from './site-cache';
import {clearSiteData} from './storage/site-data';
import {EmulatorClient} from './emulator/client';
import {InputState,buttons,type Button} from './input/state';
import {Keyboard} from './input/keyboard';
import {Touch} from './input/touch';
import {setupTouchGestures} from './input/gestures';
import {GameFullscreen} from './ui/fullscreen';
import {ControlSettings} from './ui/control-settings';
import {PerformanceMeasurement} from './ui/performance-measurement';
import {SaveStore,gameHash,validateFiles,type MountedFile} from './storage/saves';
import {readFiles,unzip,isGame,chooseGame,type GameImport} from './storage/import';
import {FileManager,download,sizeLabel} from './ui/file-manager';
import {SnapshotStore,resourceIdentity} from './storage/snapshots';
import {SnapshotManager,type SnapshotIdentity} from './ui/snapshot-manager';
import {setupSourceLink} from './source-link';
const contour='M47 5H79Q82 5 82 8V41Q82 44 85 44H118Q121 44 121 47V79Q121 82 118 82H85Q82 82 82 85V118Q82 121 79 121H47Q44 121 44 118V85Q44 82 41 82H8Q5 82 5 79V47Q5 44 8 44H41Q44 44 44 41V8Q44 5 47 5Z';
const dpadFace=`<svg class="dpad-face" viewBox="0 0 126 126" aria-hidden="true"><defs><linearGradient id="dpad-face" x2=".8" y2="1"><stop stop-color="#557564"/><stop offset="1" stop-color="#263e32"/></linearGradient><clipPath id="dpad-clip"><path d="${contour}"/></clipPath>${([['Up',50,12],['Right',88,50],['Down',50,88],['Left',12,50]] as const).map(([dir,x,y])=>`<radialGradient id="dpad-glow-${dir}" cx="${x}%" cy="${y}%" r="58%"><stop stop-color="#b5ffd1" stop-opacity=".9"/><stop offset=".45" stop-color="#8debb0" stop-opacity=".36"/><stop offset="1" stop-color="#8debb0" stop-opacity="0"/></radialGradient>`).join('')}</defs><path d="${contour}" transform="translate(0 3)" fill="#18291f"/><path d="${contour}" fill="url(#dpad-face)" stroke="#a9c7b377" stroke-width="1.5"/><g clip-path="url(#dpad-clip)">${['Up','Right','Down','Left'].map(dir=>`<rect class="dpad-light light-${dir}" width="126" height="126" fill="url(#dpad-glow-${dir})"/>`).join('')}</g></svg>`;
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<main><header><div class="header-main"><div class="header-brand"><span class="eyebrow">POWERED BY <a href="https://github.com/libretro/RetroArch" target="_blank" rel="noopener noreferrer">RETROARCH</a> &amp; <a href="https://github.com/AloysHF/DingooEmu" target="_blank" rel="noopener noreferrer">DINGOOEMU</a></span><h1>DingooEmu Web</h1></div><div class="header-controls"><div class="language-placeholder" role="group" aria-label="界面语言"><div class="language-options"><button data-language="zh-CN" class="selected" aria-pressed="true" lang="zh-CN">中文</button><button data-language="en" aria-pressed="false" lang="en">English</button><button data-language="ja" aria-pressed="false" lang="ja">日本語</button></div></div><div class="pwa-actions"><button id="pwa-install" title="添加到设备，像应用一样打开。" hidden>安装网页应用</button><button id="clear-site-cache" title="重新下载网站和运行资源，保留游戏、存档和设置。" disabled>更新网站</button><span id="pwa-status" role="status" aria-live="polite"></span><span id="cache-status" role="status" aria-live="polite"></span></div></div></div><p class="header-description">丁果游戏模拟器 · 可添加到桌面／主屏幕 · 离线运行 · 即时存档</p></header>
<section id="pwa-install-guide" class="pwa-install-guide" role="region" aria-label="安装网页应用" hidden><div data-install-guide="ios"><p>如果当前浏览器没有以下选项，请用 Safari 打开本站。</p><ol><li>点浏览器的“分享”按钮，选择“添加到主屏幕”。</li><li>如果出现“作为网页 App 打开”，保持开启，然后点“添加”。</li><li>从主屏幕上的 DingooEmu Web 图标打开，即可隐藏浏览器栏。</li></ol></div><div data-install-guide="mac" hidden><p>需要 macOS Sonoma 14 或更高版本。</p><ol><li>在 Safari 菜单栏选择“文件”→“添加到程序坞”，或在“共享”菜单中选择“添加到程序坞”。</li><li>确认名称后点“添加”。</li><li>从程序坞中的 DingooEmu Web 图标打开，即可在独立窗口中使用。</li></ol></div></section>
<section class="workspace"><div id="game-stage" class="game-stage"><div class="screen-wrap"><canvas id="canvas" width="320" height="240" tabindex="0" aria-label="A320 画面"></canvas><output id="fps" class="fps" aria-label="模拟帧率">FPS -</output></div>
<div id="touch" class="touch" hidden><button data-button="L" class="shoulder-left">L</button><button data-button="R" class="shoulder-right">R</button>
<div data-dpad class="dpad" role="group" aria-label="十字方向键，支持多方向与滑动">${dpadFace}${(['Up','Down','Left','Right'] as const).map(direction=>`<span class="dpad-arm" data-direction="${direction}" aria-hidden="true"></span>`).join('')}</div>
<div class="action-buttons">${(['X','Y','A','B'] as Button[]).map(b=>`<button data-button="${b}">${b}</button>`).join('')}</div>
<button data-button="Select" class="system-left">Select</button><button data-button="Start" class="system-right">Start</button></div>
<button id="control-settings-toggle" class="control-settings-toggle" aria-label="游戏设置" aria-expanded="false" aria-controls="control-settings">⚙</button>
<section id="control-settings" class="control-settings" data-control-settings aria-label="游戏设置"><div class="settings-heading"><strong>游戏设置</strong><button id="fullscreen" disabled>全屏</button><button id="close-control-settings" aria-label="关闭设置">×</button></div>
<div class="settings-switches"><label class="touch-setting"><input id="touch-enabled" type="checkbox" checked> 虚拟手柄</label>
<label class="fps-setting"><input id="fps-enabled" type="checkbox"> 显示 FPS</label><label class="mute-setting"><input id="audio-muted" type="checkbox"> 静音</label></div>
<div class="opacity-setting"><label for="touch-opacity">虚拟按键不透明度</label><input id="touch-opacity" type="range" min="0" max="100" step="5" value="100"><output id="touch-opacity-value" for="touch-opacity">100%</output><small>0% 外观不可见；关闭虚拟手柄可停用游戏触摸操作。</small></div>
<div class="opacity-setting"><label for="settings-opacity">设置按钮透明度</label><input id="settings-opacity" type="range" min="0" max="100" step="5" value="100"><output id="settings-opacity-value" for="settings-opacity">100%</output></div>
<div class="display-setting"><button id="display-options-toggle" aria-expanded="false" aria-controls="display-options">画面显示</button><span id="display-current">平滑显示</span><fieldset id="display-options" hidden><legend>显示模式</legend><label><input type="radio" name="display-mode" value="pixel"> 原始像素</label><small>保留清晰的像素边缘，画面等比铺满。</small><label><input type="radio" name="display-mode" value="smooth" checked> 平滑显示</label><small>柔化放大后的像素边缘，文字可能略模糊。</small><!-- Integer scaling temporarily disabled. <label><input type="radio" name="display-mode" value="integer"> 整数倍缩放</label><small>按屏幕像素整数倍显示，画面可能变小并留黑边；空间不足时等比缩小。</small> --></fieldset><small id="display-error" role="status" aria-live="polite"></small></div>
<div class="audio-recovery"><button id="audio-enable" hidden>启用声音</button><small id="audio-status" role="status"></small></div>
<div class="position-setting"><button id="edit-control-layout" aria-pressed="false">调整按键位置</button><button id="reset-control-layout">恢复默认位置</button><small id="layout-help">调整时拖动十字键、各按键或全屏设置按钮，完成后保存。</small></div></section>
<button id="exit-fullscreen" class="exit-fullscreen" hidden>退出全屏</button><span id="fullscreen-notice" class="fullscreen-notice" role="status"></span></div>
<p id="status" role="status"></p>
<div class="toolbar"><label class="file" title="支持 .app / .cc / .c2s / .c3s 和 ZIP 游戏包">导入游戏<input id="file" type="file"></label><!-- Folder import temporarily disabled. <label class="import-button">导入文件夹<input id="game-folder" type="file" webkitdirectory multiple></label> --><button id="run" disabled>继续</button><button id="reset" disabled>重置</button><button id="quick-save" disabled>即时存档</button><button id="quick-load" disabled>即时读档</button></div>
<div class="options"><span id="game-name"></span></div>
<div id="import-choice" class="import-choice" hidden><label for="import-game">选择包内的游戏</label><select id="import-game"></select><button id="import-open">载入</button><button id="import-cancel">取消</button></div>
<p id="snapshot-status" role="status" aria-live="polite"></p><p id="file-status" role="status" aria-live="polite"></p><details id="resources-details" hidden><summary>本次导入的资源</summary><p>资源随游戏保存在本机；添加或移除资源会重新载入游戏。</p><label class="import-button">添加资源<input id="resource-files" type="file" multiple></label><ul id="resource-list" class="managed-files"></ul></details>

</section><details id="file-manager"></details><details id="snapshot-manager"></details><details><summary>键盘映射</summary><p>点击按键后按新的物理键。重复绑定会交换两个按键。</p><div id="bindings" class="bindings"></div><button id="defaults">恢复默认</button></details>
<!-- Performance measurement UI temporarily disabled.
<details open><summary>运行测量</summary><pre id="metrics">等待首帧。</pre><pre id="audio-metrics"></pre>
<div class="measurement-tools"><label for="measure-note">设备 / 场景备注（可选）</label><input id="measure-note" maxlength="160"><label for="measure-mode">测量模式</label><select id="measure-mode"><option value="light">轻量：帧率和音频（推荐）</option><option value="full">详细：包含每帧核心耗时</option></select><div class="measurement-buttons"><button id="measure-start" disabled>测量 30 秒</button><button id="measure-stop" hidden>提前结束</button><button id="measure-copy" disabled>复制报告</button></div><p id="measure-status" role="status" aria-live="polite">进入卡顿场景后点击测量，期间可以正常操作游戏。</p><output id="measure-summary" hidden aria-label="测量摘要"></output><textarea id="measure-report" readonly hidden rows="16" aria-label="性能测量报告" spellcheck="false"></textarea></div></details>
-->
<section class="site-about" aria-label="关于本站"><div class="about-copy"><p>DingooEmu Web 在浏览器中运行丁果 A320（Dingoo A320）和歌美 A330（Gemei A330）掌机的原生游戏与应用。</p><p class="about-formats">支持导入 A320 的 .app 和 A330 的 .cc、.c2s、.c3s 文件，也支持 ZIP 游戏包。</p><p>本站采用独立的网页界面，通过 RetroArch 的 WebAssembly 运行环境调用 DingooEmu 模拟核心。</p></div><div class="about-devices"><figure><div class="device-photo device-photo--a320"><img src="${import.meta.env.BASE_URL}devices/dingoo-a320.png" width="1060" height="402" alt="丁果 A320 掌机" loading="lazy" decoding="async"></div><figcaption>Dingoo A320</figcaption></figure><figure><div class="device-photo device-photo--a330"><img src="${import.meta.env.BASE_URL}devices/gemei-a330-transparent.png" width="1774" height="887" alt="歌美 A330 掌机" loading="lazy" decoding="async"></div><figcaption>Gemei A330</figcaption></figure></div></section>
<footer class="site-footer"><div><span>模拟核心：</span><a href="https://github.com/AloysHF/DingooEmu" target="_blank" rel="noopener noreferrer">DingooEmu</a> · AloysHF · <a href="licenses.html#dingooemu">BSD 3-Clause</a></div><div><span>运行环境：</span><a href="https://github.com/libretro/RetroArch" target="_blank" rel="noopener noreferrer">RetroArch</a> · <a href="licenses.html#retroarch">GPL-3.0-or-later</a></div><nav class="footer-links" aria-label="项目链接"><a data-site-source hidden target="_blank" rel="noopener noreferrer">本站源码</a><a href="licenses.html">开源许可与第三方声明</a></nav><p>游戏由您从本机导入。游戏文件、游戏内存档与即时存档保存在当前浏览器中，可通过本站导出备份。</p></footer></main>`;
setupSourceLink(app);
setupLanguages(app);
setupTouchGestures(app);
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const pwa=setupPwa();
let preparingPwa=true;
get<HTMLInputElement>('file').disabled=true;
void pwa.ready.then(()=>{preparingPwa=false;enable();});
const status=get('status'), canvas=get<HTMLCanvasElement>('canvas'), client=new EmulatorClient(canvas);
let loaded=false, busy=false,clearingSiteData=false;
type Playback = 'empty' | 'running' | 'paused' | 'stopped' | 'error';
let playback:Playback='empty', statusRevision=0, visibilityPause=false;
const storagePrefix=`dingooemu-hybrid:${location.pathname.replace(/\/[^/]*$/, '/')}`;
const saveStore=new SaveStore(storagePrefix+'files');
const snapshotStore=new SnapshotStore(storagePrefix+'snapshots');
let activeGame:GameImport|undefined,pendingFiles:MountedFile[]|undefined;
let snapshotIdentity:SnapshotIdentity|undefined;
const fileManager=new FileManager(get<HTMLDetailsElement>('file-manager'),saveStore,{
  operate:action,currentHash:()=>client.fileIdentity,currentFiles:()=>client.currentFiles(),sync:()=>client.flushFiles(),
  play:async hash=>{const game=await saveStore.loadPackage(hash);if(!game)throw new Error(t("没有保存此游戏包，请重新导入游戏。"));pwa.gameStarted();await loadGame(game,false);},
  stop:async hash=>{
    if(hash!==client.fileIdentity)return;
    clearInput();await client.request('dispose');loaded=false;activeGame=undefined;get('game-name').textContent='';renderResources();
    setPlayback('stopped',t("游戏已停止，修改文件后可在“本站文件”点击“运行”。"));
  },
  clearAll:async()=>{
    const controls=[...app.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select')].map(node=>({node,disabled:node.disabled}));
    clearingSiteData=true;enable();
    try {
      await pwa.prepared;
      clearInput();keyboard.setBlocked(true);
      measurement?.cancel(t("游戏暂停、重置、切换或结束，测量提前结束"));
      await client.request('discard');
      loaded=false;activeGame=undefined;pendingFiles=undefined;snapshotIdentity=undefined;
      get('game-name').textContent='';renderResources();setPlayback('stopped','');
      await saveStore.close();await snapshotStore.close();
      await clearSiteData(storagePrefix,message=>setText(get('site-data-status'),message));
      await clearOfflineCache();
      setText(get('site-data-status'),t("本站所有数据已清除，正在刷新…"));
      reloadAfterCacheClear();
      // Keep operations disabled until navigation, so nothing recreates deleted data.
      await new Promise<void>(()=>{});
    } catch(error){
      clearingSiteData=false;keyboard.setBlocked(false);
      for(const {node,disabled} of controls)node.disabled=disabled;
      throw error;
    }
  },
});
const snapshotManager=new SnapshotManager(get<HTMLDetailsElement>('snapshot-manager'),snapshotStore,{
  operate:action,current:()=>loaded&&client.fileIdentity?snapshotIdentity:undefined,
  capture:async save=>{clearInput();measurement?.cancel(t("保存即时存档，测量已结束"));await client.captureSnapshot(save);},
  restore:async snapshot=>{clearInput();measurement?.cancel(t("读取即时存档，测量已结束"));await client.restoreSnapshot(snapshot);setPlayback('running',t("即时读档完成，游戏已继续运行。"));await fileManager.refresh(snapshot.meta.game);},
},get<HTMLButtonElement>('quick-save'),get<HTMLButtonElement>('quick-load'),get('snapshot-status'));
client.onFileStatus=(message,failed)=>{setText(get('file-status'),message);get('file-status').classList.toggle('file-error',failed);};
// Uncomment the measurement markup above to restore this controller.
const measurement=get('measure-start')?new PerformanceMeasurement(client,()=>loaded&&!busy&&playback==='running',()=>get('game-name').textContent||'',storagePrefix+'performance-report'):undefined;
const input=new InputState(update=>client.input(update));
const keyboard=new Keyboard(input,storagePrefix+'keys',renderBindings);
function renderBindings() {
  get('bindings').innerHTML=(Object.keys(buttons) as Button[]).map(b=>`<button data-bind="${b}"><strong>${b}</strong> ${keyboard.recordingButton===b?t("请按新键…（Esc 取消）"):keyboard.bindings[b]}</button>`).join('');
  localize(get('bindings'));
  get('bindings').querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button=>button.onclick=()=>keyboard.record(button.dataset.bind as Button));
}
renderBindings(); get('defaults').onclick=()=>keyboard.reset();
const touch=new Touch(get('touch'),input), touchToggle=get<HTMLInputElement>('touch-enabled');
try {const saved=localStorage.getItem(storagePrefix+'touch'); touchToggle.checked=saved===null?true:saved==='true';} catch {touchToggle.checked=true;}
function applyTouch() {touch.setEnabled(touchToggle.checked);get('game-stage').classList.toggle('with-touch',touchToggle.checked);}
applyTouch();
touchToggle.onchange=()=>{applyTouch();controls?.layoutChanged();try {localStorage.setItem(storagePrefix+'touch',String(touchToggle.checked));}catch{}};
const fpsToggle=get<HTMLInputElement>('fps-enabled'),opacity=get<HTMLInputElement>('touch-opacity'),settingsOpacity=get<HTMLInputElement>('settings-opacity');

try {
  fpsToggle.checked=localStorage.getItem(storagePrefix+'fps')!=='false';
  const saved=localStorage.getItem(storagePrefix+'opacity'),value=saved===null?100:Number(saved);
  if(Number.isFinite(value)&&value>=0&&value<=100)opacity.value=String(value);
  const settingsSaved=localStorage.getItem(storagePrefix+'settings-opacity'),settingsValue=settingsSaved===null?100:Number(settingsSaved);
  if(Number.isFinite(settingsValue)&&settingsValue>=0&&settingsValue<=100)settingsOpacity.value=String(settingsValue);
} catch {fpsToggle.checked=true;}
function renderFps() {get('fps').hidden=true;client.setFps(fpsToggle.checked);}
function applyOpacity() {
  get('game-stage').style.setProperty('--touch-opacity',String(Number(opacity.value)/100));
  get('touch-opacity-value').textContent=`${opacity.value}%`;
}
function applySettingsOpacity() {get('game-stage').style.setProperty('--settings-opacity',String(Number(settingsOpacity.value)/100));get('settings-opacity-value').textContent=`${settingsOpacity.value}%`;}
renderFps();applyOpacity();applySettingsOpacity();
fpsToggle.onchange=()=>{renderFps();try{localStorage.setItem(storagePrefix+'fps',String(fpsToggle.checked));}catch{}};
opacity.oninput=()=>{applyOpacity();try{localStorage.setItem(storagePrefix+'opacity',opacity.value);}catch{}};
settingsOpacity.oninput=()=>{applySettingsOpacity();try{localStorage.setItem(storagePrefix+'settings-opacity',settingsOpacity.value);}catch{}};
const muted=get<HTMLInputElement>('audio-muted');
try{muted.checked=localStorage.getItem(storagePrefix+'muted')==='true';}catch{}
client.setMuted(muted.checked);
muted.onchange=()=>{client.setMuted(muted.checked);try{localStorage.setItem(storagePrefix+'muted',String(muted.checked));}catch{}};
setText(get('audio-status'),t("导入游戏后显示实际音频驱动。"));
get('audio-enable').hidden=true;
let controls:ControlSettings|undefined;
function clearInput() {keyboard.clear();touch.clear();input.clearAll();controls?.cancelDrags();}
const fullscreen=new GameFullscreen(get('game-stage'),canvas,get<HTMLButtonElement>('exit-fullscreen'),get('fullscreen-notice'),clearInput,()=>{controls?.presentationChanged();enable();});
type DisplayMode='pixel'|'smooth'|'integer';
let displayMode:DisplayMode='smooth';
try {const saved=localStorage.getItem(storagePrefix+'display');if(saved==='pixel'||saved==='smooth')displayMode=saved;}catch{}
const displayLabels:Record<DisplayMode,string>={pixel:'原始像素',smooth:'平滑显示',integer:'整数倍缩放'};
function applyDisplay() {
  client.setVideoSmooth(displayMode==='smooth');
  canvas.style.imageRendering=displayMode==='smooth'?'auto':'pixelated';
  fullscreen.setIntegerScale(displayMode==='integer');
  setText(get('display-current'),t(displayLabels[displayMode]));
  get('display-options').querySelectorAll<HTMLInputElement>('input').forEach(radio=>radio.checked=radio.value===displayMode);
}
applyDisplay();
get('display-options-toggle').onclick=()=>{const toggle=get('display-options-toggle'),options=get('display-options');options.hidden=!options.hidden;toggle.setAttribute('aria-expanded',String(!options.hidden));};
get('display-options').querySelectorAll<HTMLInputElement>('input').forEach(radio=>radio.onchange=()=>{
  const previous=displayMode;clearInput();displayMode=radio.value as DisplayMode;
  try {applyDisplay();setText(get('display-error'),'');try{localStorage.setItem(storagePrefix+'display',displayMode);}catch{}}
  catch(error){displayMode=previous;applyDisplay();setText(get('display-error'),String(error));}
});
controls=new ControlSettings(get('game-stage'),get('control-settings'),get<HTMLButtonElement>('control-settings-toggle'),storagePrefix+'layout',value=>{clearInput();touch.setEditing(value);keyboard.setBlocked(value);});
get('fullscreen').onclick=()=>void(fullscreen.active?fullscreen.exit():fullscreen.enter());
function enable() {
  measurement?.refresh();
  get<HTMLButtonElement>('reset').disabled=!loaded||busy;
  get<HTMLButtonElement>('display-options-toggle').disabled=busy;
  get('display-options').querySelectorAll<HTMLInputElement>('input').forEach(radio=>radio.disabled=busy);
  const presentation=get<HTMLButtonElement>('fullscreen');setText(presentation,fullscreen.active?t("退出全屏"):t("全屏"));
  presentation.disabled=!fullscreen.active&&(!loaded||busy);
  const toggle=get<HTMLButtonElement>('run'); toggle.disabled=busy||!['running','paused'].includes(playback);
  setText(toggle,playback==='running'?t("暂停"):t("继续"));
  get<HTMLInputElement>('file').disabled=busy||preparingPwa;
  const folder=get<HTMLInputElement>('game-folder');if(folder)folder.disabled=busy||preparingPwa;
  for(const id of ['import-game','import-open','import-cancel'])get<HTMLButtonElement>(id).disabled=busy||preparingPwa;
  get<HTMLInputElement>('resource-files').disabled=busy||!loaded;
  get('resource-list').querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=busy||!loaded);
  fileManager.setEnabled(!busy&&!preparingPwa);
  snapshotManager.setEnabled(!busy&&!preparingPwa);
  if(clearingSiteData)for(const node of app.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select'))node.disabled=true;
}
function setPlayback(value:Playback,message:string) {playback=value;setText(status,message);renderFps();enable();}
async function start() {
  clearInput();const revision=statusRevision;await client.request('run');
  if(revision===statusRevision)setPlayback('running','');
}
async function pause(message='') {
  clearInput();const revision=statusRevision;
  try {await client.request('pause');} finally {if(revision===statusRevision)setPlayback('paused',message);}
}
async function action(job:()=>Promise<unknown>) {
  if(busy)return;busy=true;enable();
  try {await job();} catch(e) {setText(status,String(e));}
  finally {
    try {if(loaded&&playback==='running'&&(visibilityPause||document.hidden))await pause(t("页面隐藏，已暂停。"));}
    catch(e){setPlayback('error',String(e));}
    visibilityPause=false;busy=false;enable();
  }
}
async function loadGame(game:GameImport,persist=true) {
  clearInput();setText(status,t("正在读取游戏与本站文件…"));
  const bytes=new Uint8Array(await game.game.arrayBuffer());
  validateFiles([...game.resources,{path:game.name,bytes}]);
  const hash=await gameHash(bytes);
  const resources=await resourceIdentity(game);
  await client.flushFiles();
  if(persist)await saveStore.savePackage({hash,...game});
  const stored=await saveStore.load(hash);let revision=stored.record?.revision??0;
  if(!stored.record||stored.record.deleted){const record=await saveStore.replace(hash,game.name,stored.files,revision);revision=record.revision;}
  await client.load(bytes,game.name,game.resources,stored.files,async files=>{
    const record=await saveStore.replace(hash,game.name,files,revision);revision=record.revision;
    void fileManager.refresh().catch(()=>{});
  },hash);
  loaded=true;activeGame=game;snapshotIdentity={hash,name:game.name,resources};pendingFiles=undefined;get('import-choice').hidden=true;
  get('game-name').textContent=game.name;
  setText(get('file-status'),t("本站文件已载入 · {0} 个",stored.files.length));get('file-status').classList.remove('file-error');
  renderResources();void fileManager.refresh(hash).catch(()=>{});
  setPlayback('paused',document.hidden?t("已载入。页面隐藏，已暂停。"):t("已载入。"));
  if(!document.hidden&&!visibilityPause)await start();
}
async function importPackage(files:MountedFile[]) {
  validateFiles(files);const candidates=files.filter(file=>isGame(file.path));
  if(!candidates.length)throw new Error(t("未找到 .app / .cc / .c2s / .c3s 游戏。"));
  if(candidates.length===1){await loadGame(chooseGame(files,candidates[0].path));return;}
  pendingFiles=files;const choices=get<HTMLSelectElement>('import-game');choices.replaceChildren();
  for(const candidate of candidates)choices.add(new Option(candidate.path,candidate.path));
  get('import-choice').hidden=false;setText(status,t("导入包中有多个游戏，请选择要载入的游戏。"));
}
get<HTMLInputElement>('file').onchange=e=>{
  const chooser=e.target as HTMLInputElement,file=chooser.files?.[0];chooser.value='';if(!file)return;
  // iOS converts accept extensions to known system types and may exclude
  // raw Dingoo games. Keep the picker unfiltered; validate before persisting.
  void action(async()=>{
    if(!isGame(file.name)&&!/\.zip$/i.test(file.name))throw new Error(t("请选择 .app / .cc / .c2s / .c3s 或 ZIP 文件。"));
    if(file.size>128*1024*1024)throw new Error(t("游戏或 ZIP 超过 128 MiB。"));
    pwa.gameStarted();
    if(/\.zip$/i.test(file.name))await importPackage(await unzip(new Uint8Array(await file.arrayBuffer())));
    else await loadGame({name:file.name,game:file,resources:[]});
  });
};
const gameFolder=get<HTMLInputElement>('game-folder');
if(gameFolder)gameFolder.onchange=e=>{
  const chooser=e.target as HTMLInputElement,picked=Array.from(chooser.files||[]);chooser.value='';if(!picked.length)return;
  pwa.gameStarted();void action(async()=>importPackage(await readFiles(picked,true)));
};
get('import-open').onclick=()=>void action(async()=>{if(pendingFiles)await loadGame(chooseGame(pendingFiles,get<HTMLSelectElement>('import-game').value));});
get('import-cancel').onclick=()=>{pendingFiles=undefined;get('import-choice').hidden=true;setText(status,t("已取消导入。"));};
function renderResources() {
  const panel=get<HTMLDetailsElement>('resources-details'),list=get('resource-list');list.replaceChildren();panel.hidden=!activeGame;
  if(!activeGame)return;
  setText(panel.querySelector('summary')!,t("本次导入的资源 · {0} 个 · {1}",activeGame.resources.length,sizeLabel(activeGame.resources.reduce((n,f)=>n+f.bytes.length,0))));
  for(const file of activeGame.resources){
    const row=document.createElement('li'),name=document.createElement('span'),size=document.createElement('small'),save=document.createElement('button'),remove=document.createElement('button');
    name.textContent=file.path;size.textContent=sizeLabel(file.bytes.length);setText(save,t("导出"));setText(remove,t("移除并重载"));
    save.onclick=()=>download(file.path.split('/').pop()!,new Blob([new Uint8Array(file.bytes)]));
    remove.onclick=()=>void action(async()=>{if(activeGame&&confirm(t("移除 {0} 并重新载入游戏？",literal(file.path))))await loadGame({...activeGame,resources:activeGame.resources.filter(f=>f!==file)});});
    row.append(name,size,save,remove);list.append(row);
  }
}
get<HTMLInputElement>('resource-files').onchange=e=>{
  const chooser=e.target as HTMLInputElement,picked=Array.from(chooser.files||[]);chooser.value='';if(!picked.length||!activeGame)return;
  void action(async()=>{
    if(!activeGame)return;const incoming=await readFiles(picked),parent=activeGame.name.slice(0,activeGame.name.lastIndexOf('/')+1);
    for(const file of incoming)file.path=parent+file.path;
    if(incoming.some(f=>activeGame!.resources.some(old=>old.path===f.path))&&!confirm(t("覆盖同名资源并重新载入游戏？")))return;
    const merged=new Map(activeGame.resources.map(f=>[f.path,f]));for(const file of incoming)merged.set(file.path,file);
    await loadGame({...activeGame,resources:[...merged.values()]});
  });
};
get('run').onclick=()=>void action(async()=>{if(playback==='running')await pause();else if(playback==='paused'){await start();}});
get('reset').onclick=()=>void action(async()=>{clearInput();await client.request('reset');setPlayback('running','');});
client.onInfo=message=>{const metrics=get('metrics');if(metrics)setText(metrics,message);const audio=client.audioNotice;if(get('audio-status').textContent!==audio)setText(get('audio-status'),audio);};
client.onStatus=(state,error)=>{statusRevision++;clearInput();loaded=false;setPlayback(state==='stopped'?'stopped':'error',error||t("程序已结束。"));};
window.addEventListener('blur',clearInput);
window.addEventListener('pagehide',()=>{void client.flushFiles().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)measurement?.cancel(t("页面切到后台，测量提前结束"));
  if(document.hidden){clearInput();if(busy)visibilityPause=true;else if(loaded&&playback==='running')void action(()=>pause(t("页面隐藏，已暂停。")));}
});
enable();

setupSiteCache(pwa.prepared,async()=>{
  if(busy)throw new Error('operation in progress');
  busy=true;enable();
  try {
    if(loaded&&playback==='running')await pause();
    await client.flushFiles();
  } finally {busy=false;enable();}
});


onLanguageChange(()=>{renderBindings();enable();});
