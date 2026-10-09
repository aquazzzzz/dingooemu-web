import {t,literal} from '../i18n';
import {buttons, defaults, type Button, type InputUpdate} from '../input/state';
import {path, validateFiles, MAX_SAVE_BYTES, type MountedFile} from '../storage/saves';
import {stateLength,type Snapshot} from '../storage/snapshots';
import {displayShader,displayPreset} from './display-shader';

interface FileStream {node:{mode:number};flags:number}
interface FileSystem {
  mkdirTree(path:string):void;writeFile(path:string,data:string|Uint8Array):void;
  readFile(path:string):Uint8Array;readdir(path:string):string[];
  stat(path:string):{mode:number;size:number};isDir(mode:number):boolean;isFile(mode:number):boolean;
  getPath(node:FileStream['node']):string;close(stream:FileStream):void;
  unlink(path:string):void;
  rmdir(path:string):void;
}

interface Runtime {
  dingooWorkerWatch?():void;
  dingooWorkerStop?():void;
  dingooWorkerCall?(op:number,a?:number,b?:number):Promise<number>;
  _dingooemu_wasm_jit_abi?():number;
  _dingooemu_set_wasm_jit_enabled?(enabled:number):number;
  _dingooemu_wasm_jit_metric?(index:number):number;
  dingooWasmJitStats?():Record<string,unknown>;
  dingooWasmJitDispose?():void;
  FS:FileSystem;
  ENV: Record<string,string>;
  callMain(args:string[]):number|undefined;
  EmscriptenSendCommand(command:string):void;
  EmscriptenReceiveCommandReply():string|undefined;
  _cmd_quit?():void;
  _cmd_pause():void; _cmd_unpause():void; _cmd_reset():void;
  _cmd_set_display_shader?(path:number):number;
  _audio_driver_get_underruns?():number;
  _dingooemu_audio_queue_ms?():number;
  _audioworklet_queue_ms?():number;
  _audioworklet_base_latency_ms?():number;
  _audioworklet_output_latency_ms?():number;
  _dingooemu_measure_begin?():void;
  _dingooemu_measure_end?():void;
  _dingooemu_measure_get?(index:number):number;
  _dingooemu_flush_save_files?():number;
  HEAPU8:Uint8Array;_malloc(size:number):number;_free(ptr:number):void;
  _retro_serialize_size():number;_retro_serialize(ptr:number,size:number):number;_retro_unserialize(ptr:number,size:number):number;
  _dingooemu_state_present?():void;
  _cmd_finish_load_content_animation?():void;
}
type Factory = (options:Record<string,unknown>)=>Promise<Runtime>;
export interface AudioSnapshot {core:number|null;queue:number|null;base:number|null;output:number|null;underruns:number|null}
export interface FrameMeasurement {
  mode:'light'|'full';instructions:number;
  frames:number;tickMean:number;tickP50:number;tickP95:number;tickMax:number;
  videoMean:number;videoP95:number;audioMean:number;audioP95:number;
  intervalMean:number;intervalP95:number;intervalMax:number;overBudget:number;samples:number;truncated:boolean;runMean:number;
}
const corePath='/home/web_user/retroarch/cores/dingooemu_libretro.core';
const base='/home/web_user/retroarch';
const saveRoot=base+'/userdata/saves/';

// RetroArch owns rendering, pacing, input polling and audio on the selected
// thread. Core exports cross to its owner asynchronously in Worker mode.
export class EmulatorClient {
  private module?:Runtime;
  private coreWorker=false;
  private loadGeneration=0;
  private workerReason='';
  private runtimeCanvas?:HTMLCanvasElement;
  private canvasObserver?:ResizeObserver;
  private styleObserver?:MutationObserver;
  private telemetry=new Float64Array(40);
  private telemetryPending?:Promise<void>;
  private activeLatency=64;
  private jitEnabled=true;
  private jitApplicable=true;
  private jitKey=`dingooemu-hybrid:${location.pathname.replace(/\/[^/]*$/, '/')}wasm-jit`;
  private latencyKey=`dingooemu-hybrid:${location.pathname.replace(/\/[^/]*$/, '/')}audio-latency`;
  private async call(name:keyof Runtime,op:number,...args:number[]):Promise<number> {
    const runtime=this.module!;
    if(this.coreWorker){return runtime.dingooWorkerCall!(op,...args);}
    return (runtime[name] as (...args:number[])=>number)(...args);
  }
  private async refreshTelemetry(fresh=false,op=12) {
    if(this.telemetryPending){if(!fresh)return this.telemetryPending;await this.telemetryPending;}
    const runtime=this.module;if(!runtime)return;
    const work=(async()=>{
      if(this.coreWorker){
        const ptr=runtime._malloc(40*8);if(!ptr)throw new Error('Telemetry allocation failed');
        try {await runtime.dingooWorkerCall!(op,ptr);this.telemetry=new Float64Array(runtime.HEAPU8.buffer,ptr,40).slice();}
        finally {runtime._free(ptr);}
      }else{
        for(let i=0;i<19;i++)this.telemetry[i]=runtime._dingooemu_measure_get?.(i)??-1;
        this.telemetry.set([runtime._dingooemu_audio_queue_ms?.()??-1,runtime._audioworklet_queue_ms?.()??-1,runtime._audioworklet_base_latency_ms?.()??-1,runtime._audioworklet_output_latency_ms?.()??-1,runtime._audio_driver_get_underruns?.()??-1],19);
        for(let i=0;i<8;i++)this.telemetry[24+i]=runtime._dingooemu_wasm_jit_metric?.(i)??-1;
        const stats=runtime.dingooWasmJitStats?.();
        ['submitted','compiled','failed','discarded','requests','ready','sessions','generatedBytes'].forEach((key,i)=>this.telemetry[32+i]=Number(stats?.[key]??-1));
      }
    })();
    this.telemetryPending=work;
    try {await work;}finally{this.telemetryPending=undefined;}
  }
  private async workerSupported() {
    if(new URLSearchParams(location.search).get('worker')==='0'){this.workerReason=t("已选择主线程");return false;}
    if(this.audioDriver!=='audioworklet'||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||!HTMLCanvasElement.prototype.transferControlToOffscreen){this.workerReason=t("浏览器不支持核心 Worker 所需功能");return false;}
    // Test the actual worker WebGL context before transferring a game canvas.
    const url=URL.createObjectURL(new Blob([`onmessage=()=>{try{const c=new OffscreenCanvas(8,8);postMessage(!!c.getContext('webgl'));}catch{postMessage(false);}}`],{type:'text/javascript'}));
    let worker:Worker|undefined;
    try {return await new Promise<boolean>(resolve=>{
      const timer=setTimeout(()=>resolve(false),3000);
      worker=new Worker(url);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data===true);};worker.onerror=()=>{clearTimeout(timer);resolve(false);};worker.postMessage(null);
    });}catch{return false;}finally{worker?.terminate();URL.revokeObjectURL(url);this.workerReason=t("Worker 图形支持检测未通过");}
  }
  private prepareCanvas() {
    // Keep the page's layout/input anchor stable: a transferred canvas cannot be
    // reused after a quit or a failed Worker initialization.
    this.canvas.id='canvas-layout';this.canvas.style.opacity='0';
    const view=document.createElement('canvas');view.id='canvas';view.className='runtime-canvas';view.width=320;view.height=240;view.tabIndex=0;view.setAttribute('aria-label',this.canvas.getAttribute('aria-label')||'');
    this.canvas.after(view);this.runtimeCanvas=view;
    const resize=()=>{view.style.width=this.canvas.clientWidth+'px';view.style.height=this.canvas.clientHeight+'px';view.style.left=this.canvas.offsetLeft+'px';view.style.top=this.canvas.offsetTop+'px';view.style.imageRendering=this.canvas.style.imageRendering;};
    this.canvasObserver=new ResizeObserver(resize);this.canvasObserver.observe(this.canvas);this.canvasObserver.observe(this.canvas.parentElement!);
    this.styleObserver=new MutationObserver(resize);this.styleObserver.observe(this.canvas,{attributes:true,attributeFilter:['style']});resize();
    for(const type of ['keydown','keyup','keypress'])view.addEventListener(type,event=>{if(event.bubbles)event.stopImmediatePropagation();},true);
    return view;
  }
  get audioBuffer(){return this.audioLatency;}
  setAudioBuffer(value:number){if(![32,48,64,96,128].includes(value))throw new Error('Invalid audio buffer');this.audioLatency=value;try{localStorage.setItem(this.latencyKey,String(value));}catch{}}

  private sources=new Map<string,number>();
  private pulses=new Map<Button,ReturnType<typeof setTimeout>>();
  private heldMask=0;
  private sentMask=0;
  private poll?:ReturnType<typeof setInterval>;
  private exit?:()=>void;
  private stopping=false;
  private started=false;
  private failed?:Error;
  private loadedContent=false;
  private lastReply='';
  private lastQuery=0;
  private log:string[]=[];
  private muted=false;
  private fps=true;
  private smooth=true;
  private audioDriver:'audioworklet'|'rwebaudio'='rwebaudio';
  private audioLatency=64;
  private measurementMode:'light'|'full'='light';
  private measurementFrameStart=0;
  private measurementInstructionStart=0;
  private fileWriter?:((files:MountedFile[])=>Promise<void>);
  private fileHash?:string;
  get fileIdentity(){return this.module&&this.fileWriter?this.fileHash:undefined;}
  private fileRevision=0;
  private savedRevision=0;
  private fileTimer?:ReturnType<typeof setTimeout>;
  private openFileTimer?:ReturnType<typeof setInterval>;
  private fileQueue:Promise<void>=Promise.resolve();
  private paused=true;
  private stateBusy=false;
  onFileStatus:(message:string,failed:boolean)=>void=()=>{};
  onInfo:(message:string)=>void=()=>{};
  onStatus:(state:string,error?:string)=>void=()=>{};
  constructor(private canvas:HTMLCanvasElement) {
    const params=new URLSearchParams(location.search),queryJit=params.get('jit');
    try {this.jitEnabled=localStorage.getItem(this.jitKey)!=='false';}catch{}
    if(queryJit==='0'||queryJit==='1')this.jitEnabled=queryJit==='1';
    const latency=Number(params.get('latency'));
    if([32,48,64,96,128].includes(latency))this.audioLatency=latency;
    try {const saved=Number(localStorage.getItem(this.latencyKey));if(!new URLSearchParams(location.search).has('latency')&&[32,48,64,96,128].includes(saved))this.audioLatency=saved;}catch{}
    // Physical keys go through the custom Keyboard mapper first. Only the
    // non-bubbling events generated here reach RetroArch's canvas listeners.
    for(const type of ['keydown','keyup','keypress'])canvas.addEventListener(type,event=>{
      if(event.bubbles)event.stopImmediatePropagation();
    },true);
  }
  get jitChoice(){return this.jitEnabled;}
  get jitSwitchSupported(){return !this.started||this.jitApplicable;}
  get jitNotice() {
    if(!this.started)return t("Wasm JIT：{0} · 等待游戏",this.jitEnabled?t("已选择开启"):t("已选择关闭"));
    if(!this.jitApplicable)return t("Wasm JIT：当前 A330 游戏不适用");
    if(!this.jitEnabled)return t("Wasm JIT：已关闭 · 使用解释器");
    if(this.telemetry[24]!==1)return t("Wasm JIT：暂不可用 · 使用解释器");
    return this.telemetry[34]>0?t("Wasm JIT：已开启 · 部分代码使用解释器回退"):t("Wasm JIT：已开启");
  }
  async setJitEnabled(value:boolean) {
    if(value===this.jitEnabled)return;
    if(this.started&&this.module){
      if(!this.jitApplicable)throw new Error(t("Wasm JIT：当前 A330 游戏不适用"));
      if(!this.module._dingooemu_set_wasm_jit_enabled)throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
      if(await this.call('_dingooemu_set_wasm_jit_enabled',18,Number(value))!==1)throw new Error(t("无法切换 JIT，请重试。"));
    }
    this.jitEnabled=value;
    try {localStorage.setItem(this.jitKey,String(value));}catch{}
    const url=new URL(location.href);
    if(url.searchParams.has('jit')){url.searchParams.set('jit',value?'1':'0');history.replaceState(history.state,'',url);}
    if(this.started)await this.updateInfo();
  }
  setMuted(value:boolean) {
    if(value===this.muted)return;
    this.muted=value;
    if(this.started)this.module?.EmscriptenSendCommand('MUTE');
  }
  setFps(value:boolean) {
    if(value===this.fps)return;
    this.fps=value;
    if(this.started)this.module?.EmscriptenSendCommand('FPS_TOGGLE');
  }
  async setVideoSmooth(value:boolean) {
    if(value===this.smooth)return;
    if(this.started&&this.module){
      const runtime=this.module;
      if(!runtime._cmd_set_display_shader)throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
      const name=new TextEncoder().encode(base+'/display/'+(value?'smooth':'pixel')+'.glslp\0');
      const ptr=runtime._malloc(name.length);
      if(!ptr)throw new Error(t("无法切换画面显示，请重试。"));
      try {
        runtime.HEAPU8.set(name,ptr);
        if(!await this.call('_cmd_set_display_shader',4,ptr))throw new Error(t("无法切换画面显示，请重试。"));
      } finally {runtime._free(ptr);}
    }
    this.smooth=value;
  }
  get measurementSupported() {return Boolean(this.started&&this.module?._dingooemu_measure_begin&&this.module?._dingooemu_measure_end&&this.module?._dingooemu_measure_get);}
  async beginMeasurement(mode:'light'|'full'='light') {
    if(!this.measurementSupported)throw new Error(t("运行包需要更新：请关闭全部应用窗口，重新打开并导入游戏。"));
    await this.refreshTelemetry();
    if(this.telemetry[18]<2)throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
    this.measurementMode=mode;
    if(this.coreWorker)await this.refreshTelemetry(true,mode==='full'?15:16);
    else{await this.call(mode==='full'?'_dingooemu_measure_begin':'_dingooemu_measure_end',mode==='full'?10:11);await this.refreshTelemetry(true);}
    this.measurementFrameStart=this.telemetry[16];
    this.measurementInstructionStart=this.telemetry[17];
  }
  measurementFrames() {return (this.module?this.telemetry[16]:this.measurementFrameStart)-this.measurementFrameStart;}
  async endMeasurement():Promise<FrameMeasurement> {
    const runtime=this.module;
    if(!runtime?._dingooemu_measure_get||!runtime._dingooemu_measure_end)throw new Error(t("测量运行包不可用。"));
    if(this.coreWorker)await this.refreshTelemetry(true,16);
    else{await this.call('_dingooemu_measure_end',11);await this.refreshTelemetry(true);}
    const value=(index:number)=>this.telemetry[index];
    const frames=this.measurementFrames(),instructions=value(17)-this.measurementInstructionStart;
    if(this.measurementMode==='light')return {mode:'light',instructions,frames,tickMean:-1,tickP95:-1,tickMax:-1,videoMean:-1,audioMean:-1,intervalMean:-1,intervalP95:-1,intervalMax:-1,overBudget:-1,samples:0,truncated:false,tickP50:-1,videoP95:-1,audioP95:-1,runMean:-1};
    return {mode:'full',instructions,frames,tickMean:value(1),tickP95:value(2),tickMax:value(3),videoMean:value(4),audioMean:value(5),intervalMean:value(6),intervalP95:value(7),intervalMax:value(8),overBudget:value(9),samples:value(10),truncated:value(11)===1,tickP50:value(12),videoP95:value(13),audioP95:value(14),runMean:value(15)};
  }
  audioSnapshot():AudioSnapshot {
    const value=(index:number)=>{const result=this.telemetry[index];return !this.module||!Number.isFinite(result)||result<0?null:result;};
    return {core:value(19),queue:value(20),base:value(21),output:value(22),underruns:value(23)};
  }
  measurementEnvironment() {return {audioDriver:this.audioDriver,audioLatency:this.activeLatency,coreWorker:this.coreWorker,workerReason:this.coreWorker?'':this.workerReason,isolated:crossOriginIsolated,secure:isSecureContext,wasmJit:this.telemetry[24]===1};}
  get audioNotice() {
    const core=this.coreWorker?t("核心：Worker"):t("核心：主线程（{0}）",this.workerReason||t("等待载入"));
    if(this.audioDriver==='audioworklet')return t("AudioWorklet · 独立音频线程")+' · '+core;
    if(!isSecureContext)return t("当前为普通 HTTP，声音使用 RWebAudio；手机低延迟音频需要 HTTPS 和共享内存隔离响应头。")+' · '+core;
    if(!crossOriginIsolated)return t("当前未启用共享内存隔离，声音使用 RWebAudio；请检查页面上方的离线准备提示，结束游戏后再刷新重试。")+' · '+core;
    return t("当前声音使用 RWebAudio。")+' · '+core;
  }
  private configuration() {
    const settings:Record<string,string|boolean|number>={
      video_driver:'gl', audio_driver:this.audioDriver, input_driver:'rwebinput',
      menu_driver:'rgui', video_vsync:true, audio_latency:this.activeLatency,
      audio_threaded_pipeline:false, threaded_data_runloop_enable:false,
      video_smooth:this.smooth, video_font_path:'/font.ttf', video_font_size:16,
      video_shader_enable:true,video_shader:base+'/display/'+(this.smooth?'smooth':'pixel')+'.glslp',
      fps_show:this.fps, audio_mute_enable:this.muted, confirm_quit:false,
      menu_show_load_content_animation:true,
      menu_pause_libretro:true, pause_nonactive:false,
      config_save_on_exit:false, savestate_auto_save:false,
      savefile_directory:base+'/userdata/saves',
      sort_savefiles_enable:false,sort_savefiles_by_content_enable:false,savefiles_in_content_dir:false,
      savestate_directory:base+'/userdata/states',
      system_directory:base+'/userdata/system',
      assets_directory:base+'/bundle/assets',
      libretro_info_path:base+'/bundle/info',
      libretro_directory:base+'/cores', input_autodetect_enable:false,
      input_enable_hotkey:'nul', input_exit_emulator:'nul',
      input_menu_toggle:'nul', input_pause_toggle:'nul',
      input_reset:'nul', input_toggle_fullscreen:'nul',
    };
    const keys:Record<Button,string>={Up:'up',Down:'down',Left:'left',Right:'right',
      A:'x',B:'z',X:'s',Y:'a',L:'q',R:'w',Start:'enter',Select:'rshift'};
    for(const button of Object.keys(keys) as Button[])
      settings['input_player1_'+button.toLowerCase()]=keys[button];
    return Object.entries(settings).map(([key,value])=>`${key} = "${value}"`).join('\n')+'\n';
  }
  async load(bytes:Uint8Array,name:string,resources:MountedFile[]=[],saves:MountedFile[]=[],writer?:((files:MountedFile[])=>Promise<void>),hash?:string,forceMain=false):Promise<void> {
    name=path(name);
    if(!/\.(app|cc|c2s|c3s)$/i.test(name))throw new Error(t("请选择 .app / .cc / .c2s / .c3s 游戏。"));
    if(!bytes.length||bytes.length>128*1024*1024)throw new Error(t("游戏文件为空或超过 128 MiB。"));
    validateFiles(resources);validateFiles(saves);
    await this.dispose();
    this.jitApplicable=/\.app$/i.test(name);
    const generation=++this.loadGeneration;let initializing:Partial<Runtime>|undefined;
    this.failed=undefined;this.loadedContent=false;this.lastReply='';this.lastQuery=0;this.log=[];
    this.onInfo(t("正在初始化 RetroArch 后端…"));
    try {
      const AudioContextClass=window.AudioContext;
      this.audioDriver=new URLSearchParams(location.search).get('audio')!=='rwebaudio'
        &&crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined'
        &&AudioContextClass&&'audioWorklet' in AudioContextClass.prototype?'audioworklet':'rwebaudio';
      this.coreWorker=!forceMain&&await this.workerSupported();this.activeLatency=this.audioLatency;
      const runtimePath=this.coreWorker?'runtime/worker/':this.audioDriver==='audioworklet'?'runtime/audioworklet/':'runtime/';
      const url=new URL(import.meta.env.BASE_URL+runtimePath+'dingooemu_libretro.js',location.href).href;
      const factory=(await import(/* @vite-ignore */ url)).default as Factory;
      const capture=(value:unknown)=>{
        if(generation!==this.loadGeneration)return;
        const line=String(value);this.log.push(line);if(this.log.length>24)this.log.shift();
        if(line.includes('Loaded content:'))this.loadedContent=true;
        if(line.includes('Failed to load content:'))this.failed=new Error(line);
        console.info('[RetroArch]',line);
      };
      const loadAsset=async(name:string)=>{
        const response=await fetch(new URL(import.meta.env.BASE_URL+'runtime/'+name,location.href));
        if(!response.ok)throw new Error(t("无法加载运行资源：{0}",name));
        return new Uint8Array(await response.arrayBuffer());
      };
      const [fontBytes,iconBytes,coreInfoBytes]=await Promise.all([
        loadAsset('font.ttf'),loadAsset('retroarch.png'),loadAsset('dingooemu_libretro.info'),
      ]);
      const options:Record<string,unknown>={
        dingooWorkerError:(reason:string)=>{if(generation!==this.loadGeneration)return;this.failed=new Error(reason);if(this.loadedContent)this.onStatus('error',reason);},
        canvas:this.prepareCanvas(),noInitialRun:true,print:capture,printErr:capture,
        dingooWasmJitEnabled:this.jitEnabled,
        preRun:[(module:Runtime)=>{module.ENV.LIBRARY_PATH=corePath;}],
        onAbort:(reason:unknown)=>{if(generation!==this.loadGeneration)return;this.module?.dingooWasmJitDispose?.();this.failed=new Error(String(reason));this.onStatus('error',String(reason));},
        fullscreenEnter:()=>{},fullscreenExit:()=>{},
        retroArchExit:()=>{
          if(generation!==this.loadGeneration)return;
          this.module?.dingooWasmJitDispose?.();
          this.started=false;clearInterval(this.poll);clearInterval(this.openFileTimer);
          void this.flushFiles().catch(()=>{});
          if(!this.stopping)this.onStatus(this.failed?'error':'stopped',this.failed?.message);
          this.exit?.();this.exit=undefined;
        },
      };
      initializing=options as Partial<Runtime>;
      let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
      const task=factory(options);
      void task.then(runtime=>{if(cancelled)runtime.dingooWorkerStop?.();},()=>{});
      let runtime:Runtime;
      try {runtime=await Promise.race([task,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{cancelled=true;reject(new Error('Runtime initialization timed out'));},30000);})]);}
      finally{clearTimeout(timer);}
      this.module=runtime;runtime.dingooWorkerWatch?.();
      if(runtime._dingooemu_wasm_jit_abi?.()!==4||!runtime._dingooemu_set_wasm_jit_enabled)
        throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
      const fs=runtime.FS;
      fs.mkdirTree(base+'/display');
      fs.writeFile(base+'/display/display.glsl',displayShader);
      fs.writeFile(base+'/display/smooth.glslp',displayPreset(true));
      fs.writeFile(base+'/display/pixel.glslp',displayPreset(false));
      for(const directory of ['cores','userdata/content','userdata/saves','userdata/states','userdata/system'])
        fs.mkdirTree(base+'/'+directory);
      fs.writeFile('/font.ttf',fontBytes);fs.writeFile(corePath,new Uint8Array());
      fs.mkdirTree(base+'/bundle/assets/xmb/monochrome/png');
      fs.writeFile(base+'/bundle/assets/xmb/monochrome/png/retroarch.png',iconBytes);
      fs.mkdirTree(base+'/bundle/info');
      fs.writeFile(base+'/bundle/info/dingooemu_libretro.info',coreInfoBytes);
      const content=base+'/userdata/content/'+name;
      fs.mkdirTree(content.slice(0,content.lastIndexOf('/')));fs.writeFile(content,bytes);
      for(const file of resources){const dest=base+'/userdata/content/'+path(file.path);fs.mkdirTree(dest.slice(0,dest.lastIndexOf('/')));fs.writeFile(dest,file.bytes);}
      for(const file of saves){const dest=base+'/userdata/saves/'+path(file.path);fs.mkdirTree(dest.slice(0,dest.lastIndexOf('/')));fs.writeFile(dest,file.bytes);}
      if(writer&&!runtime._dingooemu_flush_save_files)throw new Error(t("运行包需要更新：请关闭全部应用窗口，重新打开后再导入游戏。"));
      this.fileWriter=writer;this.fileHash=hash;this.fileRevision=0;this.savedRevision=0;
      const close=fs.close;
      fs.close=(stream)=>{const name=fs.getPath(stream.node),writable=(stream.flags&3)!==0;close.call(fs,stream);if(writable&&name.startsWith(saveRoot)&&name!==saveRoot+'dingooemu-diagnostic.txt')this.markFilesDirty();};
      fs.writeFile(base+'/userdata/retroarch.cfg',this.configuration());
      this.started=true;
      const result=runtime.callMain(['-v',content,'-c',base+'/userdata/retroarch.cfg']);
      if(result!==undefined&&result!==0){this.started=false;throw new Error(t("{0}{1}",t("RetroArch 初始化失败。\n"),literal(this.log.slice(-6).join('\n'))));}
      const deadline=performance.now()+12000;
      while(!this.loadedContent&&!this.failed&&this.started&&performance.now()<deadline)
        await new Promise(resolve=>setTimeout(resolve,50));
      if(this.failed)throw this.failed;
      if(!this.loadedContent||!this.started)throw new Error(t("{0}{1}",t("RetroArch 未能启动游戏。\n"),literal(this.log.slice(-6).join('\n'))));
      // RetroArch ignores PAUSE until its first core iteration sets CORE_RUNNING.
      while(this.started&&!this.failed&&performance.now()<deadline){
        if(!this.coreWorker||runtime.dingooWorkerCall){
          try {await this.refreshTelemetry();if(this.telemetry[16]>0)break;}catch{/* pthread startup */}
        }
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      if(this.failed)throw this.failed;
      if(!this.started||this.telemetry[16]<=0)throw new Error(t("RetroArch 尚未开始运行，未进入可保存状态。"));
      await this.call('_cmd_pause',1);
      this.paused=true;
      if(this.jitApplicable&&await this.call('_dingooemu_set_wasm_jit_enabled',18,Number(this.jitEnabled))!==1)throw new Error(t("无法切换 JIT，请重试。"));
      if(writer)this.openFileTimer=setInterval(()=>void this.flushFiles().catch(()=>{}),5000);
      this.poll=setInterval(()=>void this.updateInfo().catch(error=>this.onStatus('error',String(error))),250);
      await this.updateInfo();
    } catch(error) {
      const retry=this.coreWorker&&!forceMain;
      if(retry){
        ++this.loadGeneration;initializing?.dingooWorkerStop?.();
        // Startup failure: no user progress has been accepted yet. Release the
        // transferred canvas/threads and retry using the existing main path.
        clearInterval(this.poll);clearInterval(this.openFileTimer);clearTimeout(this.fileTimer);
        this.module?.dingooWorkerStop?.();this.started=false;this.fileWriter=undefined;
      }
      try{await this.dispose();}catch{}
      if(retry){this.workerReason=t("Worker 初始化失败，已回退主线程");return this.load(bytes,name,resources,saves,writer,hash,true);}
      this.onStatus('error',String(error));throw error;
    }
  }
  private markFilesDirty() {
    if(this.stateBusy)return;
    this.fileRevision++;
    if(!this.fileWriter)return;
    clearTimeout(this.fileTimer);
    this.fileTimer=setTimeout(()=>void this.flushFiles().catch(()=>{}),0);
  }
  async currentFiles():Promise<MountedFile[]> {
    const runtime=this.module;if(!runtime)return [];
    if(this.started&&await this.call('_dingooemu_flush_save_files',8)!==1)throw new Error(t("游戏文件写入失败，当前会话已保留，请重试。"));
    const fs=runtime.FS,files:MountedFile[]=[];let total=0;
    const walk=(dir:string)=>{
      for(const name of fs.readdir(dir)){
        if(name==='.'||name==='..')continue;
        if(dir===saveRoot.slice(0,-1)&&name==='dingooemu-diagnostic.txt')continue;
        const full=dir+'/'+name,stat=fs.stat(full);
        if(fs.isDir(stat.mode))walk(full);
        else if(fs.isFile(stat.mode)){
          total+=stat.size;
          if(total>MAX_SAVE_BYTES||files.length>=2048)throw new Error(t("游戏文件超过 64 MiB 或 2048 个，当前会话已保留。"));
          files.push({path:path(full.slice(saveRoot.length)),bytes:new Uint8Array(fs.readFile(full))});
        }
      }
    };
    walk(saveRoot.slice(0,-1));return files.sort((a,b)=>a.path.localeCompare(b.path));
  }
  flushFiles():Promise<void> {
    const work=this.fileQueue.catch(()=>{}).then(()=>this.flushFilesNow());
    this.fileQueue=work;return work;
  }
  private async flushFilesNow() {
    if(this.stateBusy||!this.fileWriter||!this.module)return;
    try {
      // Flush buffered guest writes even when no host file has closed yet.
      if(this.started&&await this.call('_dingooemu_flush_save_files',8)!==1)throw new Error(t("游戏文件写入失败。"));
      if(this.fileRevision===this.savedRevision)return;
      const revision=this.fileRevision,files=await this.currentFiles();
      this.onFileStatus(t("正在保存游戏文件…"),false);
      await this.fileWriter(files);
      this.savedRevision=revision;this.onFileStatus(t("游戏文件已保存 · {0} 个",files.length),false);
    } catch(error){this.onFileStatus(t("保存失败：{0} 可重试保存或导出当前文件。",String(error)),true);throw error;}
  }
  private async captureState():Promise<Uint8Array> {
    const runtime=this.module;if(!runtime||!this.started||!runtime._retro_serialize_size)throw new Error(t("请先载入游戏，并更新运行包。"));
    const capacity=await this.call('_retro_serialize_size',5);if(![48*1024*1024,128*1024*1024].includes(capacity))throw new Error(t("即时存档容量无效。"));
    const ptr=runtime._malloc(capacity);if(!ptr)throw new Error(t("内存不足，无法保存即时存档。"));
    try {if(!await this.call('_retro_serialize',6,ptr,capacity))throw new Error(t("核心保存即时存档失败，当前进度已保留。"));
      const view=runtime.HEAPU8.subarray(ptr,ptr+capacity);return new Uint8Array(view.subarray(0,stateLength(view)));
    } finally {runtime._free(ptr);}
  }
  private async restoreState(state:Uint8Array) {
    const runtime=this.module!,capacity=await this.call('_retro_serialize_size',5);stateLength(state);
    if(state.length>capacity)throw new Error(t("即时存档平台不匹配。"));
    const ptr=runtime._malloc(state.length);if(!ptr)throw new Error(t("内存不足，无法读取即时存档。"));
    try {runtime.HEAPU8.set(state,ptr);
      if(!await this.call('_retro_unserialize',7,ptr,state.length))throw new Error(t("核心拒绝此即时存档，当前进度已保留。"));
    } finally {runtime._free(ptr);}
  }
  async captureSnapshot<T>(save:(state:Uint8Array,files:MountedFile[],frames:number)=>Promise<T>):Promise<T> {
    if(!this.started||!this.module)throw new Error(t("请先运行游戏。"));
    const runtime=this.module,wasPaused=this.paused;await this.call('_cmd_pause',1);this.paused=true;
    try {await this.flushFiles();this.stateBusy=true;
      await this.refreshTelemetry();
      return await save(await this.captureState(),await this.currentFiles(),this.telemetry[16]);
    } finally {this.stateBusy=false;if(!wasPaused){await this.call('_cmd_unpause',2);this.paused=false;}}
  }
  private replaceFiles(files:MountedFile[]) {
    const fs=this.module!.FS;
    const remove=(dir:string)=>{for(const name of fs.readdir(dir)){if(name==='.'||name==='..'||(dir===saveRoot.slice(0,-1)&&name==='dingooemu-diagnostic.txt'))continue;const full=dir+'/'+name;if(fs.isDir(fs.stat(full).mode)){remove(full);fs.rmdir(full);}else fs.unlink(full);}};
    remove(saveRoot.slice(0,-1));
    for(const file of files){const dest=saveRoot+path(file.path);fs.mkdirTree(dest.slice(0,dest.lastIndexOf('/')));fs.writeFile(dest,file.bytes);}
  }
  async restoreSnapshot(snapshot:Snapshot) {
    if(!this.module||!this.started||!this.fileWriter)throw new Error(t("请先运行匹配的游戏。"));
    validateFiles(snapshot.files,MAX_SAVE_BYTES);
    const runtime=this.module,wasPaused=this.paused;await this.call('_cmd_pause',1);this.paused=true;
    let previousState:Uint8Array|undefined,previousFiles:MountedFile[]|undefined,coreChanged=false,filesChanged=false;
    try {
      await this.flushFiles();this.stateBusy=true;
      previousFiles=await this.currentFiles();previousState=await this.captureState();
      filesChanged=true;this.replaceFiles(snapshot.files);
      await this.restoreState(snapshot.state);coreChanged=true;
      // One revision-checked transaction commits the restored writable files.
      await this.fileWriter(snapshot.files);this.fileRevision++;this.savedRevision=this.fileRevision;
      if(this.coreWorker)await runtime.dingooWorkerCall!(9);else{runtime._cmd_finish_load_content_animation?.();runtime._dingooemu_state_present?.();}this.onFileStatus(t("读档文件已保存 · {0} 个",snapshot.files.length),false);
      await this.call('_cmd_unpause',2);this.paused=false;
    } catch(error) {
      try {if(filesChanged&&previousFiles)this.replaceFiles(previousFiles);if(coreChanged&&previousState)await this.restoreState(previousState);}
      catch(rollback){throw new Error(t("读档失败且回退失败：{0}。请导出当前文件后重新载入。",String(rollback)));}
      if(!wasPaused){await this.call('_cmd_unpause',2);this.paused=false;}throw error;
    } finally {this.stateBusy=false;}
  }
  private async updateInfo() {
    const runtime=this.module;if(!runtime||!this.started)return;
    await this.refreshTelemetry();
    let reply:string|undefined;
    while((reply=runtime.EmscriptenReceiveCommandReply())!==undefined)
      if(reply.startsWith('GET_STATUS'))this.lastReply=reply.trim();
    if(performance.now()-this.lastQuery>=1000){runtime.EmscriptenSendCommand('GET_STATUS');this.lastQuery=performance.now();}
    const audio=this.audioDriver==='audioworklet'?t("AudioWorklet · 独立音频线程"):'RWebAudio';
    const underruns=this.telemetry[23]>=0?this.telemetry[23]:undefined;
    const ms=(value:number|undefined)=>value===undefined||value<0?t("未提供"):value.toFixed(1)+' ms';
    const latency=this.audioDriver==='audioworklet'?t("\n核心积压：{0} · 输出队列：{1}\n浏览器处理：{2} · 设备输出估计：{3}",ms(this.telemetry[19]),ms(this.telemetry[20]),ms(this.telemetry[21]),ms(this.telemetry[22])):'';
    const jit=this.telemetry[24]===1?'\n'+t("Wasm JIT 实验：A320 整数代码块 · {0} 已编译 · {1} 次执行",this.telemetry[26],this.telemetry[27]):'';
    this.onInfo(t("后端：RetroArch + DingooEmu Libretro\n编译：wasm32-unknown-emscripten · {0}\n音频缓冲目标：{1} ms{2}{3}\n{4}\n输入：0x{5}\nFPS 由 RetroArch 在画面内显示。",audio+' · '+(this.coreWorker?t("核心：Worker"):t("核心：主线程（{0}）",this.workerReason)),this.activeLatency,underruns===undefined?'':t(" · 缺样计数：{0}",underruns),latency,this.lastReply||t("游戏已加载。"),this.sentMask.toString(16))+jit);
  }
  async request(command:'run'|'pause'|'reset'|'dispose'|'discard') {
    // Full site reset deliberately discards files; prevent timers and pagehide
    // from writing them back while disposal waits for the backend to quit.
    if(command==='discard'){this.fileWriter=undefined;await this.dispose();return;}
    if(command==='dispose'){await this.dispose();return;}
    if(!this.module||!this.started)throw new Error(t("游戏未启动，请重新导入。"));
    if(command==='run'){await this.call('_cmd_unpause',2);this.paused=false;}
    if(command==='pause'){await this.call('_cmd_pause',1);this.paused=true;await this.flushFiles();}
    if(command==='reset'){
      const wasPaused=this.paused;await this.call('_cmd_pause',1);
      try {await this.flushFiles();await this.call('_cmd_reset',3);await this.flushFiles();await this.call('_cmd_unpause',2);this.paused=false;}
      catch(error){if(!wasPaused)await this.call('_cmd_unpause',2);throw error;}
    }
  }
  input(update:InputUpdate) {
    const {source,buttons:mask,cancel}=update;
    if(source==='*')this.sources.clear();
    else if(source.endsWith('*')){for(const key of this.sources.keys())if(key.startsWith(source.slice(0,-1)))this.sources.delete(key);}
    else if(mask)this.sources.set(source,mask);else this.sources.delete(source);
    const held=[...this.sources.values()].reduce((a,b)=>a|b,0)>>>0;
    for(const button of Object.keys(buttons) as Button[]) {
      const bit=buttons[button];
      if(cancel&&!(held&bit)){clearTimeout(this.pulses.get(button));this.pulses.delete(button);}
      else if((held&bit)&&!(this.heldMask&bit)) {
        clearTimeout(this.pulses.get(button));
        this.pulses.set(button,setTimeout(()=>{this.pulses.delete(button);this.sendInput();},100));
      }
    }
    this.heldMask=held;this.sendInput();
  }
  private sendInput() {
    let mask=this.heldMask;for(const button of this.pulses.keys())mask|=buttons[button];
    mask>>>=0;
    if(!this.started){this.sentMask=0;return;}
    for(const button of Object.keys(buttons) as Button[]) {
      const bit=buttons[button];if((mask&bit)===(this.sentMask&bit))continue;
      const code=defaults[button];
      (this.runtimeCanvas||this.canvas).dispatchEvent(new KeyboardEvent(mask&bit?'keydown':'keyup',{
        code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code,bubbles:false,cancelable:true,
      }));
    }
    this.sentMask=mask;
  }
  private async dispose() {
    this.input({source:'*',buttons:0,cancel:true});
    if(this.module&&this.started){
      await this.call('_cmd_pause',1);
      try {await this.flushFiles();} catch(error){if(!this.paused)await this.call('_cmd_unpause',2);throw error;}
    }
    clearInterval(this.poll);clearInterval(this.openFileTimer);clearTimeout(this.fileTimer);
    if(this.module&&this.started){
      this.stopping=true;
      try {
        await new Promise<void>((resolve,reject)=>{
          const timer=setTimeout(()=>{this.exit=undefined;reject(new Error(t("旧的 RetroArch 后端未退出，请刷新页面后重试。")));},5000);
          this.exit=()=>{clearTimeout(timer);resolve();};
          // Resume the fallback driver's audio wait, then set shutdown on the
          // owner thread. A one-frame command hotkey can be missed during load.
          if(!this.coreWorker)this.module!._cmd_unpause();
          if(this.module!._cmd_quit)void this.call('_cmd_quit',17).catch(error=>{clearTimeout(timer);this.exit=undefined;reject(error);});
          else this.module!.EmscriptenSendCommand('QUIT');
        });
      } finally {this.stopping=false;}
    }
    await this.flushFiles();
    this.module?.dingooWasmJitDispose?.();
    this.module?.dingooWorkerStop?.();
    await this.telemetryPending?.catch(()=>{});
    this.canvasObserver?.disconnect();this.styleObserver?.disconnect();this.runtimeCanvas?.remove();this.runtimeCanvas=undefined;
    this.canvas.id='canvas';this.canvas.style.opacity='';
    this.telemetry=new Float64Array(40);this.coreWorker=false;
    this.fileWriter=undefined;
    this.module=undefined;this.started=false;
  }
}
