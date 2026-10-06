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
  FS:FileSystem;
  ENV: Record<string,string>;
  callMain(args:string[]):number|undefined;
  EmscriptenSendCommand(command:string):void;
  EmscriptenReceiveCommandReply():string|undefined;
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

// The original RetroArch module owns rendering, pacing, input polling and audio.
// The page sends control changes only; it does not copy framebuffers or PCM.
export class EmulatorClient {
  private module?:Runtime;
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
  private audioLatency=32;
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
    const latency=Number(new URLSearchParams(location.search).get('latency'));
    if([32,48,64].includes(latency))this.audioLatency=latency;
    // Physical keys go through the custom Keyboard mapper first. Only the
    // non-bubbling events generated here reach RetroArch's canvas listeners.
    for(const type of ['keydown','keyup','keypress'])canvas.addEventListener(type,event=>{
      if(event.bubbles)event.stopImmediatePropagation();
    },true);
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
  setVideoSmooth(value:boolean) {
    if(value===this.smooth)return;
    if(this.started&&this.module){
      const runtime=this.module;
      if(!runtime._cmd_set_display_shader)throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
      const name=new TextEncoder().encode(base+'/display/'+(value?'smooth':'pixel')+'.glslp\0');
      const ptr=runtime._malloc(name.length);
      if(!ptr)throw new Error(t("无法切换画面显示，请重试。"));
      try {
        runtime.HEAPU8.set(name,ptr);
        if(!runtime._cmd_set_display_shader(ptr))throw new Error(t("无法切换画面显示，请重试。"));
      } finally {runtime._free(ptr);}
    }
    this.smooth=value;
  }
  get measurementSupported() {return Boolean(this.started&&this.module?._dingooemu_measure_begin&&this.module?._dingooemu_measure_end&&this.module?._dingooemu_measure_get);}
  beginMeasurement(mode:'light'|'full'='light') {
    if(!this.measurementSupported)throw new Error(t("运行包需要更新：请关闭全部应用窗口，重新打开并导入游戏。"));
    if(this.module!._dingooemu_measure_get!(18)<2)throw new Error(t("运行包需要更新，请刷新网页后重新导入游戏。"));
    this.measurementMode=mode;
    this.measurementFrameStart=this.module!._dingooemu_measure_get!(16);
    this.measurementInstructionStart=this.module!._dingooemu_measure_get!(17);
    if(mode==='full')this.module!._dingooemu_measure_begin!();
    else this.module!._dingooemu_measure_end!();
  }
  measurementFrames() {return (this.module?._dingooemu_measure_get?.(16)??this.measurementFrameStart)-this.measurementFrameStart;}
  endMeasurement():FrameMeasurement {
    const runtime=this.module;
    if(!runtime?._dingooemu_measure_get||!runtime._dingooemu_measure_end)throw new Error(t("测量运行包不可用。"));
    runtime._dingooemu_measure_end();
    const value=(index:number)=>runtime._dingooemu_measure_get!(index);
    const frames=this.measurementFrames(),instructions=value(17)-this.measurementInstructionStart;
    if(this.measurementMode==='light')return {mode:'light',instructions,frames,tickMean:-1,tickP95:-1,tickMax:-1,videoMean:-1,audioMean:-1,intervalMean:-1,intervalP95:-1,intervalMax:-1,overBudget:-1,samples:0,truncated:false,tickP50:-1,videoP95:-1,audioP95:-1,runMean:-1};
    return {mode:'full',instructions,frames,tickMean:value(1),tickP95:value(2),tickMax:value(3),videoMean:value(4),audioMean:value(5),intervalMean:value(6),intervalP95:value(7),intervalMax:value(8),overBudget:value(9),samples:value(10),truncated:value(11)===1,tickP50:value(12),videoP95:value(13),audioP95:value(14),runMean:value(15)};
  }
  audioSnapshot():AudioSnapshot {
    const value=(get:(()=>number)|undefined)=>{const result=get?.();return result===undefined||!Number.isFinite(result)||result<0?null:result;};
    return {core:value(this.module?._dingooemu_audio_queue_ms),queue:value(this.module?._audioworklet_queue_ms),base:value(this.module?._audioworklet_base_latency_ms),output:value(this.module?._audioworklet_output_latency_ms),underruns:value(this.module?._audio_driver_get_underruns)};
  }
  measurementEnvironment() {return {audioDriver:this.audioDriver,audioLatency:this.audioLatency,isolated:crossOriginIsolated,secure:isSecureContext};}
  get audioNotice() {
    if(this.audioDriver==='audioworklet')return t("AudioWorklet · 独立音频线程");
    if(!isSecureContext)return t("当前为普通 HTTP，声音使用 RWebAudio；手机低延迟音频需要 HTTPS 和共享内存隔离响应头。");
    if(!crossOriginIsolated)return t("当前未启用共享内存隔离，声音使用 RWebAudio；请检查页面上方的离线准备提示，结束游戏后再刷新重试。");
    return t("当前声音使用 RWebAudio。");
  }
  private configuration() {
    const settings:Record<string,string|boolean|number>={
      video_driver:'gl', audio_driver:this.audioDriver, input_driver:'rwebinput',
      menu_driver:'rgui', video_vsync:true, audio_latency:this.audioLatency,
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
  async load(bytes:Uint8Array,name:string,resources:MountedFile[]=[],saves:MountedFile[]=[],writer?:((files:MountedFile[])=>Promise<void>),hash?:string) {
    name=path(name);
    if(!/\.(app|cc|c2s|c3s)$/i.test(name))throw new Error(t("请选择 .app / .cc / .c2s / .c3s 游戏。"));
    if(!bytes.length||bytes.length>128*1024*1024)throw new Error(t("游戏文件为空或超过 128 MiB。"));
    validateFiles(resources);validateFiles(saves);
    await this.dispose();
    this.failed=undefined;this.loadedContent=false;this.lastReply='';this.lastQuery=0;this.log=[];
    this.onInfo(t("正在初始化 RetroArch 后端…"));
    try {
      const AudioContextClass=window.AudioContext;
      this.audioDriver=new URLSearchParams(location.search).get('audio')!=='rwebaudio'
        &&crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined'
        &&AudioContextClass&&'audioWorklet' in AudioContextClass.prototype?'audioworklet':'rwebaudio';
      const runtimePath=this.audioDriver==='audioworklet'?'runtime/audioworklet/':'runtime/';
      const url=new URL(import.meta.env.BASE_URL+runtimePath+'dingooemu_libretro.js',location.href).href;
      const factory=(await import(/* @vite-ignore */ url)).default as Factory;
      const capture=(value:unknown)=>{
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
      const runtime=await factory({
        canvas:this.canvas,noInitialRun:true,print:capture,printErr:capture,
        preRun:[(module:Runtime)=>{module.ENV.LIBRARY_PATH=corePath;}],
        onAbort:(reason:unknown)=>{this.failed=new Error(String(reason));this.onStatus('error',String(reason));},
        fullscreenEnter:()=>{},fullscreenExit:()=>{},
        retroArchExit:()=>{
          this.started=false;clearInterval(this.poll);clearInterval(this.openFileTimer);
          void this.flushFiles().catch(()=>{});
          if(!this.stopping)this.onStatus(this.failed?'error':'stopped',this.failed?.message);
          this.exit?.();this.exit=undefined;
        },
      });
      this.module=runtime;
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
      while(this.started&&!this.failed&&runtime._dingooemu_measure_get?.(16)===0&&performance.now()<deadline)
        await new Promise(resolve=>setTimeout(resolve,10));
      if(this.failed)throw this.failed;
      if(!this.started||runtime._dingooemu_measure_get?.(16)===0)throw new Error(t("RetroArch 尚未开始运行，未进入可保存状态。"));
      runtime._cmd_pause();
      this.paused=true;
      if(writer)this.openFileTimer=setInterval(()=>void this.flushFiles().catch(()=>{}),5000);
      this.poll=setInterval(()=>this.updateInfo(),250);
      this.updateInfo();
    } catch(error) {
      try{await this.dispose();}catch{}this.onStatus('error',String(error));throw error;
    }
  }
  private markFilesDirty() {
    if(this.stateBusy)return;
    this.fileRevision++;
    if(!this.fileWriter)return;
    clearTimeout(this.fileTimer);
    this.fileTimer=setTimeout(()=>void this.flushFiles().catch(()=>{}),0);
  }
  currentFiles():MountedFile[] {
    const runtime=this.module;if(!runtime)return [];
    if(this.started&&runtime._dingooemu_flush_save_files?.()!==1)throw new Error(t("游戏文件写入失败，当前会话已保留，请重试。"));
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
      if(this.started&&this.module._dingooemu_flush_save_files?.()!==1)throw new Error(t("游戏文件写入失败。"));
      if(this.fileRevision===this.savedRevision)return;
      const revision=this.fileRevision,files=this.currentFiles();
      this.onFileStatus(t("正在保存游戏文件…"),false);
      await this.fileWriter(files);
      this.savedRevision=revision;this.onFileStatus(t("游戏文件已保存 · {0} 个",files.length),false);
    } catch(error){this.onFileStatus(t("保存失败：{0} 可重试保存或导出当前文件。",String(error)),true);throw error;}
  }
  private captureState():Uint8Array {
    const runtime=this.module;if(!runtime||!this.started||!runtime._retro_serialize_size)throw new Error(t("请先载入游戏，并更新运行包。"));
    const capacity=runtime._retro_serialize_size();if(![48*1024*1024,128*1024*1024].includes(capacity))throw new Error(t("即时存档容量无效。"));
    const ptr=runtime._malloc(capacity);if(!ptr)throw new Error(t("内存不足，无法保存即时存档。"));
    try {if(!runtime._retro_serialize(ptr,capacity))throw new Error(t("核心保存即时存档失败，当前进度已保留。"));
      const view=runtime.HEAPU8.subarray(ptr,ptr+capacity);return new Uint8Array(view.subarray(0,stateLength(view)));
    } finally {runtime._free(ptr);}
  }
  private restoreState(state:Uint8Array) {
    const runtime=this.module!,capacity=runtime._retro_serialize_size();stateLength(state);
    if(state.length>capacity)throw new Error(t("即时存档平台不匹配。"));
    const ptr=runtime._malloc(state.length);if(!ptr)throw new Error(t("内存不足，无法读取即时存档。"));
    try {runtime.HEAPU8.set(state,ptr);
      if(!runtime._retro_unserialize(ptr,state.length))throw new Error(t("核心拒绝此即时存档，当前进度已保留。"));
    } finally {runtime._free(ptr);}
  }
  async captureSnapshot<T>(save:(state:Uint8Array,files:MountedFile[],frames:number)=>Promise<T>):Promise<T> {
    if(!this.started||!this.module)throw new Error(t("请先运行游戏。"));
    const runtime=this.module,wasPaused=this.paused;runtime._cmd_pause();this.paused=true;
    try {await this.flushFiles();this.stateBusy=true;
      return await save(this.captureState(),this.currentFiles(),runtime._dingooemu_measure_get?.(16)??0);
    } finally {this.stateBusy=false;if(!wasPaused){runtime._cmd_unpause();this.paused=false;}}
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
    const runtime=this.module,wasPaused=this.paused;runtime._cmd_pause();this.paused=true;
    let previousState:Uint8Array|undefined,previousFiles:MountedFile[]|undefined,coreChanged=false,filesChanged=false;
    try {
      await this.flushFiles();this.stateBusy=true;
      previousFiles=this.currentFiles();previousState=this.captureState();
      filesChanged=true;this.replaceFiles(snapshot.files);
      this.restoreState(snapshot.state);coreChanged=true;
      // One revision-checked transaction commits the restored writable files.
      await this.fileWriter(snapshot.files);this.fileRevision++;this.savedRevision=this.fileRevision;
      runtime._cmd_finish_load_content_animation?.();runtime._dingooemu_state_present?.();this.onFileStatus(t("读档文件已保存 · {0} 个",snapshot.files.length),false);
      runtime._cmd_unpause();this.paused=false;
    } catch(error) {
      try {if(filesChanged&&previousFiles)this.replaceFiles(previousFiles);if(coreChanged&&previousState)this.restoreState(previousState);}
      catch(rollback){throw new Error(t("读档失败且回退失败：{0}。请导出当前文件后重新载入。",String(rollback)));}
      if(!wasPaused){runtime._cmd_unpause();this.paused=false;}throw error;
    } finally {this.stateBusy=false;}
  }
  private updateInfo() {
    const runtime=this.module;if(!runtime||!this.started)return;
    let reply:string|undefined;
    while((reply=runtime.EmscriptenReceiveCommandReply())!==undefined)
      if(reply.startsWith('GET_STATUS'))this.lastReply=reply.trim();
    if(performance.now()-this.lastQuery>=1000){runtime.EmscriptenSendCommand('GET_STATUS');this.lastQuery=performance.now();}
    const audio=this.audioDriver==='audioworklet'?t("AudioWorklet · 独立音频线程"):'RWebAudio';
    const underruns=runtime._audio_driver_get_underruns?.();
    const ms=(value:number|undefined)=>value===undefined||value<0?t("未提供"):value.toFixed(1)+' ms';
    const latency=this.audioDriver==='audioworklet'?t("\n核心积压：{0} · 输出队列：{1}\n浏览器处理：{2} · 设备输出估计：{3}",ms(runtime._dingooemu_audio_queue_ms?.()),ms(runtime._audioworklet_queue_ms?.()),ms(runtime._audioworklet_base_latency_ms?.()),ms(runtime._audioworklet_output_latency_ms?.())):'';
    this.onInfo(t("后端：RetroArch + DingooEmu Libretro\n编译：wasm32-unknown-emscripten · {0}\n音频缓冲目标：{1} ms{2}{3}\n{4}\n输入：0x{5}\nFPS 由 RetroArch 在画面内显示。",audio,this.audioLatency,underruns===undefined?'':t(" · 缺样计数：{0}",underruns),latency,this.lastReply||t("游戏已加载。"),this.sentMask.toString(16)));
  }
  async request(command:'run'|'pause'|'reset'|'dispose') {
    if(command==='dispose'){await this.dispose();return;}
    if(!this.module||!this.started)throw new Error(t("游戏未启动，请重新导入。"));
    if(command==='run'){this.module._cmd_unpause();this.paused=false;}
    if(command==='pause'){this.module._cmd_pause();this.paused=true;await this.flushFiles();}
    if(command==='reset'){
      const wasPaused=this.paused;this.module._cmd_pause();
      try {await this.flushFiles();this.module._cmd_reset();await this.flushFiles();this.module._cmd_unpause();this.paused=false;}
      catch(error){if(!wasPaused)this.module._cmd_unpause();throw error;}
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
      this.canvas.dispatchEvent(new KeyboardEvent(mask&bit?'keydown':'keyup',{
        code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code,bubbles:false,cancelable:true,
      }));
    }
    this.sentMask=mask;
  }
  private async dispose() {
    this.input({source:'*',buttons:0,cancel:true});
    if(this.module&&this.started){
      this.module._cmd_pause();
      try {await this.flushFiles();} catch(error){if(!this.paused)this.module._cmd_unpause();throw error;}
    }
    clearInterval(this.poll);clearInterval(this.openFileTimer);clearTimeout(this.fileTimer);
    if(this.module&&this.started){
      this.stopping=true;
      try {
        await new Promise<void>((resolve,reject)=>{
          const timer=setTimeout(()=>{this.exit=undefined;reject(new Error(t("旧的 RetroArch 后端未退出，请刷新页面后重试。")));},5000);
          this.exit=()=>{clearTimeout(timer);resolve();};
          this.module!.EmscriptenSendCommand('QUIT');
        });
      } finally {this.stopping=false;}
    }
    await this.flushFiles();
    this.fileWriter=undefined;
    this.module=undefined;this.started=false;
  }
}
