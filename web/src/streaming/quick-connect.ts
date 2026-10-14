import {t,setText,localize} from '../i18n';
import {parsePairing} from './peer';
type Identity={role:'host'|'receiver';token:string};
interface Call {id:string;device:string;state:'requested'|'offered'|'answered'|'connected';offer?:string;answer?:string}
interface Snapshot {kind:Identity['role'];revision:number;approved?:boolean;device?:string;code?:string;devices?:{id:string;approved:boolean}[];call?:Call}
interface Hooks {
  receiveGesture():void;
  canHost():boolean;
  canJoin():boolean;
  activeSession():string|undefined;
  host(session:string):Promise<string>;
  receive(text:string):Promise<string>;
  answer(text:string):Promise<void>;
  close():void;
  progress(message:string):void;
}
class ApiError extends Error {constructor(readonly code:string){super(code);}}
// Remember identities, never SDP. Each connection exchanges fresh descriptions
// through the same LAN server that serves the page.
export class QuickConnect {
  private identity?:Identity;
  private remembered:Partial<Record<Identity['role'],Identity>>={};
  private available=false;
  private epoch=0;
  private session?:string;
  private processed?:string;
  private snapshot?:Snapshot;
  private autoConnect=false;
  private busy=false;
  private connectButtons=new Set<HTMLButtonElement>();
  private pollAbort?:AbortController;
  private key='dingoo-stream:quick:'+location.pathname.replace(/\/[^/]*$/,'/');
  constructor(private panel:HTMLElement,private hooks:Hooks) {
    panel.innerHTML=`<div class="stream-connect-actions"><button id="quick-invite" title="生成连接码" disabled>生成连接码</button><button id="quick-connect" disabled>连接已记住的主机</button></div>
<p id="quick-code" hidden></p><div id="quick-devices"></div>
<div id="quick-pair-form" class="stream-code-entry"><label for="quick-input">输入连接码</label><input id="quick-input" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off"><button id="quick-pair" disabled>记住并连接</button></div><p id="quick-state" role="status" aria-live="polite"></p>
<details class="stream-memory"><summary>连接记忆</summary><button id="quick-forget" disabled>忘记本机连接</button></details>`;
    localize(panel);
    this.get('quick-invite').onclick=()=>void this.run(()=>this.invite());
    this.get('quick-pair').onclick=()=>{this.hooks.receiveGesture();void this.run(async()=>{
      const code=this.get<HTMLInputElement>('quick-input').value.trim();
      if(!/^\d{6}$/.test(code))throw new ApiError('invalid_code');
      const value=await this.api<{token:string}>('pair',{code});await this.suspend();this.remember({role:'receiver',token:value.token});
      this.get<HTMLInputElement>('quick-input').value='';this.autoConnect=true;this.start();
    });};
    this.bindConnectButton(this.get<HTMLButtonElement>('quick-connect'));
    this.get('quick-forget').onclick=()=>void this.run(async()=>{
      try{await this.api('forget');}finally{this.reset();}
    });
    window.addEventListener('pagehide',()=>{++this.epoch;this.pollAbort?.abort();});
    void this.init();
  }
  private get<T extends HTMLElement>(id:string){return this.panel.querySelector<T>('#'+id)!;}
  private say(text:string){setText(this.get('quick-state'),text);}
  private remember(identity:Identity) {
    this.identity=identity;this.remembered[identity.role]=identity;this.persist();
  }
  private persist() {
    try{localStorage.setItem(this.key,JSON.stringify({version:2,activeRole:this.identity?.role,host:this.remembered.host?.token,receiver:this.remembered.receiver?.token}));}catch{this.say(t('浏览器未允许记住设备；关闭页面后需重新配对。'));}
  }
  private async suspend() {
    ++this.epoch;this.pollAbort?.abort();
    if(this.snapshot?.call)await this.api('cancel',{session:this.snapshot.call.id}).catch(()=>{});
    this.session=this.processed=undefined;this.snapshot=undefined;this.autoConnect=false;
    this.get('quick-code').hidden=true;this.get('quick-devices').replaceChildren();
  }
  private async invite() {
    let host=this.remembered.host;
    if(!host){const value=await this.api<{token:string}>('register');host={role:'host',token:value.token};}
    await this.api('invite',{token:host.token});
    if(this.identity?.role!=='host')await this.suspend();
    this.remember(host);this.start();
  }
  private async init() {
    try {
      const response=await fetch('/__stream__/status',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok||(await response.json()).app!=='dingoo-lan-signaling')throw 0;
      this.available=true;
      try{
        const saved=JSON.parse(localStorage.getItem(this.key)||'null');
        if(saved?.version===2){
          for(const role of ['host','receiver'] as const)if(/^[a-f0-9]{64}$/.test(saved[role]))this.remembered[role]={role,token:saved[role]};
          const role=saved.activeRole==='host'?'host':saved.activeRole==='receiver'?'receiver':undefined;
          if(role)this.identity=this.remembered[role];
        }else if(saved&&['host','receiver'].includes(saved.role)&&/^[a-f0-9]{64}$/.test(saved.token)){this.remember(saved);}
      }catch{}
      if(this.identity)this.start();else this.say(t('本机可生成主机短码，也可输入另一台设备的短码。'));
    }catch{this.say(t('连接码与记忆连接需要配对服务；可使用下方二维码或高级选项中的文本配对。'));}
    this.refresh();
  }
  refresh() {
    const role=this.identity?.role;
    this.panel.dataset.role=role??'none';
    const switching=this.busy||!!this.session||!!this.hooks.activeSession()||this.pending;
    for(const id of ['quick-invite','quick-pair'])this.get<HTMLButtonElement>(id).disabled=!this.available||switching;
    const cannotConnect=!this.available||switching||!this.remembered.receiver||role==='receiver'&&!this.snapshot?.approved||!this.hooks.canJoin();
    for(const button of this.connectButtons)button.disabled=cannotConnect;
    this.get<HTMLButtonElement>('quick-forget').disabled=this.busy||!role;
  }
  bindConnectButton(button:HTMLButtonElement,beforeConnect?:()=>void) {
    this.connectButtons.add(button);
    button.onclick=()=>{
      if(button.disabled)return;
      beforeConnect?.();this.hooks.receiveGesture();void this.run(()=>this.connect());
    };
    this.refresh();
  }
  get pending(){return !!this.snapshot?.call&&this.snapshot.call.state!=='connected';}
  diagnostics(){return {role:this.identity?.role??'none',serverAvailable:this.available,approved:this.snapshot?.approved,state:this.snapshot?.call?.state??'idle',processing:this.busy,hostReady:this.hooks.canHost(),receiverReady:this.hooks.canJoin()};}
  async cancel(){
    const call=this.snapshot?.call;if(!call)return;
    await this.api('cancel',{session:call.id}).catch(()=>{});
    if(this.hooks.activeSession()===call.id)this.hooks.close();
    this.session=this.processed=undefined;this.pollAbort?.abort();
  }
  closed(session=this.session) {
    if(!session||session!==this.session||!this.identity)return;
    void this.api('cancel',{session}).catch(()=>{});
    this.session=this.processed=undefined;this.pollAbort?.abort();
  }
  private reset() {
    ++this.epoch;this.pollAbort?.abort();
    if(this.session===this.hooks.activeSession())this.hooks.close();
    if(this.identity)delete this.remembered[this.identity.role];
    this.identity=undefined;this.session=this.processed=undefined;this.snapshot=undefined;this.autoConnect=false;this.persist();
    this.get('quick-code').hidden=true;this.get('quick-devices').replaceChildren();this.say(t('本机连接记忆已清除。'));this.refresh();
  }
  private async api<T=Snapshot>(op:string,data:Record<string,unknown>={},signal?:AbortSignal):Promise<T> {
    const response=await fetch('/__stream__/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,token:this.identity?.token,...data}),signal:signal??AbortSignal.timeout(25000),cache:'no-store'});
    const result=await response.json();if(!response.ok||result.error)throw new ApiError(result.error??'unavailable');return result;
  }
  private async run(job:()=>Promise<unknown>) {
    if(this.busy)return;this.busy=true;this.refresh();
    try{await job();}catch(error){this.error(error);}finally{this.busy=false;this.refresh();}
  }
  private error(error:unknown) {
    const code=error instanceof ApiError?error.code:'unavailable';
    const messages:Record<string,string>={invalid_code:'短码无效或已过期，请在主机生成新短码。',rate_limited:'尝试次数过多，请稍后再试。',host_offline:'主机网页尚未打开，请先在主机打开游戏页面。',host_busy:'主机已有串流，请先停止旧连接。',unauthorized:'设备授权已失效，请重新配对。',capacity:'已记住的设备已达上限，请先移除不用的设备。'};
    this.say(t(messages[code]??'快捷连接暂不可用，请检查局域网服务器。'));
  }
  private start() {const epoch=++this.epoch;this.pollAbort?.abort();this.snapshot=undefined;void this.poll(epoch);}
  private async connect() {
    if(!this.hooks.canJoin()||this.hooks.activeSession())return;
    const receiver=this.remembered.receiver;if(!receiver)return;
    if(this.identity?.role!=='receiver'){
      await this.suspend();this.remember(receiver);this.start();
    }
    const snapshot=await this.api<Snapshot>('poll');this.render(snapshot);
    if(!snapshot.approved)return;
    this.render(await this.api<Snapshot>('connect'));this.processed=undefined;this.pollAbort?.abort();
  }
  private render(snapshot:Snapshot) {
    this.snapshot=snapshot;
    if(snapshot.kind==='host'){
      const code=this.get('quick-code');code.hidden=false;setText(code,snapshot.code?t('主机短码：{0}（10 分钟内有效）',snapshot.code):t('短码已使用或过期，可生成新短码。'));
      const devices=this.get('quick-devices');devices.replaceChildren();
      for(const device of snapshot.devices??[]){
        const row=document.createElement('div');row.className='file-actions';
        const label=document.createElement('span');setText(label,device.approved?t('已记住设备 {0}',device.id.slice(-4).toUpperCase()):t('待确认设备 {0}',device.id.slice(-4).toUpperCase()));row.append(label);
        if(!device.approved){const button=document.createElement('button');setText(button,t('允许并记住'));button.onclick=()=>void this.run(async()=>{await this.api('approve',{device:device.id});this.pollAbort?.abort();});row.append(button);}
        const remove=document.createElement('button');setText(remove,t('移除设备'));remove.onclick=()=>void this.run(async()=>{await this.api('revoke',{device:device.id});this.pollAbort?.abort();});row.append(remove);devices.append(row);
      }
      this.say(snapshot.call?this.progressText(snapshot):this.hooks.canHost()?t('等待另一台设备连接。'):t('主机页面尚未准备好，请保持页面在前台。'));
    }else this.say(snapshot.approved?(snapshot.call?this.progressText(snapshot):t('主机已记住，点击连接即可开始串流。')):t('请在主机确认设备 {0}，允许并记住。',snapshot.device?.slice(-4).toUpperCase()??''));
    this.refresh();
    this.hooks.progress(this.get('quick-state').textContent??'');
  }
  private progressText(snapshot:Snapshot){
    if(snapshot.call?.state==='requested')return t('正在请求主机准备游戏或启动 RetroArch…');
    if(snapshot.call?.state==='offered')return t('主机画面已准备好，正在等待接收端回复…');
    if(snapshot.call?.state==='answered')return t('接收端已回复，正在完成连接…');
    return t('连接信息已交换。');
  }
  private async poll(epoch:number) {
    let revision=-1;
    while(epoch===this.epoch&&this.identity){
      let handling=false;
      try {
        const controller=new AbortController();this.pollAbort=controller;
        const snapshot=await this.api<Snapshot>('poll',{revision,wait:8},controller.signal);
        if(epoch!==this.epoch)return;
        revision=snapshot.revision;this.render(snapshot);
        if(this.session&&!snapshot.call){if(this.hooks.activeSession()===this.session)this.hooks.close();this.session=this.processed=undefined;}
        if(snapshot.kind==='receiver'&&snapshot.approved&&this.autoConnect&&!this.busy){this.autoConnect=false;await this.connect();revision=-1;continue;}
        const call=snapshot.call;
        if(call){
          // Cancellation / stopping a session clears the matching server call.
          if(this.session===call.id&&this.processed===call.id&&!this.hooks.activeSession()){
            await this.api('cancel',{session:call.id});this.session=this.processed=undefined;revision=-1;continue;
          }
          if(snapshot.kind==='host'&&call.state==='requested'&&!this.busy&&this.hooks.canHost()&&!this.hooks.activeSession()){
            handling=true;
            this.session=call.id;
            const offer=await this.hooks.host(call.id);if(epoch!==this.epoch)return;
            await this.api('offer',{session:call.id,text:offer});
          }else if(snapshot.kind==='receiver'&&call.state==='offered'&&!this.busy&&this.processed!==call.id&&this.hooks.canJoin()&&!this.hooks.activeSession()){
            handling=true;
            if(parsePairing(call.offer!).session!==call.id)throw new ApiError('stale_session');
            this.session=call.id;
            const answer=await this.hooks.receive(call.offer!);if(epoch!==this.epoch)return;
            await this.api('answer',{session:call.id,text:answer});this.processed=call.id;
          }else if(snapshot.kind==='host'&&call.state==='answered'&&!this.busy&&this.processed!==call.id&&this.hooks.activeSession()===call.id){
            handling=true;
            await this.hooks.answer(call.answer!);if(epoch!==this.epoch)return;
            this.processed=call.id;await this.api('finish',{session:call.id});
          }
        }
      }catch(error){
        if(epoch!==this.epoch)return;
        if(error instanceof DOMException&&error.name==='AbortError')continue;
        if(error instanceof ApiError&&error.code==='unauthorized'){this.reset();this.error(error);return;}
        if(handling&&this.session){await this.cancel();if(this.hooks.activeSession())this.hooks.close();}
        this.error(error);await new Promise(resolve=>setTimeout(resolve,3000));
      }
    }
  }
}
