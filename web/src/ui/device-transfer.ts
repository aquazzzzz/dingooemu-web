import {t,setText,literal,localize,onLanguageChange,language} from '../i18n';
import {SaveStore} from '../storage/saves';
import {SnapshotStore,exportSnapshot,importSnapshot,validateSnapshot} from '../storage/snapshots';
import {packGame,unpackGame} from '../transfer/package';
import {TransferPeer,parsePairing,type TransferOffer} from '../transfer/peer';
import {sizeLabel} from './file-manager';

export class DeviceTransfer {
  private peer?:TransferPeer;
  private initiating=false;
  private working=false;
  private enabled=true;
  private offer?:TransferOffer;
  private serial=0;
  private lastProgress=0;
  constructor(private panel:HTMLDetailsElement,private games:SaveStore,private snapshots:SnapshotStore,private changed:()=>Promise<void>){
    panel.innerHTML=`<summary>设备互传</summary>
<p>两台设备连接同一局域网，保持页面在前台。文件直接传到对方，不上传服务器。</p>
<ol class="transfer-steps"><li>设备 A 点击“创建连接”，把本机连接文本完整复制给设备 B。</li><li>设备 B 粘贴文本，点击“加入连接”，再把生成的回复文本发回 A。</li><li>设备 A 粘贴回复，点击“完成配对”。连接后双方均可发送文件。</li></ol>
<p class="transfer-note">连接文本较长，包含本次配对信息，请仅交给接收方。无需账号、短码服务或云存储。</p>
<div class="file-actions"><button id="transfer-create">创建连接</button><button id="transfer-join">加入连接</button><button id="transfer-answer" disabled>完成配对</button><button id="transfer-close" disabled>断开／取消传输</button></div>
<div class="transfer-pairing"><label for="transfer-input">粘贴对方的连接／回复文本</label><textarea id="transfer-input" rows="3" maxlength="64000" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
<label for="transfer-output">本机连接／回复文本</label><textarea id="transfer-output" rows="3" readonly spellcheck="false"></textarea><button id="transfer-copy" disabled>复制本机文本</button></div>
<p id="transfer-state" role="status" aria-live="polite"></p>
<div class="transfer-send"><label for="transfer-items">发送已保存的游戏或即时存档</label><select id="transfer-items"></select><div class="file-actions"><button id="transfer-refresh">刷新列表</button><button id="transfer-send" disabled>发送选中项</button></div></div>
<p>游戏会包含配套资源；即时存档包含保存时的游戏内文件。接收后在“本站文件”或“即时存档”中使用，不会自动运行。</p>
<div id="transfer-incoming" class="transfer-incoming" hidden><p id="transfer-offer"></p><div class="file-actions"><button id="transfer-accept">接收并保存</button><button id="transfer-reject">拒绝</button></div></div>
<progress id="transfer-progress" max="1" value="0" aria-label="传输进度" hidden></progress><p id="transfer-result" role="status" aria-live="polite"></p>
<p class="transfer-note">连接失败时请检查访客 Wi-Fi、设备隔离或浏览器局域网权限。传输中请勿锁屏；中断后需重新发送。</p>`;
    localize(panel);
    this.get('transfer-create').onclick=()=>void this.run(async()=>{
      this.initiating=true;const peer=this.start();this.say(t('正在生成连接文本…'));
      this.get<HTMLTextAreaElement>('transfer-output').value=await peer.create();this.say(t('把本机文本发给对方，等待回复。'));
    });
    this.get('transfer-join').onclick=()=>void this.run(async()=>{
      const description=parsePairing(this.get<HTMLTextAreaElement>('transfer-input').value);
      if(description.type!=='offer')throw new Error(t('请先粘贴发起方的连接文本。'));
      this.initiating=false;const peer=this.start();this.say(t('正在生成连接文本…'));
      this.get<HTMLTextAreaElement>('transfer-output').value=await peer.join(description);this.get<HTMLTextAreaElement>('transfer-input').value='';this.say(t('把本机回复文本发回发起方，等待完成配对。'));
    });
    this.get('transfer-answer').onclick=()=>void this.run(async()=>{
      await this.peer!.answer(parsePairing(this.get<HTMLTextAreaElement>('transfer-input').value));this.get<HTMLTextAreaElement>('transfer-input').value='';this.say(t('正在连接，请保持双方页面在前台…'));
    });
    this.get('transfer-close').onclick=()=>this.close();
    this.get('transfer-copy').onclick=()=>void this.run(async()=>{
      const output=this.get<HTMLTextAreaElement>('transfer-output');
      try {await navigator.clipboard.writeText(output.value);this.result(t('连接文本已复制。'));}
      catch {output.focus();output.select();output.setSelectionRange(0,output.value.length);this.result(t('请长按或使用复制快捷键复制已选中的文本。'));}
    });
    this.get('transfer-refresh').onclick=()=>void this.run(()=>this.refresh());
    this.get<HTMLSelectElement>('transfer-items').onchange=()=>this.controls();
    this.get('transfer-send').onclick=()=>void this.run(async()=>{
      const [kind,id]=this.get<HTMLSelectElement>('transfer-items').value.split(':');
      const peer=this.peer;if(!peer?.connected||peer.busy)return;
      this.result(t('正在准备文件，请稍候…'));
      if(kind==='game'){
        const game=await this.games.loadPackage(id);if(!game)throw new Error(t('没有保存此游戏包，请重新导入游戏。'));
        await peer.send('game',game.name,await packGame(game));
      }else if(kind==='snapshot'){
        const snapshot=await this.snapshots.load(id);await validateSnapshot(snapshot);
        await peer.send('snapshot',snapshot.meta.name,exportSnapshot(snapshot));
      }else return;
      this.progress(0,1);this.result(t('等待对方确认接收…'));
    });
    this.get('transfer-accept').onclick=()=>{if(this.enabled){this.peer?.accept();this.result(t('正在接收，完成后校验并保存…'));this.controls();}};
    this.get('transfer-reject').onclick=()=>this.peer?.reject();
    panel.addEventListener('toggle',()=>{if(panel.open)void this.refresh().catch(e=>this.result(String(e)));});
    onLanguageChange(()=>{void this.refresh().catch(()=>{});if(this.offer)this.renderOffer(this.offer);});
    window.addEventListener('pagehide',()=>this.close());
    if(typeof RTCPeerConnection==='undefined')this.say(t('此浏览器不支持设备互传，请使用新版浏览器。'));
    else this.say(t('尚未连接。'));
    this.controls();
  }
  private get<T extends HTMLElement>(id:string){return this.panel.querySelector<T>('#'+id)!;}
  private say(message:string){setText(this.get('transfer-state'),message);}
  private result(message:string){setText(this.get('transfer-result'),message);}
  private progress(bytes:number,total:number){const now=performance.now();if(bytes>0&&bytes<total&&now-this.lastProgress<100)return;this.lastProgress=now;const progress=this.get<HTMLProgressElement>('transfer-progress');progress.hidden=false;progress.max=total;progress.value=bytes;this.result(t('传输：{0} / {1}；完成后等待对方保存。',sizeLabel(bytes),sizeLabel(total)));}
  private renderOffer(offer:TransferOffer){setText(this.get('transfer-offer'),t('对方想发送：{0} · {1} · {2}',offer.kind==='game'?t('游戏及资源'):t('即时存档'),literal(offer.name),sizeLabel(offer.size)));}
  private start(){
    this.peer?.close();this.get<HTMLTextAreaElement>('transfer-output').value='';this.get<HTMLProgressElement>('transfer-progress').hidden=true;this.result('');
    const peer=new TransferPeer({
      state:(message,connected)=>{this.say(message);if(connected){this.get<HTMLTextAreaElement>('transfer-input').value='';this.get<HTMLTextAreaElement>('transfer-output').value='';}this.controls();},
      progress:(bytes,total)=>this.progress(bytes,total),
      offer:offer=>{
        if(!this.enabled){peer.reject();return;}
        this.offer=offer;this.renderOffer(offer);this.get('transfer-incoming').hidden=false;this.get<HTMLProgressElement>('transfer-progress').hidden=true;this.result(t('请确认是否接收。'));this.controls();
      },
      receive:async(offer,blob)=>{
        if(!this.enabled)throw new Error(t('正在处理，请稍后重试。'));
        this.result(t('正在校验并保存…'));
        if(offer.kind==='snapshot'){
          const snapshot=await importSnapshot(blob);
          if(!this.enabled||!peer.connected)throw new Error(t('连接已关闭。'));
          await this.snapshots.add(snapshot);
        }else{
          const game=await unpackGame(blob);
          if(!this.enabled||!peer.connected)throw new Error(t('连接已关闭。'));
          await this.games.savePackage(game,false);
        }
        // UI refresh errors must not turn an already committed import into failure.
        await this.changed().catch(()=>{});await this.refresh().catch(()=>{});
      },
      finished:message=>{this.result(message);this.controls();},
      cancelled:()=>{this.offer=undefined;this.get('transfer-incoming').hidden=true;this.controls();},
    });
    this.peer=peer;return peer;
  }
  close(){this.peer?.close();this.peer=undefined;this.get<HTMLTextAreaElement>('transfer-output').value='';this.get<HTMLTextAreaElement>('transfer-input').value='';this.controls();}
  setEnabled(value:boolean){this.enabled=value;this.controls();}
  private controls(){
    const peer=this.peer,active=!!peer&&!peer.closed,disabled=this.working||!this.enabled;
    this.get<HTMLButtonElement>('transfer-create').disabled=this.get<HTMLButtonElement>('transfer-join').disabled=disabled||active||typeof RTCPeerConnection==='undefined';
    this.get<HTMLButtonElement>('transfer-answer').disabled=disabled||!active||!this.initiating||!!peer?.connected;
    this.get<HTMLButtonElement>('transfer-close').disabled=!active;
    this.get<HTMLButtonElement>('transfer-copy').disabled=disabled||!this.get<HTMLTextAreaElement>('transfer-output').value;
    this.get<HTMLButtonElement>('transfer-send').disabled=disabled||!peer?.connected||peer.busy||!this.get<HTMLSelectElement>('transfer-items').value;
    this.get<HTMLButtonElement>('transfer-refresh').disabled=disabled;
    this.get<HTMLButtonElement>('transfer-accept').disabled=disabled||!!peer?.receiving;
    this.get<HTMLButtonElement>('transfer-reject').disabled=!!peer?.receiving;
    this.get<HTMLTextAreaElement>('transfer-input').disabled=disabled||!!peer?.connected;
  }
  async refresh(){
    const serial=++this.serial,select=this.get<HTMLSelectElement>('transfer-items'),selected=select.value;
    const [games,snapshots]=await Promise.all([this.games.listPackages(),this.snapshots.list()]);if(serial!==this.serial)return;
    select.replaceChildren();
    for(const game of games)select.add(new Option(`${t('游戏及资源')} · ${game.name} · ${sizeLabel(game.size)}`,'game:'+game.hash));
    for(const snapshot of snapshots)select.add(new Option(`${t('即时存档')} · ${snapshot.name} · ${new Date(snapshot.createdAt).toLocaleString(language())} · ${snapshot.id.slice(0,6)}`,'snapshot:'+snapshot.id));
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    this.controls();
  }
  private async run(job:()=>Promise<void>){
    if(this.working||!this.enabled)return;this.working=true;this.controls();
    try {await job();}catch(error){this.result(String(error));}
    finally {this.working=false;this.controls();}
  }
}
