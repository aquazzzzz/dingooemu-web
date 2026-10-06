import {t,literal} from '../i18n';
import {path,validateFiles,MAX_FILES,type MountedFile} from './saves';
const LIMIT=128*1024*1024;
export const isGame=(name:string)=>/\.(app|cc|c2s|c3s)$/i.test(name);
export interface GameImport {name:string;game:Blob;resources:MountedFile[]}
export function chooseGame(files:MountedFile[],name:string):GameImport {
  validateFiles(files);
  const selected=files.find(f=>f.path===name);
  if(!selected||!isGame(name))throw new Error(t("请选择包内的游戏文件。"));
  return {name,game:new Blob([new Uint8Array(selected.bytes)]),resources:files.filter(f=>f!==selected)};
}
export async function readFiles(input:FileList|File[],folder=false):Promise<MountedFile[]> {
  const files=Array.from(input);
  if(files.length>MAX_FILES||files.reduce((sum,f)=>sum+f.size,0)>LIMIT)throw new Error(t("导入最多 2048 个文件、总计 128 MiB。"));
  const result:MountedFile[]=[];
  for(const file of files){
    let name=file.webkitRelativePath||file.name;
    if(folder&&file.webkitRelativePath)name=name.slice(name.indexOf('/')+1);
    if(name.startsWith('__MACOSX/')||name.split('/').some(v=>v.startsWith('._')))continue;
    result.push({path:path(name),bytes:new Uint8Array(await file.arrayBuffer())});
  }
  validateFiles(result);return result;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
export function crc32(bytes:Uint8Array) {let value=0xffffffff;for(const b of bytes)value=(value>>>8)^crcTable[(value^b)&255];return (value^0xffffffff)>>>0;}
export async function unzip(bytes:Uint8Array):Promise<MountedFile[]> {
  if(bytes.length>LIMIT||bytes.length<22)throw new Error(t("ZIP 为空、过大或格式无效。"));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const check=(offset:number,length:number)=>{if(offset<0||length<0||offset+length>bytes.length)throw new Error(t("ZIP 数据不完整。"));};
  let end=bytes.length-22;
  for(;end>=Math.max(0,bytes.length-65557);end--)if(view.getUint32(end,true)===0x06054b50&&end+22+view.getUint16(end+20,true)===bytes.length)break;
  if(end<Math.max(0,bytes.length-65557))throw new Error(t("找不到 ZIP 目录。"));
  const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count>MAX_FILES||offset+size>end)throw new Error(t("不支持分卷、ZIP64 或过多文件的 ZIP。"));
  const result:MountedFile[]=[];let cursor=offset,total=0;
  for(let i=0;i<count;i++){
    check(cursor,46);if(view.getUint32(cursor,true)!==0x02014b50)throw new Error(t("ZIP 文件目录无效。"));
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),checksum=view.getUint32(cursor+16,true),compressed=view.getUint32(cursor+20,true),length=view.getUint32(cursor+24,true);
    const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true),mode=view.getUint32(cursor+38,true)>>>16;
    check(cursor+46,nameLength+extraLength+commentLength);
    if(flags&1||![0,8].includes(method)||(mode&0xf000)===0xa000||view.getUint16(cursor+34,true)||compressed===0xffffffff||length===0xffffffff||local===0xffffffff)throw new Error(t("ZIP 包含加密、链接或不支持的压缩格式。"));
    let name:string;
    try {name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(cursor+46,cursor+46+nameLength));}
    catch {throw new Error(t("ZIP 文件名需使用 UTF-8，请重新打包或导入文件夹。"));}
    cursor+=46+nameLength+extraLength+commentLength;
    const directory=name.endsWith('/');name=path(name);
    if(directory||name.startsWith('__MACOSX/')||name.split('/').some(v=>v.startsWith('._')))continue;
    total+=length;if(total>LIMIT)throw new Error(t("ZIP 解压后超过 128 MiB。"));
    check(local,30);if(view.getUint32(local,true)!==0x04034b50||view.getUint16(local+8,true)!==method||view.getUint16(local+6,true)!==flags)throw new Error(t("ZIP 文件头不匹配。"));
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);check(start,compressed);
    if(start+compressed>offset)throw new Error(t("ZIP 文件数据与目录重叠。"));
    const raw=bytes.subarray(start,start+compressed);let data:Uint8Array;
    if(method===0)data=new Uint8Array(raw);
    else {
      try {
        const reader=new Blob([new Uint8Array(raw)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        const chunks:Uint8Array[]=[];let actual=0;
        try {for(;;){const part=await reader.read();if(part.done)break;actual+=part.value.length;if(actual>length){await reader.cancel();throw new Error(t("ZIP 解压长度超出声明。"));}chunks.push(part.value);}}
        finally {reader.releaseLock();}
        data=new Uint8Array(actual);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
      } catch(error){throw new Error(t("无法解压 ZIP，可改用文件夹导入：{0}",String(error)));}
    }
    if(data.length!==length||crc32(data)!==checksum)throw new Error(t("ZIP 文件校验失败：{0}",literal(name)));
    result.push({path:name,bytes:data});
  }
  if(cursor>offset+size)throw new Error(t("ZIP 目录长度无效。"));
  validateFiles(result);return result;
}

