import {t,literal} from '../i18n';
import {sha256} from './hash';
export interface MountedFile {path:string;bytes:Uint8Array}
export interface GameRecord {hash:string;name:string;revision:number;updatedAt:number;size:number;count:number;deleted?:boolean}
export interface GamePackage {hash:string;name:string;game:Blob;resources:MountedFile[]}
export interface PackageRecord {hash:string;name:string;size:number;updatedAt:number}
export const MAX_SAVE_BYTES=64*1024*1024,MAX_FILES=2048;
export function path(value:string):string {
  if(typeof value!=='string')throw new Error(t("文件路径无效。"));
  const normalized=value.replaceAll('\\','/');
  if(!normalized||normalized.startsWith('/')||normalized.includes('\0')||normalized.includes(':')||normalized.split('/').includes('..'))throw new Error(t("非法相对路径。"));
  const parts=normalized.split('/').filter(v=>v&&v!=='.'),result=parts.join('/');
  if(!result)throw new Error(t("空路径。"));
  if(result.length>4096||parts.length>64||parts.some(v=>v.length>255))throw new Error(t("文件路径过长或目录层级过多。"));
  return result;
}
export function validateFiles(files:MountedFile[],limit=128*1024*1024) {
  if(files.length>MAX_FILES||files.reduce((n,f)=>n+f.bytes.length,0)>limit)throw new Error(t("文件数量或总大小超出限制。"));
  const seen=new Set<string>();for(const file of files){file.path=path(file.path);if(seen.has(file.path))throw new Error(t("重复路径：{0}",literal(file.path)));seen.add(file.path);}
  for(const file of files){const parts=file.path.split('/');parts.pop();while(parts.length){if(seen.has(parts.join('/')))throw new Error(t("文件与目录冲突：{0}",literal(file.path)));parts.pop();}}
}
export const gameHash=sha256;
export class SaveStore {
  private database:Promise<IDBDatabase>;
  private closed=false;
  constructor(private name:string) {this.database=this.connect();}
  private connect():Promise<IDBDatabase> {
    const database=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open(this.name,3);let blocked=false;
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('saves'))db.createObjectStore('saves');
        if(!db.objectStoreNames.contains('games'))db.createObjectStore('games',{keyPath:'hash'});
        if(!db.objectStoreNames.contains('packages'))db.createObjectStore('packages',{keyPath:'hash'});
        if(!db.objectStoreNames.contains('package-meta'))db.createObjectStore('package-meta',{keyPath:'hash'});
      };
      request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>{this.closed=true;request.result.close();};resolve(request.result);};
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>{blocked=true;reject(new Error(t("存档数据库被其他窗口阻塞，请关闭其他窗口后重试。")));};
    });void database.catch(()=>{});return database;
  }
  async close() {this.closed=true;try {(await this.database).close();}catch {}}
  private async db() {
    if(this.closed)throw new Error(t("本站数据正在清除，请刷新页面后再操作。"));
    try {return await this.database;}catch {this.database=this.connect();return this.database;}
  }
  async savePackage(value:GamePackage) {
    validateFiles(value.resources);if(!/^[a-f0-9]{64}$/.test(value.hash)||value.game.size+value.resources.reduce((n,f)=>n+f.bytes.length,0)>128*1024*1024)throw new Error(t("游戏包无效或超过 128 MiB。"));
    const db=await this.db();return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['packages','package-meta'],'readwrite');let error:unknown;
      try {tx.objectStore('packages').put(value);tx.objectStore('package-meta').put({hash:value.hash,name:value.name,size:value.game.size+value.resources.reduce((n,f)=>n+f.bytes.length,0),updatedAt:Date.now()});}catch(cause){error=cause;tx.abort();}
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(error||tx.error);
    });
  }
  async loadPackage(hash:string):Promise<GamePackage|undefined> {
    const db=await this.db();return new Promise((resolve,reject)=>{const req=db.transaction('packages').objectStore('packages').get(hash);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  async listPackages():Promise<PackageRecord[]> {
    const db=await this.db();return new Promise((resolve,reject)=>{const req=db.transaction('package-meta').objectStore('package-meta').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  async removePackage(hash:string) {
    const db=await this.db();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['packages','package-meta'],'readwrite');tx.objectStore('packages').delete(hash);tx.objectStore('package-meta').delete(hash);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
  }
  async list():Promise<GameRecord[]> {
    const db=await this.db();return new Promise((resolve,reject)=>{const req=db.transaction('games').objectStore('games').getAll();req.onsuccess=()=>resolve(req.result.filter((record:GameRecord)=>!record.deleted));req.onerror=()=>reject(req.error);});
  }
  async load(hash:string):Promise<{record:GameRecord|undefined;files:MountedFile[]}> {
    const db=await this.db();return new Promise((resolve,reject)=>{
      const tx=db.transaction(['games','saves']),meta=tx.objectStore('games').get(hash),data=tx.objectStore('saves').get(hash);
      tx.oncomplete=()=>resolve({record:meta.result,files:data.result||[]});tx.onabort=()=>reject(tx.error);
    });
  }
  async replace(hash:string,name:string,files:MountedFile[],expectedRevision:number):Promise<GameRecord> {
    if(!/^[a-f0-9]{64}$/.test(hash))throw new Error(t("游戏身份无效。"));
    validateFiles(files,MAX_SAVE_BYTES);const db=await this.db();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['games','saves'],'readwrite'),games=tx.objectStore('games');let result:GameRecord,error:unknown;
      const req=games.get(hash);req.onsuccess=()=>{
        try {
          if((req.result?.revision??0)!==expectedRevision){error=new Error(t("文件已被其他窗口修改，未覆盖。请先导出当前游戏文件，再重新载入。"));tx.abort();return;}
          result={hash,name,revision:expectedRevision+1,updatedAt:Date.now(),size:files.reduce((n,f)=>n+f.bytes.length,0),count:files.length};
          tx.objectStore('saves').put(files,hash);games.put(result);
        } catch(cause){error=cause;tx.abort();}
      };
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||tx.error||new Error(t("保存事务中止。")));
    });
  }
  async remove(hash:string,expectedRevision:number) {
    const db=await this.db();return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['games','saves'],'readwrite'),games=tx.objectStore('games');let error:unknown;
      const req=games.get(hash);req.onsuccess=()=>{
        try {
          if(req.result?.revision!==expectedRevision){error=new Error(t("文件列表已变化，请刷新列表后重试。"));tx.abort();return;}
          // Keep the revision tombstone so an old tab cannot recreate deleted data.
          games.put({...req.result,deleted:true,revision:expectedRevision+1,size:0,count:0});tx.objectStore('saves').delete(hash);
        } catch(cause){error=cause;tx.abort();}
      };
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(error||tx.error);
    });
  }
}
function base64(bytes:Uint8Array) {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function exportSaves(hash:string,files:MountedFile[]) {validateFiles(files,MAX_SAVE_BYTES);return JSON.stringify({version:1,game:hash,files:files.map(f=>({path:f.path,data:base64(f.bytes)}))});}
export function importSaves(text:string,hash:string):MountedFile[] {
  if(text.length>90*1024*1024)throw new Error(t("存档备份过大。"));
  const data=JSON.parse(text);
  if(data.version!==1||data.game!==hash||!Array.isArray(data.files)||data.files.length>MAX_FILES)throw new Error(t("存档版本或游戏身份不匹配。"));
  const files=data.files.map((f:{path:string;data:string})=>{
    if(typeof f.data!=='string')throw new Error(t("存档文件数据无效。"));
    return {path:path(f.path),bytes:Uint8Array.from(atob(f.data),v=>v.charCodeAt(0))};
  });validateFiles(files,MAX_SAVE_BYTES);return files;
}
