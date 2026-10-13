import {t} from '../i18n';
import {sha256} from '../storage/hash';

export const MAX_TRANSFER=193*1024*1024,CHUNK=16*1024;
export interface TransferOffer {id:string;kind:'game'|'snapshot';name:string;size:number;hash:string}
interface Hooks {
  state(message:string,connected:boolean):void;
  progress(bytes:number,total:number):void;
  offer(offer:TransferOffer):void;
  receive(offer:TransferOffer,blob:Blob):Promise<void>;
  finished(message:string):void;
  cancelled():void;
}
interface Incoming {offer:TransferOffer;accepted:boolean;chunks:ArrayBuffer[];bytes:number;finishing:boolean}
interface Outgoing {offer:TransferOffer;blob:Blob;sending:boolean;endSent:boolean}
export function parsePairing(text:string):RTCSessionDescriptionInit {
  if(text.length>64000)throw new Error(t('连接文本无效，请完整复制。'));
  try {
    const value=JSON.parse(text.trim());
    if(value.app!=='dingoo-transfer'||value.version!==1||!['offer','answer'].includes(value.type)||typeof value.sdp!=='string'||value.sdp.length>60000)throw 0;
    return {type:value.type,sdp:value.sdp};
  }catch {throw new Error(t('连接文本无效，请完整复制。'));}
}
export class TransferPeer {
  private pc:RTCPeerConnection;
  private channel?:RTCDataChannel;
  private incoming?:Incoming;
  private outgoing?:Outgoing;
  private stopped=false;
  private timer?:ReturnType<typeof setTimeout>;
  private queue:Promise<void>=Promise.resolve();
  constructor(private hooks:Hooks){
    // Host candidates only: no cloud signaling, STUN, or TURN relay.
    this.pc=new RTCPeerConnection({iceServers:[]});
    this.pc.ondatachannel=e=>{if(this.channel){e.channel.close();return;}this.attach(e.channel);};
    this.pc.onconnectionstatechange=()=>{
      if(this.pc.connectionState==='failed')this.close(t('连接失败，请检查同一局域网及设备隔离设置，再重新配对。'));
      if(this.pc.connectionState==='disconnected'){this.arm();this.hooks.state(t('连接暂时中断，正在等待恢复…'),false);}
      if(this.pc.connectionState==='connected'&&this.connected){if(!this.busy)clearTimeout(this.timer);this.hooks.state(t('已连接，可以双向发送。'),true);}
    };
    this.arm();
  }
  get connected(){return !this.stopped&&this.channel?.readyState==='open';}
  get closed(){return this.stopped;}
  get receiving(){return !!this.incoming?.accepted;}
  get busy(){return !!(this.incoming||this.outgoing);}
  private arm(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.close(t('连接或传输超时，请保持双方页面在前台并重新配对。')),120000);}
  private attach(channel:RTCDataChannel){
    this.channel=channel;channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=256*1024;
    channel.onopen=()=>{clearTimeout(this.timer);this.hooks.state(t('已连接，可以双向发送。'),true);};
    channel.onclose=()=>this.close(t('连接已断开，未完成的接收不会保存。'));
    channel.onerror=()=>this.close(t('连接失败，请检查同一局域网及设备隔离设置，再重新配对。'));
    channel.onmessage=e=>{
      // DataChannel preserves order; async validation/storage must preserve it too.
      this.queue=this.queue.then(()=>this.message(e.data)).catch(error=>this.close(String(error)));
    };
  }
  async create():Promise<string>{
    this.attach(this.pc.createDataChannel('dingoo-files',{ordered:true}));
    await this.pc.setLocalDescription(await this.pc.createOffer());return this.description();
  }
  async join(description:RTCSessionDescriptionInit):Promise<string>{
    if(description.type!=='offer')throw new Error(t('请先粘贴发起方的连接文本。'));
    await this.setRemote(description);await this.pc.setLocalDescription(await this.pc.createAnswer());return this.description();
  }
  async answer(description:RTCSessionDescriptionInit){
    if(description.type!=='answer'||this.pc.signalingState!=='have-local-offer')throw new Error(t('请粘贴接收方生成的回复文本。'));
    await this.setRemote(description);this.arm();
  }
  private async setRemote(description:RTCSessionDescriptionInit){
    // Feed bundled host candidates through the standard candidate API, including mDNS.
    // Pairing still exchanges one complete description in each direction.
    const sections=(description.sdp||'').split(/(?=^m=)/m),candidates:RTCIceCandidateInit[]=[];
    let media=-1;
    for(const section of sections){
      if(!section.startsWith('m='))continue;media++;
      const mid=section.match(/^a=mid:([^\r\n]+)/m)?.[1];
      for(const match of section.matchAll(/^a=(candidate:[^\r\n]+)/gm))candidates.push({candidate:match[1],sdpMid:mid,sdpMLineIndex:media});
    }
    const sdp=(description.sdp||'').replace(/^a=(?:candidate:[^\r\n]*|end-of-candidates)\r?\n/gm,'');
    await this.pc.setRemoteDescription({type:description.type,sdp});
    for(const candidate of candidates)await this.pc.addIceCandidate(candidate);
    await this.pc.addIceCandidate({candidate:''});
  }
  private async description():Promise<string>{
    // Non-trickle ICE: export only once all candidates are in the description.
    await new Promise<void>((resolve,reject)=>{
      const check=()=>{if(this.stopped||this.pc.signalingState==='closed')finish(new Error(t('连接已关闭。')));else if(this.pc.iceGatheringState==='complete')finish();};
      const finish=(error?:Error)=>{clearTimeout(timeout);this.pc.removeEventListener('icegatheringstatechange',check);this.pc.removeEventListener('signalingstatechange',check);error?reject(error):resolve();};
      const timeout=setTimeout(()=>finish(new Error(t('收集连接信息超时，请重新配对。'))),15000);
      this.pc.addEventListener('icegatheringstatechange',check);this.pc.addEventListener('signalingstatechange',check);check();
    });
    if(this.stopped)throw new Error(t('连接已关闭。'));
    const {type,sdp}=this.pc.localDescription!;
    return JSON.stringify({app:'dingoo-transfer',version:1,type,sdp});
  }
  private sendJSON(value:object){if(!this.connected)throw new Error(t('连接已关闭。'));this.channel!.send(JSON.stringify(value));}
  async send(kind:TransferOffer['kind'],name:string,blob:Blob){
    if(!this.connected||this.busy)throw new Error(t('连接未就绪或正在传输。'));
    if(!blob.size||blob.size>MAX_TRANSFER||name.length>4096)throw new Error(t('互传文件过大或无效。'));
    // Reserve the session before hashing so a concurrent offer cannot take it.
    const transfer:Outgoing={offer:{id:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),kind,name,size:blob.size,hash:''},blob,sending:false,endSent:false};this.outgoing=transfer;this.arm();
    try {
      transfer.offer.hash=await sha256(new Uint8Array(await blob.arrayBuffer()));
      if(this.outgoing!==transfer||!this.connected)throw new Error(t('连接已关闭。'));
      this.sendJSON({type:'offer',...transfer.offer});this.arm();
    }catch(error){this.close(String(error));throw error;}
  }
  accept(){
    const incoming=this.incoming;if(!incoming||incoming.accepted)return;
    incoming.accepted=true;this.arm();this.sendJSON({type:'accept',id:incoming.offer.id});
  }
  reject(){
    const incoming=this.incoming;if(!incoming||incoming.accepted)return;
    this.sendJSON({type:'reject',id:incoming.offer.id});this.incoming=undefined;clearTimeout(this.timer);this.hooks.cancelled();this.hooks.finished(t('已拒绝接收。'));
  }
  private async message(data:unknown){
    if(this.stopped)return;
    if(data instanceof ArrayBuffer){
      const incoming=this.incoming;
      if(!incoming?.accepted||incoming.finishing||data.byteLength!==Math.min(CHUNK,incoming.offer.size-incoming.bytes)||!data.byteLength)throw new Error(t('互传数据顺序或大小无效。'));
      incoming.chunks.push(data);incoming.bytes+=data.byteLength;this.arm();this.hooks.progress(incoming.bytes,incoming.offer.size);return;
    }
    if(typeof data!=='string'||data.length>12000)throw new Error(t('互传消息无效。'));
    const message=JSON.parse(data);if(!message||typeof message!=='object')throw new Error(t('互传消息无效。'));
    if(message.type==='offer'){
      if(typeof message.id!=='string'||message.id.length>80||!['game','snapshot'].includes(message.kind)||typeof message.name!=='string'||!message.name.length||message.name.length>4096||!Number.isSafeInteger(message.size)||message.size<=0||message.size>MAX_TRANSFER||typeof message.hash!=='string'||!/^[a-f0-9]{64}$/.test(message.hash))throw new Error(t('互传文件过大或无效。'));
      if(this.busy){this.sendJSON({type:'reject',id:message.id});return;}
      this.incoming={offer:message,accepted:false,chunks:[],bytes:0,finishing:false};this.arm();this.hooks.offer(message);return;
    }
    const outgoing=this.outgoing,incoming=this.incoming;
    if(message.type==='accept'&&outgoing&&message.id===outgoing.offer.id&&!outgoing.sending){
      outgoing.sending=true;void this.pump(outgoing).catch(error=>this.close(String(error)));return;
    }
    if(message.type==='reject'&&outgoing&&message.id===outgoing.offer.id&&!outgoing.sending){
      this.outgoing=undefined;clearTimeout(this.timer);this.hooks.finished(t('对方拒绝接收或正在传输。'));return;
    }
    if(message.type==='done'&&outgoing&&message.id===outgoing.offer.id&&outgoing.endSent){
      this.outgoing=undefined;clearTimeout(this.timer);this.hooks.finished(t('对方已校验并保存。'));return;
    }
    if(message.type==='end'&&incoming?.accepted&&message.id===incoming.offer.id&&!incoming.finishing){
      if(incoming.bytes!==incoming.offer.size)throw new Error(t('互传文件不完整，未保存。'));
      incoming.finishing=true;const blob=new Blob(incoming.chunks);incoming.chunks=[];
      if(await sha256(new Uint8Array(await blob.arrayBuffer()))!==incoming.offer.hash)throw new Error(t('互传校验失败，未保存。'));
      if(this.stopped)return;
      await this.hooks.receive(incoming.offer,blob);
      // A disconnect during the atomic storage commit cannot undo a saved file.
      if(this.stopped)return;
      this.sendJSON({type:'done',id:incoming.offer.id});this.incoming=undefined;clearTimeout(this.timer);this.hooks.cancelled();this.hooks.finished(t('已校验并保存到本机。'));return;
    }
    throw new Error(t('互传消息无效。'));
  }
  private async pump(outgoing:Outgoing){
    const channel=this.channel!;
    for(let offset=0;offset<outgoing.blob.size;offset+=CHUNK){
      while(channel.bufferedAmount>1024*1024){
        if(!this.connected||this.outgoing!==outgoing)throw new Error(t('连接已关闭。'));
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      const bytes=await outgoing.blob.slice(offset,offset+CHUNK).arrayBuffer();
      if(!this.connected||this.outgoing!==outgoing)throw new Error(t('连接已关闭。'));
      channel.send(bytes);this.arm();this.hooks.progress(Math.min(offset+CHUNK,outgoing.blob.size),outgoing.blob.size);
    }
    outgoing.endSent=true;this.sendJSON({type:'end',id:outgoing.offer.id});
  }
  close(message=t('连接已断开，未完成的接收不会保存。')){
    if(this.stopped)return;this.stopped=true;clearTimeout(this.timer);this.incoming=undefined;this.outgoing=undefined;
    this.channel?.close();this.pc.close();this.hooks.cancelled();this.hooks.state(message,false);
  }
}
