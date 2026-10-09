import {t,setText,messageKey,onLanguageChange,literal} from '../i18n';
import {messages} from '../locales';
import {EmulatorClient,type AudioSnapshot,type FrameMeasurement} from '../emulator/client';

interface Row extends AudioSnapshot {seconds:number;fps:number}
interface Session {
  start:number;previous:number;previousFrames:number;baseline:AudioSnapshot;rows:Row[];
  game:string;note:string;environment:ReturnType<EmulatorClient['measurementEnvironment']>;
  view:{width:number;height:number;dpr:number;standalone:boolean;userAgent:string};
}
interface Result {session:Session;elapsed:number;frames:FrameMeasurement;final:AudioSnapshot;reason:string;time:string}
const duration=30_000;
const number=(value:number|null,digits=2)=>value===null||value<0?t("未提供"):value.toFixed(digits);

export class PerformanceMeasurement {
  private session?:Session;
  private pending=false;
  private finishing?:Promise<void>;
  private result?:Result;
  private timer?:ReturnType<typeof setInterval>;
  private deadline?:ReturnType<typeof setTimeout>;
  private start=document.querySelector<HTMLButtonElement>('#measure-start')!;
  private stop=document.querySelector<HTMLButtonElement>('#measure-stop')!;
  private copy=document.querySelector<HTMLButtonElement>('#measure-copy')!;
  private status=document.querySelector<HTMLElement>('#measure-status')!;
  private report=document.querySelector<HTMLTextAreaElement>('#measure-report')!;
  private summary=document.querySelector<HTMLElement>('#measure-summary')!;
  private note=document.querySelector<HTMLInputElement>('#measure-note')!;
  private mode=document.querySelector<HTMLSelectElement>('#measure-mode')!;

  constructor(private client:EmulatorClient,private canRecord:()=>boolean,private game:()=>string,private storageKey:string) {
    try {const saved=localStorage.getItem(storageKey);if(saved&&saved.length<30000)this.showReport(saved);}catch{}
    this.start.onclick=()=>this.begin();
    this.stop.onclick=()=>this.finish('手动结束');
    this.copy.onclick=()=>void this.copyReport();
    onLanguageChange(()=>{if(this.result&&!this.session)this.showResult(this.result);});
    this.refresh();
  }

  refresh() {
    if(this.session&&!this.canRecord())this.finish('游戏暂停、重置、切换或结束，测量提前结束');
    this.start.disabled=this.pending||Boolean(this.session)||!this.canRecord();
    this.stop.hidden=!this.session;
    this.note.disabled=this.pending||Boolean(this.session);
    this.mode.disabled=this.pending||Boolean(this.session);
  }

  async cancel(reason:string) {if(this.session)await this.finish(reason);else await this.finishing;}

  private async begin() {
    if(!this.canRecord()||this.session||this.pending)return;
    this.pending=true;this.refresh();
    try {await this.client.beginMeasurement(this.mode.value==='full'?'full':'light');}catch(error){this.pending=false;this.refresh();setText(this.status,String(error));return;}
    this.pending=false;
    if(!this.canRecord()){await this.client.endMeasurement();this.refresh();return;}
    const start=performance.now();
    this.session={start,previous:start,previousFrames:0,baseline:this.client.audioSnapshot(),rows:[],game:this.game(),note:this.note.value.trim(),environment:this.client.measurementEnvironment(),view:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,standalone:matchMedia('(display-mode: standalone)').matches,userAgent:navigator.userAgent}};
    this.result=undefined;
    this.report.hidden=true;this.summary.hidden=true;this.copy.disabled=true;
    setText(this.status,t("测量中 · 剩余 30 秒，请保持在当前游戏场景"));
    this.timer=setInterval(()=>{
      if(!this.session)return;
      this.sample();
      const remaining=Math.max(0,Math.ceil((duration-(performance.now()-this.session.start))/1000));
      setText(this.status,t("测量中 · 剩余 {0} 秒",remaining));
      if(remaining===0)this.finish('完成');
    },1000);
    this.deadline=setTimeout(()=>this.finish('完成'),duration);
    this.refresh();
  }

  private sample() {
    const session=this.session;if(!session)return;
    const now=performance.now(),frames=this.client.measurementFrames();
    if(now-session.previous<50)return;
    session.rows.push({seconds:(now-session.start)/1000,fps:(frames-session.previousFrames)*1000/(now-session.previous),...this.client.audioSnapshot()});
    session.previous=now;session.previousFrames=frames;
  }

  private finish(reason:string):Promise<void> {
    if(this.finishing)return this.finishing;
    this.finishing=this.finishNow(reason).finally(()=>{this.finishing=undefined;});return this.finishing;
  }
  private async finishNow(reason:string) {
    const session=this.session;if(!session)return;
    clearInterval(this.timer);clearTimeout(this.deadline);
    this.sample();
    this.session=undefined;this.pending=true;this.refresh();
    try {
      const frames=await this.client.endMeasurement(),final=this.client.audioSnapshot(),elapsed=(performance.now()-session.start)/1000;
      reason=messageKey(reason);
      this.result={session,elapsed,frames,final,reason,time:new Date().toISOString()};
      this.showResult(this.result);
      setText(this.status,t("{0} · 已记录 {1} 秒，可复制报告或截图",reason==='完成'?t("测量完成"):t(reason),elapsed.toFixed(1)));
    } catch(error) {setText(this.status,String(error));}
    this.pending=false;this.refresh();
  }

  private showResult(result:Result) {
    this.showReport(this.format(result));
    try{localStorage.setItem(this.storageKey,this.report.value);}catch{}
  }

  private showReport(text:string) {
    this.report.value=text;this.report.hidden=false;this.copy.disabled=false;
    // Older saved reports retain their original language, but still have a summary.
    const labels=["模拟帧数：","核心耗时","模拟帧间隔 ","合计耗时超过 ","音频新增缺样周期："].flatMap(key=>[key,...messages[key]]);
    this.summary.textContent=text.split('\n').filter(line=>labels.some(label=>line.startsWith(label))).join('\n');
    this.summary.hidden=false;
  }

  private format({session,elapsed,frames,final,reason,time}:Result) {
    const {environment,rows,view}=session;
    const range=(key:keyof AudioSnapshot)=>{
      const values=rows.map(row=>row[key]).filter((value):value is number=>value!==null);
      return values.length?`${number(values.reduce((a,b)=>a+b,0)/values.length)} / ${number(Math.min(...values))} / ${number(Math.max(...values))} ms`:t("未提供");
    };
    const underruns=final.underruns===null||session.baseline.underruns===null?null:Math.max(0,final.underruns-session.baseline.underruns);
    return [
      t("DingooEmu 性能报告 v2"),
      t("时间：{0}",time),
      t("游戏：{0}",literal(session.game)),
      t("设备 / 场景备注：{0}",session.note?literal(session.note):t("未填写")),
      t("结果：{0} · 实测 {1} 秒",t(reason),elapsed.toFixed(2)),
      t("测量模式：{0}",frames.mode==='light'?t("轻量（每秒读取计数，不启用逐帧计时）"):t("详细（逐帧计时，含少量额外开销）")),
      t("浏览器：{0}",view.userAgent),
      t("页面：{0}×{1} · DPR {2} · {3}",view.width,view.height,view.dpr,view.standalone?t("独立应用窗口"):t("浏览器窗口")),
      t("安全上下文：{0} · 共享内存隔离：{1} · 声音 {2} · 缓冲目标 {3} ms",environment.secure?t("开启"):t("关闭"),environment.isolated?t("开启"):t("关闭"),environment.audioDriver,environment.audioLatency),
      t("核心运行：{0}",environment.coreWorker?t("Worker"):t("主线程")),
      '',
      t("模拟帧数：{0} · 平均 {1} FPS",frames.frames,number(frames.frames/Math.max(elapsed,0.001))),
      t("游戏指令数：{0} · 每模拟帧平均 {1}",frames.instructions,number(frames.instructions/Math.max(frames.frames,1),0)),
      t("分段 FPS 最低 / 最高：{0}",rows.length?`${number(Math.min(...rows.map(row=>row.fps)))} / ${number(Math.max(...rows.map(row=>row.fps)))}`:t("未提供")),
      frames.mode==='full'?t("核心耗时 平均 / P50 / P95 / 最大：{0} ms",[frames.tickMean,frames.tickP50,frames.tickP95,frames.tickMax].map(value=>number(value)).join(' / ')):t("核心耗时：轻量模式未逐帧计时"),
      frames.mode==='full'?t("画面提交 平均 / P95：{0} / {1} ms",number(frames.videoMean),number(frames.videoP95)):'',
      frames.mode==='full'?t("音频提交 平均 / P95：{0} / {1} ms",number(frames.audioMean),number(frames.audioP95)):'',
      frames.mode==='full'?t("以上三项合计平均：{0} ms",number(frames.runMean)):'',
      frames.mode==='full'?t("模拟帧间隔 平均 / P95 / 最大：{0} ms",[frames.intervalMean,frames.intervalP95,frames.intervalMax].map(value=>number(value)).join(' / ')):'',
      frames.mode==='full'?t("合计耗时超过 16.67 ms：{0}/{1} 帧 ({2}%)",frames.overBudget,frames.samples,number(frames.overBudget/Math.max(frames.samples,1)*100,1)):'',
      t("音频新增缺样周期：{0}",underruns===null?t("未提供"):underruns),
      t("核心音频积压 平均 / 最低 / 最高：{0}",range('core')),
      t("输出音频队列 平均 / 最低 / 最高：{0}",range('queue')),
      t("浏览器处理 / 设备输出估计：{0} / {1} ms",number(final.base),number(final.output)),
      '',
      frames.frames?t("计数为实际模拟帧，不等同于屏幕刷新率。"):t("没有采集到模拟帧，请确认游戏运行后重新测量。"),
      t("P95 表示 95% 的样本不超过该耗时。画面提交为 CPU 侧耗时，未包含 GPU 完成和屏幕显示。"),
      t("缺样按音频处理周期计数，不等同于爆音次数；设备输出为浏览器估计，未测量按键或蓝牙端到端延迟。"),
      environment.wasmJit
        ?t("执行模式：Wasm JIT 实验（A320 部分整数指令；其余回退解释器）。")+'\n'+t("采集仅在本机进行；详细模式包含逐帧计时开销，轻量模式只读取计数。")
        :(frames.mode==='full'?t("采集仅在本机进行；逐帧计时有额外开销。游戏核心仍使用解释器。"):t("采集仅在本机进行；每秒读取已有计数，未启用逐帧计时。游戏核心仍使用解释器。")),
      frames.truncated?t("计时样本达到上限，分位数只覆盖前 4096 帧。"):'',
      '',
      t("逐段记录（累计秒 | FPS | 核心积压 ms | 输出队列 ms | 累计缺样）"),
      ...rows.map(row=>t("{0} | {1} | {2} | {3} | {4}",row.seconds.toFixed(2),number(row.fps),number(row.core),number(row.queue),row.underruns??t("未提供"))),
    ].filter((line,index,lines)=>line!==''||lines[index-1]!=='').join('\n');
  }

  private async copyReport() {
    try {await navigator.clipboard.writeText(this.report.value);setText(this.status,t("报告已复制，可以粘贴到聊天中。"));}
    catch {this.report.focus();this.report.select();this.report.setSelectionRange(0,this.report.value.length);setText(this.status,t("自动复制不可用。报告已选中，请长按选择“复制”，或截图。"));}
  }
}
