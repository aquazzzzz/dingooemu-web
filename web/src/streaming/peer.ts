import {t} from '../i18n';
import {buttons} from '../input/state';

export type Role='host'|'receiver';
const VALID_MASK=Object.values(buttons).reduce((a,b)=>a|b,0)>>>0;
export interface Pairing {type:'offer'|'answer';sdp:string;session:string}
export interface RemotePoint {id:number;x:number;y:number}
// Invalid user input must not destroy a pending pairing.
export class PairingInputError extends Error {}
export function parsePairing(text:string):Pairing {
  try {
    if(text.length>64000)throw 0;
    const p=JSON.parse(text.trim());
    if(p.app!=='dingoo-stream'||p.version!==1||!['offer','answer'].includes(p.type)||typeof p.sdp!=='string'||p.sdp.length>60000||typeof p.session!=='string'||!/^[a-f0-9]{32}$/.test(p.session))throw 0;
    return p;
  }catch{throw new PairingInputError(t('串流连接文本无效，请完整复制。'));}
}
interface Hooks {
  connected():void;
  closed(reason:string):void;
  media(stream:MediaStream):void;
  input(mask:number,cancel:boolean):void;
  permission(allowed:boolean):void;
  touches(points:RemotePoint[]):void;
  frontend(action:'open'|'menu'|'close'):void;
  view(active:boolean,controller:'web'|'retroarch'):void;
  controller(mode:'web'|'retroarch'):void;
  playback(action:'pause'|'resume'):void;
  playbackState():void;
}

// Media uses RTP; short-lived input states never queue behind file transfers.
export class StreamPeer {
  readonly pc=new RTCPeerConnection({iceServers:[]});
  readonly received=new MediaStream();
  private control?:RTCDataChannel;
  private inputs?:RTCDataChannel;
  private closed=false;
  private announced=false;
  private hello=false;
  private allowed=false;
  private available=false;
  private sequence=0;
  private lastSequence=-1;
  private mask=0;
  private lastInput=0;
  private inputHeld=false;
  private pointers:RemotePoint[]=[];
  private frontend=false;
  private frontendSupported=false;
  private controllerSupported=false;
  private controller:'web'|'retroarch'='web';
  private playbackSupported=false;
  private playbackAvailable=false;
  private paused=false;
  private fps=60;
  private videoSize='';
  private tick?:ReturnType<typeof setInterval>;
  private timeout?:ReturnType<typeof setTimeout>;
  private remoteRoutes=0;
  private remoteMdnsRoutes=0;
  private stunConfigured=false;
  private gatheringErrors:number[]=[];
  constructor(readonly role:Role,readonly session:string,private hooks:Hooks) {
    this.timeout=setTimeout(()=>this.close(t('串流配对超时，请重新连接。')),300000);
    this.pc.onicecandidateerror=event=>{if(!this.gatheringErrors.includes(event.errorCode))this.gatheringErrors.push(event.errorCode);};
    this.pc.onconnectionstatechange=()=>{
      if(this.pc.connectionState==='connected')this.ready();
      if(['failed','closed','disconnected'].includes(this.pc.connectionState))this.close(t('串流连接已断开，请重新配对。'),false);
    };
    this.pc.ontrack=e=>{
      if(role!=='receiver'){this.close(t('串流协议不匹配。'));return;}
      if(!this.received.getTracks().includes(e.track))this.received.addTrack(e.track);
      this.hooks.media(this.received);
    };
    this.pc.ondatachannel=e=>this.attach(e.channel);
    this.tick=setInterval(()=>{
      if(this.closed)return;
      if(role==='receiver')this.sendInput(this.mask);
      else if(this.inputHeld&&performance.now()-this.lastInput>500)this.release();
    },100);
  }
  get connected(){return !this.closed&&this.announced&&this.pc.connectionState==='connected'&&this.control?.readyState==='open'&&this.inputs?.readyState==='open';}
  get controlling(){return this.connected&&this.allowed&&this.available;}
  get authorized(){return this.connected&&this.allowed;}
  get canControlPlayback(){return this.authorized&&this.playbackSupported&&this.playbackAvailable;}
  get hostPaused(){return this.paused;}
  get canUseFrontend(){return this.controlling&&this.frontendSupported;}
  get canChooseController(){return this.canUseFrontend&&this.controllerSupported;}
  get waitingForAnswer(){return !this.closed&&this.role==='host'&&this.pc.signalingState==='have-local-offer';}
  private attach(channel:RTCDataChannel) {
    if(this.closed){channel.close();return;}
    if(channel.label==='control'&&!this.control){
      this.control=channel;
      channel.onmessage=e=>this.message(e.data,false);
    }else if(channel.label==='input'&&!this.inputs){
      this.inputs=channel;
      channel.onmessage=e=>this.message(e.data,true);
    }else{this.close(t('串流协议不匹配。'));return;}
    channel.onopen=()=>{
      if(channel===this.control)this.sendControl({type:'hello',version:1,role:this.role,frontend:true,playback:true,controller:true});
      this.ready();
    };
    channel.onclose=channel.onerror=()=>this.close(t('串流连接已断开，请重新配对。'),false);
  }
  private ready() {
    if(this.closed||this.announced||!this.hello||this.pc.connectionState!=='connected'||this.control?.readyState!=='open'||this.inputs?.readyState!=='open')return;
    this.announced=true;clearTimeout(this.timeout);this.hooks.connected();
    if(this.role==='host'){this.publishPermission();this.publishPlayback();}
    else this.hooks.permission(this.controlling);
  }
  private sendControl(message:object) {
    if(this.control?.readyState==='open'&&this.control.bufferedAmount<16384){
      try{this.control.send(JSON.stringify({...message,session:this.session}));return true;}
      catch{/* SCTP can close before readyState changes, particularly in WebKit. */}
    }
    return false;
  }
  private message(data:unknown,input:boolean) {
    if(this.closed)return;
    try {
      if(typeof data!=='string'||data.length>(input?4096:1024))throw 0;
      const m=JSON.parse(data);
      if(!m||m.session!==this.session)throw 0;
      if(input){
        if(this.role!=='host'||m.type!=='input'||!Number.isSafeInteger(m.seq)||m.seq<0||!Number.isInteger(m.mask)||m.mask<0||m.mask>0xffffffff||((m.mask&~VALID_MASK)>>>0)!==0||typeof m.cancel!=='boolean')throw 0;
        const points=m.touches??[];
        if(!Array.isArray(points)||points.length>10||points.some(p=>!p||!Number.isInteger(p.id)||p.id<0||p.id>0x7fffffff||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)||new Set(points.map(p=>p.id)).size!==points.length)throw 0;
        if(m.seq<=this.lastSequence)return;
        this.lastSequence=m.seq;
        if(!this.controlling){this.release();return;}
        this.lastInput=performance.now();this.inputHeld=m.mask!==0||points.length>0;
        this.hooks.touches(this.frontend&&!m.cancel?points:[]);
        this.hooks.input(m.mask,m.cancel);return;
      }
      if(m.type==='hello'){
        if(m.version!==1||m.role===(this.role)||!['host','receiver'].includes(m.role)||this.hello)throw 0;
        this.hello=true;this.frontendSupported=m.frontend===true;this.playbackSupported=m.playback===true;this.controllerSupported=m.controller===true;this.ready();return;
      }
      if(m.type==='permission'&&this.role==='receiver'&&this.hello&&typeof m.allowed==='boolean'&&typeof m.available==='boolean'){
        this.allowed=m.allowed;this.available=m.available;
        if(!this.controlling){this.mask=0;this.pointers=[];}
        this.hooks.permission(this.controlling);return;
      }
      if(m.type==='view'&&this.role==='receiver'&&this.hello&&this.frontendSupported&&typeof m.frontend==='boolean'){
        this.frontend=m.frontend;this.pointers=[];
        this.controller=this.controllerSupported&&m.controller==='retroarch'?'retroarch':'web';
        this.hooks.view(m.frontend,this.controller);return;
      }
      if(m.type==='controller'&&this.role==='host'&&this.hello&&this.controllerSupported&&['web','retroarch'].includes(m.mode)){
        if(this.canChooseController&&this.frontend)this.hooks.controller(m.mode);return;
      }
      if(m.type==='frontend'&&this.role==='host'&&this.hello&&this.frontendSupported&&['open','menu','close'].includes(m.action)){
        if(this.controlling)this.hooks.frontend(m.action);return;
      }
      if(m.type==='playback-state'&&this.role==='receiver'&&this.hello&&this.playbackSupported&&typeof m.paused==='boolean'&&typeof m.available==='boolean'){
        this.paused=m.paused;this.playbackAvailable=m.available;this.hooks.playbackState();return;
      }
      if(m.type==='playback-request'&&this.role==='host'&&this.hello&&this.playbackSupported&&['pause','resume'].includes(m.action)){
        // Pausing disables game inputs, but must not disable authorized resume.
        if(this.canControlPlayback)this.hooks.playback(m.action);return;
      }
      if(m.type==='bye'){this.close(t('对方已停止串流。'),false);return;}
      throw 0;
    }catch{this.close(t('串流协议不匹配。'));}
  }
  private release(){this.inputHeld=false;this.hooks.input(0,true);this.hooks.touches([]);}
  setPermission(allowed:boolean,available:boolean) {
    if(this.role!=='host'||this.closed)return;
    const changed=this.allowed!==allowed||this.available!==available;
    this.allowed=allowed;this.available=available;
    if(!allowed||!available)this.release();
    if(changed&&this.announced)this.publishPermission();
  }
  private publishView(){if(this.frontendSupported)this.sendControl({type:'view',frontend:this.frontend,...(this.controllerSupported?{controller:this.controller}:{})});}
  private publishPermission(){this.sendControl({type:'permission',allowed:this.allowed,available:this.available});this.publishView();}
  setFrontend(active:boolean) {
    if(this.role!=='host'||this.closed||this.frontend===active)return;
    this.frontend=active;this.release();
    if(this.announced)this.publishView();
    void this.videoParameters().catch(()=>{});
  }
  requestFrontend(action:'open'|'menu'|'close'){if(this.role==='receiver'&&this.canUseFrontend)this.sendControl({type:'frontend',action});}
  setController(mode:'web'|'retroarch'){
    if(this.role!=='host'||this.closed)return;
    this.controller=mode;this.release();if(this.announced)this.publishView();
  }
  requestController(mode:'web'|'retroarch'){if(this.role==='receiver'&&this.canChooseController)this.sendControl({type:'controller',mode});}
  setPlayback(paused:boolean,available:boolean) {
    if(this.role!=='host'||this.closed)return;
    const changed=this.paused!==paused||this.playbackAvailable!==available;
    this.paused=paused;this.playbackAvailable=available;if(changed&&this.announced)this.publishPlayback();
  }
  private publishPlayback(){if(this.playbackSupported)this.sendControl({type:'playback-state',paused:this.paused,available:this.playbackAvailable});}
  requestPlayback(action:'pause'|'resume'){if(this.role==='receiver'&&this.canControlPlayback)this.sendControl({type:'playback-request',action});}
  sendTouches(points:RemotePoint[]){if(this.role==='receiver'){this.pointers=this.controlling?points:[];this.sendInput(this.mask);}}
  sendInput(mask:number,cancel=false) {
    if(this.role!=='receiver'||this.closed)return;
    this.mask=this.controlling?mask>>>0:0;
    if(cancel)this.pointers=[];
    if(!this.connected||this.inputs!.bufferedAmount>1024)return;
    try{this.inputs!.send(JSON.stringify({session:this.session,type:'input',seq:++this.sequence,mask:this.mask,cancel,...(this.frontendSupported?{touches:this.pointers}:{})}));}
    catch{this.close(t('串流连接已断开，请重新配对。'),false);}
  }
  async create(stream:MediaStream,fps:number) {
    if(this.role!=='host')throw new Error(t('串流协议不匹配。'));
    await this.configureNetwork();
    this.attach(this.pc.createDataChannel('control',{ordered:true}));
    this.attach(this.pc.createDataChannel('input',{ordered:false,maxRetransmits:0}));
    this.fps=fps;
    for(const track of stream.getTracks())this.pc.addTrack(track,stream);
    await this.videoParameters();
    await this.pc.setLocalDescription(await this.pc.createOffer());return this.description();
  }
  private async videoParameters() {
    const sender=this.pc.getSenders().find(s=>s.track?.kind==='video');if(!sender)return;
    const p=sender.getParameters(),{width=320,height=240}=sender.track!.getSettings();
    const size=`${width}x${height}:${this.frontend}:${this.fps}`;if(this.videoSize===size)return;
    p.encodings=[{...p.encodings?.[0],maxBitrate:this.frontend?3000000:1500000,maxFramerate:this.fps,scaleResolutionDownBy:this.frontend?1:Math.max(1,Math.sqrt(width*height/(320*240)))}];
    p.degradationPreference='maintain-framerate';await sender.setParameters(p);this.videoSize=size;
  }
  refreshVideoParameters(){return this.role==='host'?this.videoParameters():Promise.resolve();}
  async replaceMedia(stream:MediaStream){
    if(this.role!=='host'||!this.connected)throw new Error(t('串流已停止。'));
    for(const kind of ['video','audio']){
      const sender=this.pc.getSenders().find(sender=>sender.track?.kind===kind),track=stream.getTracks().find(track=>track.kind===kind);
      if(!sender||!track)throw new Error(t('串流媒体不完整，请重新连接。'));
      await sender.replaceTrack(track);
    }
    this.videoSize='';await this.videoParameters();
  }
  async join(pairing:Pairing) {
    if(this.role!=='receiver'||pairing.type!=='offer'||pairing.session!==this.session)throw new Error(t('请粘贴主机的串流连接文本。'));
    await this.configureNetwork();
    await this.remote(pairing);await this.pc.setLocalDescription(await this.pc.createAnswer());return this.description();
  }
  async answer(pairing:Pairing) {
    if(this.role!=='host'||this.closed)throw new PairingInputError(t('当前没有等待回复的串流，请先创建串流。'));
    if(pairing.type!=='answer')throw new PairingInputError(t('这是主机连接文本。请在接收端点击“接收串流”，再把接收端生成的回复粘贴到这里。'));
    if(pairing.session!==this.session)throw new PairingInputError(t('这是另一次配对的回复。请把主机当前的连接文本重新发给接收端，再生成新回复。'));
    if(!this.waitingForAnswer)throw new PairingInputError(t('回复已经处理，请等待连接，无需再次完成配对。'));
    await this.remote(pairing);
  }
  private async remote(pairing:Pairing) {
    const sections=pairing.sdp.split(/(?=^m=)/m),candidates:RTCIceCandidateInit[]=[];
    let index=-1;
    for(const section of sections){
      if(!section.startsWith('m='))continue;index++;
      const mid=section.match(/^a=mid:([^\r\n]+)/m)?.[1];
      for(const match of section.matchAll(/^a=(candidate:[^\r\n]+)/gm))candidates.push({candidate:match[1],sdpMid:mid,sdpMLineIndex:index});
    }
    await this.pc.setRemoteDescription({type:pairing.type,sdp:pairing.sdp.replace(/^a=(?:candidate:[^\r\n]*|end-of-candidates)\r?\n/gm,'')});
    for(const candidate of candidates)await this.pc.addIceCandidate(candidate);
    await this.pc.addIceCandidate({candidate:''});
    this.remoteRoutes=candidates.length;this.remoteMdnsRoutes=candidates.filter(c=>c.candidate?.includes('.local')).length;
  }
  private async configureNetwork() {
    try {
      const response=await fetch('/__stream__/status',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(response.ok){
        const status=await response.json();
        if(status.app==='dingoo-lan-signaling'&&Array.isArray(status.iceServers)){
          const servers=status.iceServers.filter((s:RTCIceServer)=>typeof s?.urls==='string'&&/^stun:(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}$/.test(s.urls)).slice(0,2);
          if(!this.closed){this.pc.setConfiguration({iceServers:servers});this.stunConfigured=servers.length>0;}
        }
      }
    }catch{/* Older/static servers still support direct LAN pairing. */}
    if(this.closed)throw new Error(t('串流已停止。'));
  }
  networkDiagnostics() {
    const routes=this.pc.localDescription?.sdp.match(/^a=candidate:.*$/gm)??[];
    return {gathering:this.pc.iceGatheringState,stunConfigured:this.stunConfigured,localRoutes:routes.length,localMdnsRoutes:routes.filter(r=>r.includes('.local')).length,remoteRoutes:this.remoteRoutes,remoteMdnsRoutes:this.remoteMdnsRoutes,gatheringErrors:[...this.gatheringErrors]};
  }
  private async description():Promise<string> {
    await new Promise<void>((resolve,reject)=>{
      const finish=(error?:Error)=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',check);this.pc.removeEventListener('signalingstatechange',check);error?reject(error):resolve();};
      const check=()=>{if(this.closed)finish(new Error(t('串流已停止。')));else if(this.pc.iceGatheringState==='complete')finish();};
      const timer=setTimeout(()=>finish(this.pc.localDescription?.sdp.match(/^a=candidate:/m)?undefined:new Error(t('收集连接信息超时，请重新配对。'))),15000);
      this.pc.addEventListener('icegatheringstatechange',check);this.pc.addEventListener('signalingstatechange',check);check();
    });
    const {type,sdp}=this.pc.localDescription!;
    if(!sdp?.match(/^a=candidate:/m))throw new Error(t('浏览器没有提供可用的连接地址，请检查浏览器局域网权限或更换网络后重试。'));
    return JSON.stringify({app:'dingoo-stream',version:1,session:this.session,type,sdp});
  }
  close(reason=t('串流已停止。'),notify=true) {
    if(this.closed)return;
    // Receiving bye or losing a transport needs no reply on a closing SCTP.
    if(notify)this.sendControl({type:'bye'});
    this.closed=true;clearTimeout(this.timeout);clearInterval(this.tick);
    this.release();this.allowed=this.available=false;
    this.control?.close();this.inputs?.close();this.pc.close();
    this.received.getTracks().forEach(track=>track.stop());
    this.hooks.closed(reason);
  }
}
