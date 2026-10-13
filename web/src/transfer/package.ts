import {t} from '../i18n';
import {gameHash,path,validateFiles,type GamePackage} from '../storage/saves';
import {isGame} from '../storage/import';

const LIMIT=128*1024*1024,HEADER_LIMIT=1024*1024;
const magic=new TextEncoder().encode('DINGOOP1');
// A binary envelope preserves paths and resources without Base64 expansion.
export async function packGame(game:GamePackage):Promise<Blob> {
  const files=[{path:game.name,bytes:new Uint8Array(await game.game.arrayBuffer())},...game.resources];
  validateFiles(files,LIMIT);
  if(!isGame(game.name)||await gameHash(files[0].bytes)!==game.hash)throw new Error(t('游戏包无效或超过 128 MiB。'));
  const header=new TextEncoder().encode(JSON.stringify({version:1,hash:game.hash,files:files.map(f=>({path:f.path,size:f.bytes.length}))}));
  if(header.length>HEADER_LIMIT)throw new Error(t('文件数量或总大小超出限制。'));
  const prefix=new Uint8Array(12);prefix.set(magic);new DataView(prefix.buffer).setUint32(8,header.length,true);
  return new Blob([prefix,header,...files.map(f=>new Uint8Array(f.bytes))]);
}
export async function unpackGame(blob:Blob):Promise<GamePackage> {
  const invalid=()=>new Error(t('互传游戏包格式或校验无效。'));
  if(blob.size<12||blob.size>LIMIT+HEADER_LIMIT+12)throw invalid();
  const prefix=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  if(!magic.every((v,i)=>prefix[i]===v))throw invalid();
  const length=new DataView(prefix.buffer).getUint32(8,true);
  if(length>HEADER_LIMIT||length+12>blob.size)throw invalid();
  const meta=JSON.parse(await blob.slice(12,12+length).text());
  if(meta?.version!==1||typeof meta.hash!=='string'||!Array.isArray(meta.files)||!meta.files.length||meta.files.length>2048)throw invalid();
  let offset=12+length,total=0;
  const files=[];
  for(const f of meta.files){
    if(!f||!Number.isSafeInteger(f.size)||f.size<0||(total+=f.size)>LIMIT||offset+f.size>blob.size)throw invalid();
    files.push({path:path(f.path),bytes:new Uint8Array(await blob.slice(offset,offset+f.size).arrayBuffer())});offset+=f.size;
  }
  validateFiles(files,LIMIT);
  if(offset!==blob.size||!isGame(files[0].path)||await gameHash(files[0].bytes)!==meta.hash)throw invalid();
  return {hash:meta.hash,name:files[0].path,game:new Blob([files[0].bytes]),resources:files.slice(1)};
}
