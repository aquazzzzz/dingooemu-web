import {t,setText,localize} from '../i18n';
import {QrAssembly,encodeQr,type QrKind} from '../pairing/qr-payload';

interface Hooks {
  canCreate():boolean;canScan():boolean;expected():{session:string;type:'answer'}|undefined;
  create():Promise<string>;accept(text:string):Promise<string|undefined>;cancel():void;gesture():void;
}
export class PairingQr {
  private frames:string[]=[];private index=0;private timer?:ReturnType<typeof setInterval>;
  private assembly:QrAssembly;private generation=0;private scanGeneration=0;
  private busy=false;private stream?:MediaStream;private scanTimer?:ReturnType<typeof setTimeout>;
  private cameraTimer?:ReturnType<typeof setTimeout>;private picking=false;
  private facing='environment';private reading=false;private receiving=false;private paused=false;
  private canvas=document.createElement('canvas');private dialog=document.createElement('dialog');
  private video=document.createElement('video');
  constructor(private root:HTMLElement,private hooks:Hooks,private kind:QrKind='stream'){
    this.assembly=new QrAssembly(kind);
    root.className='stream-qr';
    root.innerHTML=`<div class="file-actions"><button id="qr-create">生成二维码</button><button id="qr-scan">扫描二维码</button></div>
${kind==='stream'?`<p id="qr-help">运行游戏或 RetroArch 的设备是主机；观看画面并操作游戏的设备是接收端。</p><ol class="qr-steps"><li>主机点击“生成二维码”，接收端点击“扫描二维码”读取。</li><li>接收端生成回复二维码后，主机点击“扫描回复”读取。</li><li>配对成功后自动开始串流，无需复制连接文本。</li></ol>`:`<p id="qr-help">任一设备都可发起连接；配对成功后，两台设备都能发送和接收文件。</p><ol class="qr-steps"><li>设备 A 点击“生成二维码”，设备 B 点击“扫描二维码”读取。</li><li>设备 B 生成回复二维码后，设备 A 点击“扫描回复”读取。</li><li>连接成功后选择文件发送，对方确认接收后保存，无需复制连接文本。</li></ol>`}
<section id="qr-display" hidden><strong id="qr-role"></strong><div id="qr-picture"></div><output id="qr-count"></output><div class="file-actions"><button id="qr-pause">暂停轮播</button><button id="qr-next">下一张</button><button id="qr-save">保存图片</button><button id="qr-cancel">取消配对</button></div></section><p id="qr-state" role="status" aria-live="polite"></p>`;
    this.dialog.className='qr-scanner';this.dialog.setAttribute('aria-label',t('扫描二维码'));
    this.dialog.innerHTML=`<h3>扫描二维码</h3><div class="qr-camera"></div><p id="qr-scan-state" role="status" aria-live="polite"></p><div class="file-actions"><button id="qr-camera-start">启用摄像头</button><button id="qr-camera-switch">切换摄像头</button><button id="qr-photo">拍照读取</button><button id="qr-image">读取图片</button><button id="qr-scan-close">取消扫描</button></div><input id="qr-image-file" type="file" accept="image/*" multiple hidden><input id="qr-photo-file" type="file" accept="image/*" capture="environment" hidden>`;
    for(const element of [...root.querySelectorAll<HTMLElement>('[id]'),...this.dialog.querySelectorAll<HTMLElement>('[id]')])element.id=this.id(element.id);
    this.dialog.dataset.qrKind=kind;
    document.body.append(this.dialog);localize(root);localize(this.dialog);
    for(const id of ['qr-display','qr-picture','qr-count'])this.el(id).classList.add(id);
    this.video.playsInline=true;this.video.muted=true;this.video.autoplay=true;this.video.setAttribute('aria-label',t('摄像头预览'));
    this.dialog.querySelector('.qr-camera')!.append(this.video);
    this.el<HTMLButtonElement>('qr-create').onclick=()=>void this.generate();
    this.el<HTMLButtonElement>('qr-scan').onclick=()=>this.open();
    this.el('qr-cancel').onclick=()=>{this.reset();this.hooks.cancel();};
    this.el('qr-pause').onclick=()=>{this.paused=!this.paused;setText(this.el('qr-pause'),t(this.paused?'继续轮播':'暂停轮播'));};
    this.el('qr-next').onclick=()=>{this.index=(this.index+1)%this.frames.length;void this.draw();};
    this.el('qr-save').onclick=()=>this.save();
    this.el('qr-camera-start').onclick=()=>void this.camera();
    this.el('qr-camera-switch').onclick=()=>{this.facing=this.facing==='environment'?'user':'environment';void this.camera();};
    this.el('qr-scan-close').onclick=()=>this.closeScanner();
    for(const [button,id] of [['qr-image','qr-image-file'],['qr-photo','qr-photo-file']]){
      const input=this.el<HTMLInputElement>(id);
      this.el(button).onclick=()=>{this.picking=true;this.stopCamera();input.click();};
      input.onchange=()=>{this.picking=false;void this.images(input);};
      input.addEventListener('cancel',()=>{this.picking=false;});
    }
    this.dialog.oncancel=e=>{e.preventDefault();this.closeScanner();};
    this.dialog.onclose=()=>{if(!this.dialog.open)this.stopCamera();};
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){if(this.picking)this.stopCamera();else this.closeScanner();}
    });
    window.addEventListener('pagehide',()=>this.reset());this.refresh();
  }
  private id(id:string){return this.kind==='stream'?id:id.replace(/^qr-/,'transfer-qr-');}
  private el<T extends HTMLElement=HTMLElement>(id:string){return (this.root.querySelector('#'+this.id(id))??this.dialog.querySelector('#'+this.id(id))) as T;}
  private say(message:string,scan=false){setText(this.el(scan?'qr-scan-state':'qr-state'),message);}
  refresh(){
    this.el<HTMLButtonElement>('qr-create').disabled=this.busy||!this.hooks.canCreate();
    this.el<HTMLButtonElement>('qr-scan').disabled=this.busy||!this.hooks.canScan();
    setText(this.el('qr-scan'),t(this.hooks.expected()?'扫描回复':'扫描二维码'));
  }
  reset(){
    ++this.generation;this.busy=false;this.frames=[];this.index=0;clearInterval(this.timer);this.timer=undefined;
    this.closeScanner();this.assembly=new QrAssembly(this.kind);this.el('qr-display').hidden=true;this.el('qr-picture').replaceChildren();this.say('');this.refresh();
  }
  private async generate(){
    if(this.busy||!this.hooks.canCreate())return;
    const generation=++this.generation;this.busy=true;this.refresh();this.say(t('正在生成二维码…'));
    try{const text=await this.hooks.create();if(generation!==this.generation)return;await this.show(text,false,generation);}
    catch(error){if(generation===this.generation)this.say(String(error));}
    finally{if(generation===this.generation){this.busy=false;this.refresh();}}
  }
  private async show(text:string,reply:boolean,generation=this.generation){
    const frames=await encodeQr(text,this.kind);if(generation!==this.generation)return;
    this.frames=frames;this.index=0;this.paused=false;clearInterval(this.timer);
    this.el('qr-display').hidden=false;setText(this.el('qr-role'),t(reply?'回复二维码':this.kind==='stream'?'主机连接二维码':'发起方连接二维码'));
    this.say(t(this.kind==='stream'?(reply?'请让主机扫描此回复二维码，等待连接。':'请让接收端扫描，再扫描对方的回复二维码。'):(reply?'请让发起方扫描此回复二维码，等待连接。':'请让对方扫描，再扫描对方的回复二维码。')));
    this.el('qr-next').hidden=this.el('qr-pause').hidden=frames.length===1;
    setText(this.el('qr-pause'),t('暂停轮播'));await this.draw();
    if(generation!==this.generation)return;
    this.el('qr-picture').scrollIntoView({block:'nearest',inline:'nearest'});
    if(frames.length>1)this.timer=setInterval(()=>{if(!this.paused&&!this.dialog.open&&!document.hidden){this.index=(this.index+1)%this.frames.length;void this.draw();}},600);
  }
  private async draw(){
    const frame=this.frames[this.index],index=this.index,generation=this.generation;if(!frame)return;
    const {default:qrcode}=await import('qrcode-generator');
    if(generation!==this.generation||index!==this.index)return;
    const qr=qrcode(0,'M');qr.addData(frame,'Alphanumeric');qr.make();
    const cells=qr.getModuleCount(),scale=6;this.canvas.width=this.canvas.height=(cells+8)*scale;
    const ctx=this.canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);ctx.fillStyle='#000';
    for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);
    this.canvas.setAttribute('aria-label',t('配对二维码'));this.el('qr-picture').replaceChildren(this.canvas);
    this.canvas.dataset.frame=String(index+1);
    setText(this.el('qr-count'),t('第 {0} / {1} 张',index+1,this.frames.length));
  }
  private save(){
    if(!this.frames.length)return;
    const link=document.createElement('a');link.download=`dingoo-${this.kind}-pairing-${this.canvas.dataset.frame}-${this.frames.length}.png`;link.href=this.canvas.toDataURL('image/png');link.click();
  }
  private open(){
    if(this.busy||!this.hooks.canScan())return;
    this.hooks.gesture();this.assembly=new QrAssembly(this.kind);this.dialog.showModal();this.say(t('请对准二维码；轮播时保持对准，直到全部读取。'),true);void this.camera();
  }
  private stopCamera(){
    ++this.scanGeneration;clearTimeout(this.scanTimer);this.scanTimer=undefined;
    clearTimeout(this.cameraTimer);this.cameraTimer=undefined;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined;
    this.video.pause();this.video.srcObject=null;
  }
  private closeScanner(){this.picking=false;this.stopCamera();if(this.dialog.open)this.dialog.close();}
  private async camera(){
    this.stopCamera();const generation=this.scanGeneration;
    if(!this.dialog.open)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){this.say(t('此地址无法使用摄像头，请使用 HTTPS、localhost 或读取二维码图片。'),true);return;}
    this.say(t('正在启用摄像头，请允许访问…'),true);
    // Permission or video.play can stall in installed iOS web apps. Timeout
    // invalidates late results too, so granted tracks cannot leak afterwards.
    this.cameraTimer=setTimeout(()=>{
      if(generation!==this.scanGeneration||!this.dialog.open)return;
      this.stopCamera();
      this.say(t('摄像头未提供画面。可重试、切换摄像头、拍照读取或读取图片；主屏幕模式下也可尝试在 Safari 中打开。'),true);
    },15000);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:this.facing},width:{ideal:1280},height:{ideal:720}}});
      if(generation!==this.scanGeneration||!this.dialog.open){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      if(generation!==this.scanGeneration)return;
      this.say(t('请对准二维码；轮播时保持对准，直到全部读取。'),true);void this.tick(generation);
    }catch(error){if(generation===this.scanGeneration){this.stopCamera();this.say(t('摄像头无法启用：{0}。也可以读取二维码图片。',error instanceof Error?error.message:String(error)),true);}}
  }
  private async decode(source:CanvasImageSource,width:number,height:number){
    const {default:jsQR}=await import('jsqr'),canvas=document.createElement('canvas');
    const scale=Math.min(3,1600/Math.max(width,height));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const context=canvas.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;context.drawImage(source,0,0,canvas.width,canvas.height);
    return jsQR(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{inversionAttempts:'dontInvert'})?.data;
  }
  private async tick(generation:number){
    if(generation!==this.scanGeneration||!this.dialog.open)return;
    try{if(!this.reading&&!this.receiving&&this.video.readyState>=2&&this.video.videoWidth){
      clearTimeout(this.cameraTimer);this.cameraTimer=undefined;
      this.reading=true;const frame=await this.decode(this.video,this.video.videoWidth,this.video.videoHeight);
      if(generation===this.scanGeneration&&frame)await this.read(frame,generation);
    }}catch(error){if(generation===this.scanGeneration)this.say(String(error),true);}
    finally{this.reading=false;}
    if(generation===this.scanGeneration&&this.dialog.open)this.scanTimer=setTimeout(()=>void this.tick(generation),125);
  }
  private async read(frame:string,generation:number){
    if(this.receiving)return;
    const assembly=this.assembly,result=await assembly.add(frame,this.hooks.expected());
    if(generation!==this.scanGeneration||!this.dialog.open){
      // Camera switching can cancel an in-flight decompression. Allow the new
      // scanner to collect the same rotating code again rather than consuming it.
      if(result.text&&assembly===this.assembly)this.assembly=new QrAssembly(this.kind);
      return;
    }
    this.say(t('已读取 {0} / {1} 张',result.read,result.total),true);
    if(!result.text)return;
    this.receiving=true;this.busy=true;this.closeScanner();this.refresh();const operation=this.generation;
    try{
      const reply=await this.hooks.accept(result.text);
      if(operation!==this.generation)return;
      if(reply)await this.show(reply,true,operation);else this.say(t(this.kind==='stream'?'正在连接串流…':'正在连接设备互传…'));
    }catch(error){if(operation===this.generation){this.assembly.clear();this.say(String(error));}}
    finally{this.receiving=false;if(operation===this.generation){this.busy=false;this.refresh();}}
  }
  private async images(input:HTMLInputElement){
    const files=Array.from(input.files??[]);input.value='';
    // Stop camera recognition while images are being read; retain collected slices.
    this.stopCamera();const generation=this.scanGeneration;
    for(const file of files){
      if(generation!==this.scanGeneration||!this.dialog.open)break;
      let bitmap:ImageBitmap|undefined;
      try{
        if(file.size>20*1024*1024)throw new Error(t('图片过大，请使用二维码截图。'));
        bitmap=await createImageBitmap(file);
        if(bitmap.width*bitmap.height>24000000)throw new Error(t('图片过大，请使用二维码截图。'));
        const frame=await this.decode(bitmap,bitmap.width,bitmap.height);
        if(generation!==this.scanGeneration||!this.dialog.open)break;
        if(!frame)throw new Error(t('未找到二维码，请选择清晰的二维码图片。'));
        await this.read(frame,generation);
      }catch(error){if(generation===this.scanGeneration)this.say(String(error),true);}
      finally{bitmap?.close();}
    }
  }
}
