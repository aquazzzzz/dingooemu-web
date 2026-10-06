import {t} from '../i18n';
import {sha256} from './hash';
import {path,validateFiles,MAX_SAVE_BYTES,type MountedFile} from './saves';
import type {GameImport} from './import';
export const STATE_VERSION=4,MAX_STATE_BYTES=128*1024*1024;
export interface SnapshotMeta {
  id:string;version:1;coreVersion:number;game:string;name:string;resources:string;
  createdAt:number;size:number;stateSize:number;stateHash:string;frames:number;
  files:{path:string;size:number;hash:string}[];
}
export interface Snapshot {meta:SnapshotMeta;state:Uint8Array;files:MountedFile[]}
export function stateLength(state:Uint8Array) {
  if(state.length<32||![68,73,78,71,83,84,65,84].every((v,i)=>state[i]===v))throw new Error(t("即时存档核心数据无效。"));
  const view=new DataView(state.buffer,state.byteOffset,state.byteLength),capacity=state.length>48*1024*1024?MAX_STATE_BYTES:48*1024*1024;
  const end=32+view.getUint32(16,true);
  if(view.getUint32(8,true)!==STATE_VERSION||end>state.length||end>capacity||end<=32||view.getUint32(20,true)>256*1024*1024)throw new Error(t("即时存档核心版本或长度不匹配。"));
  return end;
}
export async function resourceIdentity(game:GameImport) {
  const manifest=[];for(const file of [...game.resources].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0))manifest.push([file.path,await sha256(file.bytes)]);
  return sha256(new TextEncoder().encode(JSON.stringify({name:game.name,files:manifest})));
}
function id(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
export async function createSnapshot(game:string,name:string,resources:string,state:Uint8Array,files:MountedFile[],frames:number):Promise<Snapshot> {
  const end=stateLength(state);if(end!==state.length)state=state.slice(0,end);validateFiles(files,MAX_SAVE_BYTES);
  const manifest=[];for(const file of files)manifest.push({path:file.path,size:file.bytes.length,hash:await sha256(file.bytes)});
  return {meta:{id:id(),version:1,coreVersion:STATE_VERSION,game,name,resources,createdAt:Date.now(),size:state.length+files.reduce((n,f)=>n+f.bytes.length,0),stateSize:state.length,stateHash:await sha256(state),frames,files:manifest},state,files};
}
export async function validateSnapshot(value:Snapshot) {
  const {meta,state,files}=value;
  const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  if(meta.version!==1||meta.coreVersion!==STATE_VERSION||!hash(meta.game)||!hash(meta.resources)||!hash(meta.stateHash)||typeof meta.name!=='string'||meta.name.length>4096||!Number.isFinite(meta.createdAt)||!Number.isFinite(meta.frames)||meta.frames<0||!Array.isArray(meta.files)||meta.files.length!==files.length||state.length!==meta.stateSize||stateLength(state)!==state.length)throw new Error(t("即时存档版本、身份或长度无效。"));
  validateFiles(files,MAX_SAVE_BYTES);
  if(meta.size!==state.length+files.reduce((n,f)=>n+f.bytes.length,0)||await sha256(state)!==meta.stateHash)throw new Error(t("即时存档完整性校验失败。"));
  for(let i=0;i<files.length;i++){const f=files[i],m=meta.files[i];if(m.path!==f.path||m.size!==f.bytes.length||!hash(m.hash)||await sha256(f.bytes)!==m.hash)throw new Error(t("即时存档文件完整性校验失败。"));}
}
const MAGIC=new TextEncoder().encode('DINGOOQ1');
export function exportSnapshot(value:Snapshot):Blob {
  const header=new TextEncoder().encode(JSON.stringify(value.meta)),prefix=new Uint8Array(12);prefix.set(MAGIC);new DataView(prefix.buffer).setUint32(8,header.length,true);
  return new Blob([prefix,header,new Uint8Array(value.state),...value.files.map(f=>new Uint8Array(f.bytes))],{type:'application/octet-stream'});
}
export async function importSnapshot(blob:Blob):Promise<Snapshot> {
  if(blob.size>MAX_STATE_BYTES+MAX_SAVE_BYTES+1024*1024||blob.size<12)throw new Error(t("即时存档文件大小无效。"));
  const prefix=new Uint8Array(await blob.slice(0,12).arrayBuffer()),headerSize=new DataView(prefix.buffer).getUint32(8,true);
  if(!MAGIC.every((v,i)=>prefix[i]===v)||headerSize>1024*1024||headerSize+12>blob.size)throw new Error(t("即时存档文件格式无效。"));
  const meta=JSON.parse(await blob.slice(12,12+headerSize).text()) as SnapshotMeta;
  if(!Number.isSafeInteger(meta.stateSize)||meta.stateSize<32||meta.stateSize>MAX_STATE_BYTES||!Array.isArray(meta.files)||meta.files.length>2048)throw new Error(t("即时存档数据长度无效。"));
  let offset=12+headerSize;const state=new Uint8Array(await blob.slice(offset,offset+meta.stateSize).arrayBuffer());offset+=meta.stateSize;
  const files:MountedFile[]=[];let total=0;
  for(const entry of meta.files){if(!Number.isSafeInteger(entry.size)||entry.size<0||(total+=entry.size)>MAX_SAVE_BYTES||offset+entry.size>blob.size)throw new Error(t("即时存档文件长度无效。"));files.push({path:path(entry.path),bytes:new Uint8Array(await blob.slice(offset,offset+entry.size).arrayBuffer())});offset+=entry.size;}
  if(offset!==blob.size)throw new Error(t("即时存档存在多余或缺失的数据。"));
  const result={meta:{...meta,id:id()},state,files};await validateSnapshot(result);return result;
}
export class SnapshotStore {
  private db:Promise<IDBDatabase>;
  constructor(name:string){this.db=new Promise((resolve,reject)=>{const req=indexedDB.open(name,1);req.onupgradeneeded=()=>{req.result.createObjectStore('meta',{keyPath:'id'});req.result.createObjectStore('data',{keyPath:'meta.id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});void this.db.catch(()=>{});}
  async list():Promise<SnapshotMeta[]> {const db=await this.db;return new Promise((resolve,reject)=>{const req=db.transaction('meta').objectStore('meta').getAll();req.onsuccess=()=>resolve(req.result.sort((a:SnapshotMeta,b:SnapshotMeta)=>b.createdAt-a.createdAt));req.onerror=()=>reject(req.error);});}
  async load(id:string):Promise<Snapshot> {const db=await this.db;return new Promise((resolve,reject)=>{const req=db.transaction('data').objectStore('data').get(id);req.onsuccess=()=>req.result?resolve(req.result):reject(new Error(t("即时存档已被删除，请刷新列表。")));req.onerror=()=>reject(req.error);});}
  async add(value:Snapshot) {await validateSnapshot(value);const db=await this.db;return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['meta','data'],'readwrite');let error:unknown;try{tx.objectStore('meta').add(value.meta);tx.objectStore('data').add(value);}catch(e){error=e;tx.abort();}tx.oncomplete=()=>resolve();tx.onabort=()=>reject(error||tx.error);});}
  async remove(ids:string[]) {const db=await this.db;return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['meta','data'],'readwrite');for(const id of ids){tx.objectStore('meta').delete(id);tx.objectStore('data').delete(id);}tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}
}

