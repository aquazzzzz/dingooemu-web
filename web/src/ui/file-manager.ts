import {t,setText,literal,localize,onLanguageChange,language} from '../i18n';
import {SaveStore,exportSaves,importSaves,validateFiles,MAX_SAVE_BYTES,type MountedFile,type GameRecord} from '../storage/saves';
import {readFiles,unzip} from '../storage/import';
export const sizeLabel=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KiB`:`${(bytes/1048576).toFixed(1)} MiB`;
export function download(name:string,data:Blob) {
  const url=URL.createObjectURL(data),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
interface Hooks {
  operate(job:()=>Promise<void>):Promise<void>;
  currentHash():string|undefined;
  currentFiles():MountedFile[];
  sync():Promise<void>;
  stop(hash:string):Promise<void>;
  play(hash:string):Promise<void>;
}
export class FileManager {
  private selected:HTMLSelectElement;
  private list:HTMLUListElement;
  private message:HTMLElement;
  private games:GameRecord[]=[];
  private packages=new Set<string>();
  private enabled=true;
  private busy=false;
  private serial=0;
  constructor(private element:HTMLDetailsElement,private store:SaveStore,private hooks:Hooks) {
    element.innerHTML=`<summary>本站文件</summary><p>导入的游戏、资源和游戏写出的文件保存在当前网址的浏览器中。选择已保存的游戏后可直接运行。修改当前游戏的文件会先停止游戏。</p>
<label class="managed-label" for="managed-games">游戏</label><div class="game-library-choice"><select id="managed-games" aria-label="选择游戏文件空间"></select><button id="files-play">运行</button></div><p id="managed-summary"></p><ul id="managed-files" class="managed-files"></ul>
<div class="file-actions"><button id="files-refresh">刷新列表</button><button id="files-retry">重试保存</button><button id="files-export">导出备份</button><button id="files-export-current">导出当前文件</button><label class="import-button">导入文件 / 备份<input id="files-import" type="file" multiple></label><!-- Folder import temporarily disabled. <label class="import-button">导入文件夹<input id="files-folder" type="file" webkitdirectory multiple></label> --><button id="files-remove-game">删除此游戏的全部文件</button><button id="files-remove-package">移除本地游戏</button></div><p id="files-message" role="status" aria-live="polite"></p><p id="files-capacity"></p>`;
    localize(element);
    this.selected=this.get('managed-games');this.list=this.get('managed-files');this.message=this.get('files-message');
    this.selected.onchange=()=>void this.run(()=>this.refresh());
    this.get<HTMLButtonElement>('files-play').onclick=()=>void this.run(async()=>{await this.hooks.play(this.selected.value);setText(this.message,t("游戏已载入。"));});
    this.get<HTMLButtonElement>('files-remove-package').onclick=()=>void this.run(async()=>{const hash=this.selected.value;if(!hash||!confirm(t("移除此游戏及资源的本地副本？游戏内存档和即时存档会保留。")))return;await this.store.removePackage(hash);await this.refresh(hash);setText(this.message,t("本地游戏已移除，可重新导入。"));});
    this.get<HTMLButtonElement>('files-refresh').onclick=()=>void this.run(async()=>{await this.hooks.sync();await this.refresh();});
    this.get<HTMLButtonElement>('files-retry').onclick=()=>void this.run(async()=>{await this.hooks.sync();await this.refresh();});
    this.get<HTMLButtonElement>('files-export').onclick=()=>void this.run(()=>this.backup(this.selected.value));
    this.get<HTMLButtonElement>('files-export-current').onclick=()=>void this.run(()=>this.backup(this.hooks.currentHash()||''));
    this.get<HTMLButtonElement>('files-remove-game').onclick=()=>void this.run(async()=>{
      const hash=this.selected.value;if(!hash||!confirm(t("删除此游戏的全部本站文件？请先导出备份。")))return;
      await this.hooks.stop(hash);const {record}=await this.store.load(hash);
      if(record)await this.store.remove(hash,record.revision);
      await this.refresh();setText(this.message,t("此游戏的本站文件已删除。"));
    });
    for(const [id,folder] of [['files-import',false],['files-folder',true]] as const){
      const input=this.get<HTMLInputElement>(id);if(!input)continue;
      input.onchange=()=>{const picked=Array.from(input.files||[]);input.value='';if(picked.length)void this.run(()=>this.import(picked,folder));};
    }
    element.addEventListener('toggle',()=>{if(element.open)void this.run(()=>this.refresh());});
    onLanguageChange(()=>{void this.refresh(this.selected.value).catch(()=>{});});
    void this.refresh().catch(error=>{setText(this.message,String(error));});
  }
  private get<T extends HTMLElement>(id:string){return this.element.querySelector<T>('#'+id)!;}
  setEnabled(value:boolean){this.enabled=value;this.controls();}
  private controls() {
    for(const node of this.element.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select'))node.disabled=!this.enabled||this.busy;
    const noGame=!this.selected.value;
    for(const id of ['files-export','files-import','files-folder','files-remove-game']){const control=this.get<HTMLButtonElement>(id);if(control)control.disabled||=noGame;}
    for(const id of ['files-export-current','files-retry'])this.get<HTMLButtonElement>(id).disabled||=!this.hooks.currentHash();
    for(const id of ['files-play','files-remove-package'])this.get<HTMLButtonElement>(id).disabled||=!this.packages.has(this.selected.value);
  }
  private async run(job:()=>Promise<void>) {
    if(this.busy||!this.enabled)return;this.busy=true;this.controls();
    try {await this.hooks.operate(async()=>{try {await job();}catch(error){setText(this.message,String(error));}});}
    finally {this.busy=false;this.controls();}
  }
  async refresh(preferred?:string) {
    const serial=++this.serial,selected=preferred||this.selected.value,[records,packages]=await Promise.all([this.store.list(),this.store.listPackages()]);
    if(serial!==this.serial)return;
    this.packages=new Set(packages.map(p=>p.hash));
    const combined=new Map(records.map(record=>[record.hash,record]));for(const pkg of packages)if(!combined.has(pkg.hash))combined.set(pkg.hash,{...pkg,revision:0,size:0,count:0});
    this.games=[...combined.values()].sort((a,b)=>b.updatedAt-a.updatedAt);this.selected.replaceChildren();
    for(const record of this.games)this.selected.add(new Option(`${record.name} · ${record.hash.slice(0,8)}`,record.hash));
    if(this.games.some(record=>record.hash===selected))this.selected.value=selected;
    this.list.replaceChildren();this.controls();
    setText(this.get('files-capacity'),t("游戏文件：{0} · 本地游戏及资源：{1} · {2} 个游戏",sizeLabel(records.reduce((sum,record)=>sum+record.size,0)),sizeLabel(packages.reduce((sum,pkg)=>sum+pkg.size,0)),this.games.length));
    setText(this.get('managed-summary'),this.games.length?t("打开面板查看文件。"):t("尚无游戏文件记录。导入游戏后建立独立的文件空间。"));
    if(!this.element.open||!this.selected.value)return;
    const {record,files}=await this.store.load(this.selected.value);
    if(serial!==this.serial)return;
    setText(this.get('managed-summary'),t("{0}{1}",record&&!record.deleted?t("{0} 个文件 · {1} · {2}",files.length,sizeLabel(record.size),new Date(record.updatedAt).toLocaleString(language())):t("尚无游戏内文件。"),this.packages.has(this.selected.value)?t(" · 游戏已保存，可直接运行。"):t(" · 旧记录没有游戏副本，请重新导入游戏以启用运行。")));
    if(!files.length)setText(this.list,t("尚未产生游戏内存档或其他文件。"));
    for(const file of files){
      const row=document.createElement('li'),name=document.createElement('span'),size=document.createElement('small'),save=document.createElement('button'),remove=document.createElement('button');
      name.textContent=file.path;size.textContent=sizeLabel(file.bytes.length);setText(save,t("导出"));setText(remove,t("删除"));row.dataset.path=file.path;
      save.onclick=()=>void this.run(async()=>{
        const source=this.selected.value===this.hooks.currentHash()?this.hooks.currentFiles():(await this.store.load(this.selected.value)).files;
        const current=source.find(f=>f.path===file.path);if(!current)throw new Error(t("文件已变化，请刷新列表。"));
        download(file.path.split('/').pop()!,new Blob([new Uint8Array(current.bytes)]));
      });
      remove.onclick=()=>void this.run(async()=>{
        const hash=this.selected.value;if(!confirm(t("删除 {0}？",literal(file.path))))return;
        await this.hooks.stop(hash);const latest=await this.store.load(hash);if(!latest.record)return;
        await this.store.replace(hash,latest.record.name,latest.files.filter(f=>f.path!==file.path),latest.record.revision);
        await this.refresh(hash);setText(this.message,t("文件已删除。"));
      });
      row.append(name,size,save,remove);this.list.append(row);
    }
    this.controls();
    try {
      const estimate=await navigator.storage?.estimate();if(serial!==this.serial)return;
      if(estimate?.quota)setText(this.get('files-capacity'),t("{0}{1}",this.get('files-capacity').textContent,t(" · 浏览器存储约 {0} / {1}（含离线缓存）",sizeLabel(estimate.usage||0),sizeLabel(estimate.quota))));
    } catch { /* Capacity is optional; file operations still work. */ }
  }
  private async backup(hash:string) {
    if(!hash)return;const {record,files}=await this.store.load(hash);
    const current=hash===this.hooks.currentHash()?this.hooks.currentFiles():files;
    const name=record?.name.split('/').pop()||'game';
    download(name+'.dingoo-saves.json',new Blob([exportSaves(hash,current)],{type:'application/json'}));
    setText(this.message,t("已导出游戏文件备份。"));
  }
  private async import(input:File[],folder:boolean) {
    const hash=this.selected.value;if(!hash)throw new Error(t("请先选择游戏。"));
    let incoming:MountedFile[];
    if(input.length===1&&/\.dingoo-saves\.json$/i.test(input[0].name)){
      if(input[0].size>90*1024*1024)throw new Error(t("备份文件过大。"));
      incoming=importSaves(await input[0].text(),hash);
    } else if(input.length===1&&/\.zip$/i.test(input[0].name)){
      if(input[0].size>128*1024*1024)throw new Error(t("ZIP 文件过大。"));
      incoming=await unzip(new Uint8Array(await input[0].arrayBuffer()));
    } else incoming=await readFiles(input,folder);
    validateFiles(incoming,MAX_SAVE_BYTES);
    if(incoming.some(file=>file.path==='dingooemu-diagnostic.txt'))throw new Error(t("诊断文件不属于游戏存档。"));
    const before=await this.store.load(hash);
    if(incoming.some(f=>before.files.some(old=>old.path===f.path))&&!confirm(t("将覆盖同名的本站文件。继续导入？")))return;
    await this.hooks.stop(hash);const latest=await this.store.load(hash);const name=latest.record?.name||this.games.find(g=>g.hash===hash)?.name;if(!name)throw new Error(t("游戏记录已变化，请刷新列表。"));
    if(latest.record?.revision!==before.record?.revision&&hash!==this.hooks.currentHash()&&incoming.some(f=>latest.files.some(old=>old.path===f.path))&&!confirm(t("文件列表刚刚变化，仍要覆盖同名文件？")))return;
    const merged=new Map(latest.files.map(file=>[file.path,file]));for(const file of incoming)merged.set(file.path,file);
    await this.store.replace(hash,name,[...merged.values()],latest.record?.revision??0);
    await this.refresh(hash);setText(this.message,t("文件已导入，运行游戏即可使用。"));
  }
}

