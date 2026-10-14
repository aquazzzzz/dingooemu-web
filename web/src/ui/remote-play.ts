import {t,setText,localize} from '../i18n';
import {StreamPeer,parsePairing,PairingInputError,type Role} from '../streaming/peer';
import type {InputUpdate} from '../input/state';
import {QuickConnect} from '../streaming/quick-connect';
import {PairingQr} from './pairing-qr';
interface Hooks {
  canHost():boolean;
  canStartHost():boolean;
  canJoin():boolean;
  running():boolean;
  capture(fps:number,controller:'web'|'retroarch'):Promise<{stream:MediaStream;stop():void}>;
  controller(mode:'web'|'retroarch'):Promise<void>;
  input(update:InputUpdate):void;
  clearInput():void;
  changed():void;
  fullscreen():Promise<void>;
  prepareHost():Promise<void>;
  muted():boolean;
  enableAudio():void;
  frontend(action:'open'|'menu'|'close'):Promise<void>;
  touches(points:{id:number;x:number;y:number}[]):void;
  streamSize(width:number,height:number):void;
  frontendActive():boolean;
  paused():boolean;
  playbackReady():boolean;
  playback(action:'pause'|'resume'):Promise<void>;
}

export class RemotePlay {
  private peer?:StreamPeer;
  private role?:Role;
  private capture?:{stream:MediaStream;stop():void};
  private working=false;
  private enabled=true;
  private generation=0;
  private statsTimer?:ReturnType<typeof setInterval>;
  private statsBusy=false;
  private lastVideoStats?:{frames:number;time:number};
  private allowed=false;
  private canvasSize?:[number,number];
  private quick:QuickConnect;
  private qr:PairingQr;
  private preparingQr=false;
  private nativeView=false;
  private pointers=new Map<number,{id:number;x:number;y:number}>();
  private nextTouchId=0;
  readonly video=document.createElement('video');
  private playbackButton=document.createElement('button');
  private primaryActions=document.createElement('div');
  private toolbar=document.createElement('div');
  private summaryButton=document.createElement('button');
  private live=document.createElement('section');
  private statusUsed=false;
  private playAttempt=0;
  private audioBlocked=false;
  private playbackBlocked=false;
  private wasImmersive=false;
  private infoCollapsed=false;
  private quickPending=false;
  private replacingMedia=false;
  private controller:'web'|'retroarch'='retroarch';
  constructor(private panel:HTMLDetailsElement,private stage:HTMLElement,private canvas:HTMLCanvasElement,private hooks:Hooks) {
    panel.innerHTML=`<summary>局域网串流</summary>
<p class="stream-intro">通过双方互扫二维码、连接码或已记住的主机连接。</p>
<section id="stream-qr"></section>
<section id="stream-quick"></section>
<div id="stream-host-ready" class="stream-host-ready"><span>已获准的设备连接时，可自动启动本机 RetroArch；也可先运行游戏。</span><button id="retroarch" aria-keyshortcuts="F1">RetroArch 前端</button></div>
<div class="stream-options"><label for="stream-fps">串流帧率上限</label><select id="stream-fps"><option value="60">60 FPS</option><option value="30">30 FPS</option></select><label><input id="stream-allow" type="checkbox" checked> 允许接收端操作</label></div>
<details id="stream-advanced" class="stream-advanced"><summary>高级选项</summary>
<details id="stream-manual"><summary>手动文本配对</summary>
<div class="file-actions"><button id="stream-create">创建串流</button><button id="stream-join">接收串流</button><button id="stream-answer" disabled>完成配对</button></div>
<div class="transfer-pairing"><label id="stream-input-label" for="stream-input">粘贴对方的连接／回复文本</label><textarea id="stream-input" rows="3" maxlength="64000" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea><label id="stream-output-label" for="stream-output">本机连接／回复文本</label><textarea id="stream-output" rows="3" readonly spellcheck="false"></textarea><button id="stream-copy" disabled>复制本机文本</button><p id="stream-copy-status" role="status" aria-live="polite"></p></div>
</details>
<button id="stream-diagnose" disabled>查看连接诊断</button><textarea id="stream-diagnostics" rows="8" readonly hidden aria-label="串流诊断"></textarea>
</details>`;
    this.live.id='stream-live';this.live.className='stream-live';this.live.hidden=true;this.live.setAttribute('aria-label','串流状态');
    this.live.innerHTML=`<div class="stream-live-heading"><strong id="stream-state" role="status" aria-live="polite"></strong><div class="stream-live-management"><button id="stream-collapse" hidden aria-expanded="true">收起信息</button><button id="stream-close" disabled>停止串流</button></div></div>
<div class="stream-live-meta"><span id="stream-pair-id" hidden></span><span id="stream-permission" role="status" aria-live="polite"></span></div><output id="stream-stats" class="stream-stats"></output>
<div class="stream-live-actions"><button id="stream-playback" hidden disabled>暂停主机</button><button id="stream-play" hidden>启用声音</button><button id="stream-fullscreen" hidden>全屏</button><button id="stream-frontend" hidden>打开主机 RetroArch</button><button id="stream-menu" hidden title="RetroArch 菜单">RetroArch 菜单</button><button id="stream-web" hidden>返回串流游戏</button><label id="stream-controller-setting" hidden>手柄来源 <select id="stream-controller"><option value="retroarch">RetroArch 原生手柄</option><option value="web">网页手柄</option></select></label></div><small id="stream-play-notice" role="status"></small>`;
    stage.querySelector('.screen-wrap')!.after(this.live);localize(this.live);
    localize(panel);
    this.video.className='remote-video';this.video.playsInline=true;this.video.autoplay=true;
    this.video.setAttribute('aria-label','串流画面');this.video.hidden=true;
    localize(this.video);
    canvas.parentElement!.append(this.video);
    this.playbackButton.className='remote-playback';this.playbackButton.hidden=true;
    this.playbackButton.onclick=()=>this.togglePlayback();
    this.toolbar.className='stream-toolbar';this.toolbar.hidden=true;
    this.summaryButton.id='stream-summary';this.summaryButton.className='stream-summary';
    this.summaryButton.setAttribute('aria-controls','stream-live');
    this.summaryButton.setAttribute('aria-live','polite');
    this.summaryButton.onclick=()=>{this.infoCollapsed=!this.infoCollapsed;this.refresh(this.enabled);};
    this.primaryActions.className='stream-primary-actions';this.primaryActions.append(this.playbackButton);
    this.toolbar.append(this.primaryActions,this.summaryButton);this.stage.append(this.toolbar);
    new ResizeObserver(()=>this.positionInfo()).observe(this.toolbar);
    this.video.onloadedmetadata=this.video.onresize=()=>{
      if(!this.receiving||!this.video.videoWidth)return;
      this.canvas.width=this.video.videoWidth;this.canvas.height=this.video.videoHeight;
      this.hooks.streamSize(this.video.videoWidth,this.video.videoHeight);
    };
    this.get('stream-create').onclick=()=>void this.run(generation=>this.create(generation));
    this.get('stream-join').onclick=()=>{this.prepareReceive();void this.run(generation=>this.join(generation,this.get<HTMLTextAreaElement>('stream-input').value));};
    this.get('stream-answer').onclick=()=>void this.run(generation=>this.answer(generation,this.get<HTMLTextAreaElement>('stream-input').value));
    this.get('stream-close').onclick=()=>this.close();
    this.get('stream-collapse').onclick=()=>{this.infoCollapsed=!this.infoCollapsed;this.refresh(this.enabled);};
    this.get('stream-copy').onclick=()=>void this.copy();
    this.get<HTMLInputElement>('stream-allow').onchange=()=>{
      this.hooks.clearInput();this.refresh(this.enabled);
      setText(this.get('stream-permission'),this.get<HTMLInputElement>('stream-allow').checked?t('接收端可以操作；主机可随时收回控制权。'):t('接收端仅观看。'));
    };
    this.get('stream-playback').onclick=()=>this.togglePlayback();
    this.get('stream-play').onclick=()=>void this.play();
    this.get('stream-diagnose').onclick=()=>void this.diagnose();
    this.get('stream-fullscreen').onclick=()=>void this.hooks.fullscreen();
    this.get('stream-frontend').onclick=()=>this.peer?.requestFrontend('open');
    this.get('stream-menu').onclick=()=>{
      this.peer?.requestFrontend('menu');
      this.infoCollapsed=true;this.refresh(this.enabled);
    };
    this.get('stream-web').onclick=()=>this.peer?.requestFrontend('close');
    try{if(localStorage.getItem('dingoo-stream:controller')==='web')this.controller='web';}catch{}
    this.get<HTMLSelectElement>('stream-controller').onchange=()=>{
      const mode=this.get<HTMLSelectElement>('stream-controller').value as 'web'|'retroarch';
      if(this.receiving)this.peer?.requestController(mode);else void this.changeController(mode);
    };
    const point=(event:PointerEvent)=>{
      const box=this.video.getBoundingClientRect(),scale=Math.min(box.width/this.video.videoWidth,box.height/this.video.videoHeight);
      const width=this.video.videoWidth*scale,height=this.video.videoHeight*scale;
      if(!width||!height)return;
      const x=(event.clientX-box.left-(box.width-width)/2)/width,y=(event.clientY-box.top-(box.height-height)/2)/height;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return;
      let id=this.pointers.get(event.pointerId)?.id;
      // Browser pointer IDs are opaque (WebKit uses the full uint32 range).
      // Keep physical IDs local; send bounded, distinct contact IDs to the host.
      if(id===undefined){
        do{id=this.nextTouchId;this.nextTouchId=(this.nextTouchId+1)&0xffff;}
        while([...this.pointers.values()].some(point=>point.id===id));
      }
      return {id,x,y};
    };
    this.video.onpointerdown=event=>{
      if(!this.nativeView||!this.peer?.controlling||this.pointers.size>=10)return;
      const p=point(event);if(!p)return;
      event.preventDefault();this.video.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,p);this.peer.sendTouches([...this.pointers.values()]);
    };
    this.video.onpointermove=event=>{
      if(!this.pointers.has(event.pointerId))return;
      event.preventDefault();const p=point(event);if(p)this.pointers.set(event.pointerId,p);else this.pointers.delete(event.pointerId);
      this.peer?.sendTouches([...this.pointers.values()]);
    };
    this.video.onpointerup=this.video.onpointercancel=this.video.onlostpointercapture=event=>{
      if(this.pointers.delete(event.pointerId)){event.preventDefault();this.peer?.sendTouches([...this.pointers.values()]);}
    };
    this.quick=new QuickConnect(this.get('stream-quick'),{
      receiveGesture:()=>this.prepareReceive(),
      canHost:()=>this.enabled&&!this.working&&this.hooks.canStartHost(),canJoin:()=>this.enabled&&!this.working&&this.hooks.canJoin(),activeSession:()=>this.peer?.session,
      progress:message=>{
        const pending=!!this.quick?.pending;
        if(!this.peer&&(pending||this.quickPending)){this.statusUsed=true;this.say(pending?message:t('连接准备已结束，可再次点击连接。'));}
        this.quickPending=pending;
        this.refresh(this.enabled);
      },
      host:async session=>{
        const generation=this.generation;
        if(!this.hooks.canHost()){
          this.statusUsed=true;this.say(t('正在启动主机 RetroArch…'));this.refresh(this.enabled);
          await this.hooks.prepareHost();
        }
        if(generation!==this.generation)throw new Error(t('串流已停止。'));
        const text=await this.run(value=>this.create(value,session,true));if(!text)throw new Error(t('串流已停止。'));return text;
      },
      receive:async text=>{const reply=await this.run(generation=>this.join(generation,text,true));if(!reply)throw new Error(t('串流已停止。'));return reply;},
      answer:async text=>{await this.run(generation=>this.answer(generation,text));if(!this.peer)throw new Error(t('串流已停止。'));},close:()=>this.close(),
    });
    this.qr=new PairingQr(this.get('stream-qr'),{
      canCreate:()=>typeof RTCPeerConnection!=='undefined'&&this.enabled&&!this.working&&!this.peer&&!this.quick.pending&&this.hooks.canStartHost(),
      canScan:()=>typeof RTCPeerConnection!=='undefined'&&this.enabled&&!this.working&&!this.quick.pending&&(!!this.peer?.waitingForAnswer||!this.peer&&this.hooks.canJoin()),
      expected:()=>this.peer?.waitingForAnswer?{session:this.peer.session,type:'answer'}:undefined,
      gesture:()=>this.prepareReceive(),cancel:()=>this.close(),
      create:async()=>{
        const text=await this.run(async generation=>{
          this.controller='web';
          if(!this.hooks.canHost()){
            this.preparingQr=true;
            try{await this.hooks.prepareHost();}finally{this.preparingQr=false;}
          }
          if(generation!==this.generation)return;
          const text=await this.create(generation);
          if(generation===this.generation)this.say(t('等待接收端扫描并返回回复二维码…'));
          return text;
        });
        if(!text)throw new Error(t('二维码配对未完成，请查看串流状态后重试。'));return text;
      },
      accept:async text=>{
        const pairing=parsePairing(text);
        if(this.peer?.waitingForAnswer){
          if(pairing.type!=='answer'||pairing.session!==this.peer.session)throw new PairingInputError(t('这是另一次配对的二维码，请扫描本次回复。'));
          const peer=this.peer;await this.run(generation=>this.answer(generation,text));
          if(this.peer!==peer)throw new Error(t('二维码配对未完成，请查看串流状态后重试。'));return;
        }
        if(this.peer||pairing.type!=='offer'||!this.hooks.canJoin())throw new PairingInputError(t('请先结束当前会话，再扫描主机二维码。'));
        const reply=await this.run(generation=>this.join(generation,text,true));
        if(!reply)throw new Error(t('二维码配对未完成，请查看串流状态后重试。'));return reply;
      },
    });
    window.addEventListener('blur',()=>this.sendInput(0,true));
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.sendInput(0,true);this.hooks.input({source:'remote',buttons:0,cancel:true});}
      this.refresh(this.enabled);
    });
    window.addEventListener('pagehide',()=>this.close());
    this.say(t('尚未连接。'));this.refresh(true);
  }
  private get<T extends HTMLElement>(id:string){return (this.panel.querySelector<T>('#'+id)??this.live.querySelector<T>('#'+id)??this.toolbar.querySelector<T>('#'+id))!;}
  private async create(generation:number,session=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),quick=false) {
    if(!this.hooks.canHost())throw new Error(t('此运行环境不能作为串流主机，请使用支持 Worker 和 AudioWorklet 的浏览器。'));
    const fps=Number(this.get<HTMLSelectElement>('stream-fps').value),capture=await this.hooks.capture(fps,this.controller);
    if(generation!==this.generation){capture.stop();return;}
    this.capture=capture;
    const peer=this.start('host',session);peer.setController(this.controller);peer.setFrontend(this.hooks.frontendActive());
    this.say(t('正在生成串流连接文本…'));
    const text=await peer.create(capture.stream,fps);if(generation!==this.generation)return;
    this.get<HTMLTextAreaElement>('stream-output').value=text;this.say(quick?t('正在自动交换连接信息，无需复制配对文本…'):t('把本机文本发给接收端，等待回复。'));return text;
  }
  private async join(generation:number,text:string,quick=false) {
    if(!this.hooks.canJoin())throw new Error(t('请先中止本机游戏，再接收串流。'));
    const pairing=parsePairing(text);if(pairing.type!=='offer')throw new Error(t('请粘贴主机的串流连接文本。'));
    const peer=this.start('receiver',pairing.session);this.say(t('正在生成串流连接文本…'));
    const reply=await peer.join(pairing);if(generation!==this.generation)return;
    this.get<HTMLTextAreaElement>('stream-output').value=reply;this.get<HTMLTextAreaElement>('stream-input').value='';
    this.say(peer.connected?t('串流已连接'):quick?t('正在连接串流，请保持双方页面在前台…'):t('把本机回复文本发回主机，等待完成配对。'));return reply;
  }
  private async answer(generation:number,text:string) {
    const pairing=parsePairing(text),peer=this.peer!;await peer.answer(pairing);
    // Native events can complete the handshake before the operation returns.
    if(generation!==this.generation||this.peer!==peer)return;
    this.get<HTMLTextAreaElement>('stream-input').value='';this.say(peer.connected?t('串流已连接'):t('正在连接串流，请保持双方页面在前台…'));
  }
  get receiving(){return this.role==='receiver'&&!!this.peer;}
  get hosting(){return this.role==='host'&&!!this.peer;}
  get remoteControls(){return this.hosting&&!!this.peer?.controlling;}
  get remoteAuthorized(){return this.hosting&&!!this.peer?.authorized;}
  get canControlPlayback(){return this.receiving&&!!this.peer?.canControlPlayback;}
  get canControlInput(){return this.receiving&&!!this.peer?.controlling;}
  get nativeControllerActive(){return this.receiving&&this.nativeView&&this.controller==='retroarch';}
  private async changeController(mode:'web'|'retroarch'){
    const peer=this.peer;if(!peer||this.role!=='host'||this.replacingMedia)return;
    try{
      await this.hooks.controller(mode);if(this.peer!==peer)return;
      this.controller=mode;peer.setController(mode);
      try{localStorage.setItem('dingoo-stream:controller',mode);}catch{}
      this.refresh(this.enabled);
    }catch(error){this.say(String(error));}
  }
  get hostPaused(){return !!this.peer?.hostPaused;}
  togglePlayback(){this.peer?.requestPlayback(this.hostPaused?'resume':'pause');}
  sendInput(mask:number,cancel=false){if(cancel)this.pointers.clear();this.peer?.sendInput(mask,cancel);}
  setFrontend(value:boolean){this.peer?.setFrontend(value);}
  requestMenu(){if(this.receiving)this.peer?.requestFrontend(this.nativeView?'menu':'open');}
  setMuted(value:boolean){
    this.video.muted=value;
    if(value){this.audioBlocked=false;this.refresh(this.enabled);}
    else if(this.receiving)void this.playMedia(this.peer!);
  }
  refresh(enabled:boolean) {
    this.enabled=enabled;
    this.qr?.refresh();
    const active=!!this.peer,disabled=!enabled||this.working;
    const supported=typeof RTCPeerConnection!=='undefined';
    this.get<HTMLButtonElement>('stream-create').disabled=disabled||active||!supported||!this.hooks.canHost();
    this.get<HTMLButtonElement>('stream-join').disabled=disabled||active||!supported||!this.hooks.canJoin();
    this.get<HTMLButtonElement>('stream-answer').disabled=disabled||!this.peer?.waitingForAnswer;
    this.get<HTMLButtonElement>('stream-close').disabled=!active&&!this.working&&!this.quick?.pending;
    this.get<HTMLButtonElement>('stream-diagnose').disabled=!active&&!this.quick?.pending;
    this.get<HTMLButtonElement>('stream-copy').disabled=!this.get<HTMLTextAreaElement>('stream-output').value;
    this.get<HTMLSelectElement>('stream-fps').disabled=disabled||active;
    this.get<HTMLInputElement>('stream-allow').disabled=disabled||this.receiving;
    const immersive=this.stage.classList.contains('immersive');
    const streaming=active||this.working||!!this.quick?.pending;
    this.stage.classList.toggle('stream-active',streaming);
    if(immersive&&!this.wasImmersive)this.infoCollapsed=true;
    this.wasImmersive=immersive;
    this.live.classList.toggle('stream-info-collapsed',immersive&&this.infoCollapsed);
    this.get('stream-collapse').hidden=!immersive;
    this.get('stream-collapse').setAttribute('aria-expanded',String(!this.infoCollapsed));
    setText(this.get('stream-collapse'),this.infoCollapsed?t('展开信息'):t('收起信息'));
    this.live.hidden=!this.statusUsed||(immersive&&(!streaming||this.infoCollapsed));
    this.toolbar.hidden=!immersive||!streaming;
    this.summaryButton.title=this.infoCollapsed?t('展开信息'):t('收起信息');
    this.summaryButton.setAttribute('aria-expanded',String(!this.infoCollapsed));
    this.get('stream-play').hidden=!this.receiving||(!this.audioBlocked&&!this.playbackBlocked);
    setText(this.get('stream-play'),this.playbackBlocked?t('播放画面'):t('启用声音'));
    setText(this.get('stream-play-notice'),this.playbackBlocked?t('点“播放画面”继续播放。'):this.audioBlocked?t('点“启用声音”即可听到游戏声音。'):'');
    this.get('stream-fullscreen').hidden=!this.receiving&&!immersive;
    setText(this.get('stream-fullscreen'),immersive?t('退出全屏'):t('全屏'));
    this.get('stream-frontend').hidden=!this.receiving||this.nativeView;
    this.get('stream-menu').hidden=this.get('stream-web').hidden=!this.receiving||!this.nativeView;
    for(const id of ['stream-frontend','stream-menu','stream-web'])this.get<HTMLButtonElement>(id).disabled=!this.peer?.canUseFrontend;
    const menu=this.get('stream-menu'),menuHome=this.get('stream-web').parentElement!;
    if(immersive){if(menu.parentElement!==this.primaryActions)this.primaryActions.append(menu);}
    else if(menu.parentElement!==menuHome)menuHome.insertBefore(menu,this.get('stream-web'));
    this.primaryActions.hidden=!this.receiving||!immersive;
    this.stage.classList.toggle('stream-menu-toolbar',immersive&&this.receiving&&this.nativeView);
    this.get('stream-controller-setting').hidden=!active||!(this.receiving?this.nativeView:this.hooks.frontendActive());
    this.get<HTMLSelectElement>('stream-controller').value=this.controller;
    this.get<HTMLSelectElement>('stream-controller').disabled=disabled||this.replacingMedia||(this.receiving?!this.peer?.canChooseController:false);
    this.peer?.setPermission(this.get<HTMLInputElement>('stream-allow').checked,enabled&&this.hooks.running()&&!document.hidden);
    this.peer?.setPlayback(this.hooks.paused(),enabled&&this.hooks.playbackReady()&&!document.hidden);
    this.playbackButton.hidden=!this.receiving||!this.stage.classList.contains('immersive');
    const panelPlayback=this.get<HTMLButtonElement>('stream-playback');panelPlayback.hidden=!this.receiving;
    for(const button of [this.playbackButton,panelPlayback]){
      button.disabled=!this.canControlPlayback;setText(button,this.hostPaused?t('继续主机'):t('暂停主机'));
    }
    this.quick?.refresh();
    this.positionInfo();
  }
  private positionInfo() {
    const area=this.stage.getBoundingClientRect();
    if(this.toolbar.hidden||!this.stage.classList.contains('immersive')||area.width<=area.height) {
      this.live.style.removeProperty('--stream-info-right');this.live.style.removeProperty('--stream-info-top');return;
    }
    const button=this.summaryButton.getBoundingClientRect();
    this.live.style.setProperty('--stream-info-right',`${Math.max(10,area.right-button.right)}px`);
    this.live.style.setProperty('--stream-info-top',`${button.bottom-area.top+6}px`);
  }
  private start(role:Role,session:string) {
    this.role=role;this.allowed=false;
    setText(this.get('stream-stats'),t('视频：{0} × {1} · {2} FPS · 网络往返：{3} ms','—','—','—','—'));
    setText(this.get('stream-pair-id'),t('本次配对：{0}（两端应一致）',session.slice(0,8).toUpperCase()));this.get('stream-pair-id').hidden=false;
    setText(this.get('stream-input-label'),role==='host'?t('粘贴接收端新生成的回复'):t('粘贴主机的连接文本'));
    setText(this.get('stream-output-label'),role==='host'?t('主机连接文本：发给接收端'):t('接收端回复文本：发回主机'));
    setText(this.get('stream-copy'),role==='host'?t('复制主机连接文本'):t('复制接收端回复'));this.get('stream-copy-status').textContent='';
    this.get<HTMLTextAreaElement>('stream-output').value='';
    this.hooks.clearInput();
    const peer=new StreamPeer(role,session,{
      connected:()=>{
        if(this.peer!==peer)return;
        this.qr?.reset();
        this.say(t('串流已连接'));
        this.get<HTMLTextAreaElement>('stream-input').value=this.get<HTMLTextAreaElement>('stream-output').value='';
        this.statsTimer=setInterval(()=>void this.stats(peer),1000);
        this.permission(false);this.hooks.changed();this.refresh(this.enabled);
        if(role==='receiver')void this.playMedia(peer);
      },
      closed:reason=>{if(this.peer===peer)this.cleanup(reason);},
      media:stream=>{
        if(this.peer!==peer)return;
        if(this.video.srcObject!==stream)this.video.srcObject=stream;
        void this.playMedia(peer);
      },
      input:(mask,cancel)=>{
        if(this.peer!==peer||role!=='host')return;
        this.hooks.input({source:'remote',buttons:this.hooks.running()&&!document.hidden?mask:0,cancel:cancel||!this.hooks.running()});
      },
      permission:allowed=>this.permission(allowed),
      frontend:action=>{if(this.peer===peer)void this.hooks.frontend(action).catch(error=>this.say(String(error)));},
      controller:mode=>{if(this.peer===peer)void this.changeController(mode);},
      touches:points=>{if(this.peer===peer)this.hooks.touches(points);},
      view:(active,controller)=>{
        if(this.peer!==peer)return;
        this.pointers.clear();peer.sendTouches([]);this.hooks.clearInput();this.nativeView=active;this.controller=controller;
        this.stage.classList.toggle('remote-frontend',active);this.refresh(this.enabled);this.hooks.changed();
      },
      playback:action=>{if(this.peer===peer)void this.hooks.playback(action).catch(error=>this.say(String(error)));},
      playbackState:()=>{if(this.peer===peer){this.refresh(this.enabled);this.hooks.changed();}},
    });
    this.peer=peer;
    if(role==='receiver'){
      this.video.muted=this.hooks.muted();
      this.panel.classList.add('receiving-panel');
      this.canvasSize=[this.canvas.width,this.canvas.height];this.stage.classList.add('receiving-stream');this.video.hidden=false;
    }
    this.hooks.changed();this.refresh(this.enabled);return peer;
  }
  private permission(allowed:boolean) {
    if(this.allowed!==allowed){this.allowed=allowed;this.pointers.clear();this.hooks.clearInput();}
    setText(this.get('stream-permission'),this.receiving?(allowed?t('主机已允许操作。'):this.peer?.authorized?t('主机已允许操作，当前暂不可操作。'):t('接收端仅观看。')):(this.get<HTMLInputElement>('stream-allow').checked?t('接收端可以操作；主机可随时收回控制权。'):t('接收端仅观看。')));
    this.refresh(this.enabled);
    this.hooks.changed();
  }
  private async play() {
    if(!this.receiving)return;
    this.hooks.enableAudio();this.video.muted=false;await this.playMedia(this.peer!);
  }
  private prepareReceive(){this.video.muted=this.hooks.muted();void this.video.play().catch(()=>{});}
  private async playMedia(peer:StreamPeer) {
    if(this.peer!==peer||!this.receiving)return;
    const attempt=++this.playAttempt;
    const current=()=>this.peer===peer&&attempt===this.playAttempt;
    this.video.muted=this.hooks.muted();
    try {
      await this.video.play();if(!current())return;
      this.audioBlocked=this.playbackBlocked=false;
    }catch(error){
      if(!current()||error instanceof DOMException&&error.name==='AbortError')return;
      this.audioBlocked=!this.video.muted;this.playbackBlocked=true;
      if(this.audioBlocked){
        this.video.muted=true;
        try{await this.video.play();if(!current())return;this.playbackBlocked=false;}catch{if(!current())return;}
      }
    }
    this.refresh(this.enabled);
  }
  private async diagnose() {
    const peer=this.peer;
    const output=this.get<HTMLTextAreaElement>('stream-diagnostics');
    output.hidden=false;
    if(!peer){output.value=JSON.stringify({quick:this.quick.diagnostics(),hostReady:this.hooks.canHost(),hostCanStart:this.hooks.canStartHost(),receiverReady:this.hooks.canJoin()},null,2);return;}
    const pc=peer.pc,video=this.video;
    const report:Record<string,unknown>={role:peer.role,connected:peer.connected,connection:pc.connectionState,ice:pc.iceConnectionState,signaling:pc.signalingState,sctp:pc.sctp?.state??'unavailable',network:peer.networkDiagnostics()};
    if(this.receiving)report.player={width:video.videoWidth,height:video.videoHeight,paused:video.paused,muted:video.muted,readyState:video.readyState,error:video.error?.code??null,tracks:peer.received.getTracks().map(track=>({kind:track.kind,state:track.readyState,muted:track.muted}))};
    try {
      const stats=await pc.getStats(),media:unknown[]=[],routes:unknown[]=[];
      stats.forEach(s=>{
        if(s.type===(peer.role==='host'?'outbound-rtp':'inbound-rtp')&&(s.kind??s.mediaType)==='video')media.push({bytes:s.bytesSent??s.bytesReceived??0,frames:s.framesEncoded??s.framesDecoded??0,receivedFrames:s.framesReceived,width:s.frameWidth,height:s.frameHeight,codec:stats.get(s.codecId)?.mimeType});
        if(s.type==='candidate-pair')routes.push({state:s.state,nominated:s.nominated,requestsSent:s.requestsSent??0,responsesReceived:s.responsesReceived??0});
      });
      report.video=media;report.routeChecks=routes;
    }catch{report.stats='unavailable';}
    // Only transport states and counters; never expose SDP, credentials,
    // candidate addresses, or device identifiers in this shareable report.
    if(this.peer===peer)output.value=JSON.stringify(report,null,2);
  }
  private async copy() {
    const output=this.get<HTMLTextAreaElement>('stream-output');
    const text=output.value,generation=this.generation,receiver=this.receiving;
    if(!text)return;
    const success=()=>{
      if(generation!==this.generation)return;
      setText(this.get('stream-copy-status'),receiver?t('接收端回复已复制，请发回主机。'):t('主机连接文本已复制，请发给接收端。'));
    };
    if(isSecureContext&&navigator.clipboard?.writeText){
      try{await navigator.clipboard.writeText(text);success();return;}catch{/* Try the synchronous compatibility path. */}
    }
    if(generation!==this.generation||output.value!==text)return;
    output.focus({preventScroll:true});output.select();output.setSelectionRange(0,text.length);
    // LAN HTTP cannot use the secure-context Clipboard API. Keep this call in
    // the click handler; select-only fallback must never claim it copied.
    try{if(document.execCommand('copy')){success();return;}}catch{/* Manual copy remains available. */}
    setText(this.get('stream-copy-status'),receiver
      ?t('尚未复制到剪贴板。请长按“接收端回复文本”，选择“全选”→“复制”，再发回主机。')
      :t('尚未复制到剪贴板。请长按“主机连接文本”，选择“全选”→“复制”，再发给接收端。'));
  }
  private async run<T>(job:(generation:number)=>Promise<T>) {
    if(this.working||!this.enabled)return;
    this.working=true;this.statusUsed=true;const generation=this.generation;this.refresh(this.enabled);
    try{return await job(generation);}catch(error){if(generation===this.generation){if(error instanceof PairingInputError)this.say(String(error));else if(this.peer)this.peer.close(String(error));else{this.capture?.stop();this.capture=undefined;this.say(String(error));}}}
    finally{if(generation===this.generation)this.working=false;this.refresh(this.enabled);}
  }
  private say(message:string){setText(this.get('stream-state'),message);setText(this.summaryButton,t('串流'));}
  private async stats(peer:StreamPeer) {
    if(this.statsBusy||this.peer!==peer)return;
    this.statsBusy=true;
    try {
      await peer.refreshVideoParameters();
      const stats=await peer.pc.getStats();if(this.peer!==peer)return;
      let video:{frameWidth?:number;frameHeight?:number;framesPerSecond?:number;framesDecoded?:number;framesEncoded?:number;timestamp:number}|undefined,rtt:number|undefined;
      stats.forEach(s=>{
        if(s.type===(this.hosting?'outbound-rtp':'inbound-rtp')&&(s.kind??s.mediaType)==='video')video=s;
        if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)rtt=s.currentRoundTripTime;
      });
      if(video){
        const frames=video.framesDecoded??video.framesEncoded,previous=this.lastVideoStats;
        const fps=video.framesPerSecond??(frames!==undefined&&previous&&video.timestamp>previous.time?Math.max(0,(frames-previous.frames)*1000/(video.timestamp-previous.time)):undefined);
        if(frames!==undefined)this.lastVideoStats={frames,time:video.timestamp};
        setText(this.get('stream-stats'),t('视频：{0} × {1} · {2} FPS · 网络往返：{3} ms',video.frameWidth||(this.receiving&&this.video.videoWidth)||'—',video.frameHeight||(this.receiving&&this.video.videoHeight)||'—',fps===undefined?'—':Math.round(fps),rtt===undefined?'—':Math.round(rtt*1000)));
      }
    }catch{/* A closed transport has no further statistics. */}
    finally{this.statsBusy=false;}
  }
  async withHostMediaRestart(job:()=>Promise<void>){
    const peer=this.role==='host'&&this.peer?.connected?this.peer:undefined;
    if(!peer){await job();return;}
    const generation=this.generation;this.replacingMedia=true;
    this.hooks.clearInput();this.say(t('正在载入游戏，串流将在载入后继续…'));this.refresh(this.enabled);
    try{
      await job();
      if(this.peer!==peer||this.generation!==generation)return;
      const capture=await this.hooks.capture(Number(this.get<HTMLSelectElement>('stream-fps').value),this.controller);
      if(this.peer!==peer||this.generation!==generation){capture.stop();return;}
      this.capture=capture;await peer.replaceMedia(capture.stream);this.say(t('串流已连接'));
    }catch(error){if(this.peer===peer)peer.close(t('游戏载入或串流恢复失败：{0}',String(error)));throw error;}
    finally{this.replacingMedia=false;this.refresh(this.enabled);}
  }
  invalidate(){
    // Starting the frontend replaces its canvas before a QR host has captured
    // any media. That startup invalidation must not cancel its pending pairing.
    if(this.preparingQr&&!this.peer&&!this.capture)return;
    if(this.replacingMedia){this.capture?.stop();this.capture=undefined;return;}
    if(this.peer||this.capture||this.working)this.close();
  }
  close(){if(this.peer)this.peer.close();else if(this.working||this.quick?.pending){void this.quick?.cancel();this.cleanup(t('串流已停止。'));}}
  private cleanup(reason:string) {
    this.quick?.closed(this.peer?.session);
    ++this.generation;this.working=false;clearInterval(this.statsTimer);this.statsTimer=undefined;
    this.quickPending=false;
    ++this.playAttempt;this.audioBlocked=this.playbackBlocked=false;
    this.lastVideoStats=undefined;
    this.peer=undefined;this.role=undefined;this.allowed=false;
    // QR sessions choose the web controller without replacing the user's
    // remembered default for other pairing methods.
    this.controller='retroarch';
    try{if(localStorage.getItem('dingoo-stream:controller')==='web')this.controller='web';}catch{}
    this.qr?.reset();
    this.nativeView=false;this.pointers.clear();this.nextTouchId=0;this.stage.classList.remove('remote-frontend');this.hooks.touches([]);this.hooks.streamSize(0,0);
    this.capture?.stop();this.capture=undefined;
    this.hooks.input({source:'remote',buttons:0,cancel:true});this.hooks.clearInput();
    this.video.pause();this.video.srcObject=null;this.video.hidden=true;this.stage.classList.remove('receiving-stream');this.panel.classList.remove('receiving-panel');
    if(this.canvasSize){[this.canvas.width,this.canvas.height]=this.canvasSize;this.canvasSize=undefined;}
    this.get<HTMLTextAreaElement>('stream-output').value=this.get<HTMLTextAreaElement>('stream-input').value='';
    setText(this.get('stream-input-label'),t('粘贴对方的连接／回复文本'));setText(this.get('stream-output-label'),t('本机连接／回复文本'));
    setText(this.get('stream-copy'),t('复制本机文本'));this.get('stream-copy-status').textContent='';
    this.get('stream-stats').textContent='';this.get('stream-permission').textContent='';
    this.get<HTMLTextAreaElement>('stream-diagnostics').value='';this.get('stream-diagnostics').hidden=true;
    this.get('stream-pair-id').textContent='';this.get('stream-pair-id').hidden=true;
    this.say(reason);this.hooks.changed();this.refresh(this.enabled);
  }
}
