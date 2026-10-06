import {t,setText,localize,onLanguageChange,language} from '../i18n';
import {SnapshotStore,createSnapshot,validateSnapshot,exportSnapshot,importSnapshot,type Snapshot,type SnapshotMeta} from '../storage/snapshots';
import type {MountedFile} from '../storage/saves';
import {download,sizeLabel} from './file-manager';
export interface SnapshotIdentity {hash:string;name:string;resources:string}
interface Hooks {
  operate(job:()=>Promise<void>):Promise<void>;
  current():SnapshotIdentity|undefined;
  capture(save:(state:Uint8Array,files:MountedFile[],frames:number)=>Promise<void>):Promise<void>;
  restore(snapshot:Snapshot):Promise<void>;
}
export class SnapshotManager {
  private selected:HTMLSelectElement;
  private filter:HTMLSelectElement;
  private message:HTMLElement;
  private records:SnapshotMeta[]=[];
  private enabled=true;
  private busy=false;
  private serial=0;
  constructor(private panel:HTMLDetailsElement,private store:SnapshotStore,private hooks:Hooks,private saveButton:HTMLButtonElement,private loadButton:HTMLButtonElement,private quickStatus:HTMLElement) {
    panel.innerHTML=`<summary>即时存档</summary><p>保存当前执行进度和游戏写出的文件。每次保存新增一个存档；读档后直接继续运行。</p><label for="snapshot-filter">游戏</label><select id="snapshot-filter"><option value="">全部游戏</option></select><label for="snapshot-items">存档</label><select id="snapshot-items" aria-label="选择即时存档"></select><p id="snapshot-info"></p><div class="file-actions"><button id="snapshot-create">新增即时存档</button><button id="snapshot-restore">读取选中存档</button><button id="snapshot-refresh">刷新列表</button><label class="import-button">导入即时存档<input id="snapshot-import" type="file"></label><button id="snapshot-export">导出</button><button id="snapshot-delete">删除选中存档</button><button id="snapshot-clear">清空列表中的存档</button></div><p id="snapshot-message" role="status" aria-live="polite"></p><p id="snapshot-capacity"></p>`;
    localize(panel);
    this.selected=this.get('snapshot-items');this.filter=this.get('snapshot-filter');this.message=this.get('snapshot-message');
    this.selected.onchange=()=>this.controls();this.filter.onchange=()=>this.render();
    saveButton.onclick=()=>void this.run(()=>this.save());this.get('snapshot-create').onclick=saveButton.onclick;
    loadButton.onclick=()=>void this.run(async()=>{const game=this.hooks.current(),latest=this.records.find(s=>s.game===game?.hash&&s.resources===game?.resources);if(!latest)throw new Error(t("当前游戏没有匹配的即时存档。"));await this.restore(latest.id);});
    this.get('snapshot-restore').onclick=()=>void this.run(()=>this.restore(this.selected.value));
    this.get('snapshot-refresh').onclick=()=>void this.run(()=>this.refresh());
    this.get('snapshot-export').onclick=()=>void this.run(async()=>{const value=await this.store.load(this.selected.value);await validateSnapshot(value);download(value.meta.name.split('/').pop()!+'-'+new Date(value.meta.createdAt).toISOString().replaceAll(':','-')+'.dingoo-state',exportSnapshot(value));this.say(t("即时存档已导出。"));});
    this.get('snapshot-delete').onclick=()=>void this.run(async()=>{const id=this.selected.value;if(!id||!confirm(t("删除选中的即时存档？请先导出备份。")))return;await this.store.remove([id]);await this.refresh();this.say(t("即时存档已删除。"));});
    this.get('snapshot-clear').onclick=()=>void this.run(async()=>{const ids=this.visible().map(s=>s.id);if(!ids.length||!confirm(t("清空当前列表中的 {0} 个即时存档？请先导出备份。",ids.length)))return;await this.store.remove(ids);await this.refresh();this.say(t("列表中的即时存档已清空。"));});
    this.get<HTMLInputElement>('snapshot-import').onchange=e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(file)void this.run(async()=>{const value=await importSnapshot(file);await this.store.add(value);this.filter.value='';await this.refresh(value.meta.id);this.say(t("即时存档已导入。运行匹配的游戏和资源后可读取。"));});};
    panel.addEventListener('toggle',()=>{if(panel.open)void this.refresh().catch(e=>this.say(String(e)));});
    onLanguageChange(()=>{void this.refresh(this.selected.value).catch(()=>{});});
    void this.refresh().catch(e=>this.say(String(e)));
  }
  private say(value:string){setText(this.message,value);setText(this.quickStatus,value);}
  private get<T extends HTMLElement>(id:string){return this.panel.querySelector<T>('#'+id)!;}
  setEnabled(enabled:boolean){this.enabled=enabled;this.controls();}
  private visible(){return this.records.filter(s=>!this.filter.value||s.game===this.filter.value);}
  private controls() {
    const current=this.hooks.current(),selected=this.records.find(s=>s.id===this.selected.value),disabled=!this.enabled||this.busy;
    for(const node of this.panel.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select'))node.disabled=disabled;
    this.saveButton.disabled=this.get<HTMLButtonElement>('snapshot-create').disabled=disabled||!current;
    this.loadButton.disabled=disabled||!this.records.some(s=>s.game===current?.hash&&s.resources===current?.resources);
    this.get<HTMLButtonElement>('snapshot-restore').disabled=disabled||!selected||selected.game!==current?.hash||selected.resources!==current?.resources;
    for(const id of ['snapshot-export','snapshot-delete'])this.get<HTMLButtonElement>(id).disabled=disabled||!selected;
    this.get<HTMLButtonElement>('snapshot-clear').disabled=disabled||!this.visible().length;
    setText(this.get('snapshot-info'),selected?t("{0} · {1} · 核心版本 {2} · {3}",new Date(selected.createdAt).toLocaleString(language()),sizeLabel(selected.size),selected.coreVersion,selected.game===current?.hash&&selected.resources===current?.resources?t("匹配当前游戏"):t("请运行匹配的游戏及资源")):t("尚无即时存档。运行游戏后点击“即时存档”。"));
  }
  private render(preferred?:string) {
    const selected=preferred||this.selected.value;this.selected.replaceChildren();
    for(const entry of this.visible())this.selected.add(new Option(`${entry.name} · ${new Date(entry.createdAt).toLocaleString(language())} · ${entry.id.slice(0,6)}`,entry.id));
    if(this.visible().some(s=>s.id===selected))this.selected.value=selected;this.controls();
  }
  async refresh(preferred?:string) {
    const serial=++this.serial,records=await this.store.list();if(serial!==this.serial)return;this.records=records;
    const filter=this.filter.value,groups=new Map(records.map(s=>[s.game,s.name]));this.filter.replaceChildren(new Option(t("全部游戏"),''));
    for(const [hash,name] of groups)this.filter.add(new Option(`${name} · ${hash.slice(0,8)}`,hash));if(groups.has(filter))this.filter.value=filter;
    this.render(preferred);setText(this.get('snapshot-capacity'),t("{0} 个即时存档 · {1}",records.length,sizeLabel(records.reduce((n,s)=>n+s.size,0))));
  }
  private async run(job:()=>Promise<void>) {
    if(this.busy||!this.enabled)return;this.busy=true;this.controls();
    try {await this.hooks.operate(async()=>{try{await job();}catch(e){this.say(String(e));}});}finally {this.busy=false;this.controls();}
  }
  private async save() {
    const game=this.hooks.current();if(!game)throw new Error(t("请先运行游戏。"));this.say(t("正在保存即时存档…"));
    let saved:Snapshot|undefined;
    await this.hooks.capture(async(state,files,frames)=>{saved=await createSnapshot(game.hash,game.name,game.resources,state,files,frames);await this.store.add(saved);});
    this.filter.value='';await this.refresh(saved!.meta.id);this.say(t("即时存档已保存。"));
  }
  private async restore(id:string) {
    const snapshot=await this.store.load(id),game=this.hooks.current();
    if(!game||snapshot.meta.game!==game.hash||snapshot.meta.resources!==game.resources)throw new Error(t("即时存档与当前游戏或资源不匹配。"));
    await validateSnapshot(snapshot);this.say(t("正在读取即时存档…"));await this.hooks.restore(snapshot);this.say(t("即时读档完成，游戏已继续运行。"));
  }
}
