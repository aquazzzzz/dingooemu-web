import {parsePairing,type Pairing} from './peer';
import {t} from '../i18n';

const PREFIX='DINGOO-STREAM-QR:1:',SLICE=400,MAX_PACK=128*1024,MAX_RAW=64000;
const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function base45(bytes:Uint8Array){
  let text='';for(let i=0;i<bytes.length;i+=2){let value=bytes[i];const pair=i+1<bytes.length;if(pair)value=value*256+bytes[i+1];text+=ALPHABET[value%45]+ALPHABET[Math.floor(value/45)%45];if(pair)text+=ALPHABET[Math.floor(value/2025)];}return text;
}
function unbase45(text:string){
  if(text.length%3===1)throw bad();const bytes:number[]=[];
  for(let i=0;i<text.length;i+=3){const pair=i+2<text.length,value=ALPHABET.indexOf(text[i])+45*ALPHABET.indexOf(text[i+1])+(pair?2025*ALPHABET.indexOf(text[i+2]):0);if(value>(pair?65535:255))throw bad();if(pair)bytes.push(value>>>8);bytes.push(value&255);}return Uint8Array.from(bytes);
}
const bad=()=>new Error(t('二维码无效或已损坏，请重新扫描。'));
function checksum(bytes:Uint8Array){
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return ((crc^0xffffffff)>>>0).toString(16).padStart(8,'0');
}
async function collect(stream:ReadableStream<Uint8Array>,limit:number){
  const reader=stream.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw bad();parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export async function encodeQr(text:string):Promise<string[]>{
  const pairing=parsePairing(text),raw=new TextEncoder().encode(text);
  if(raw.length>MAX_PACK)throw bad();
  let bytes=raw,encoding='r';
  if(typeof CompressionStream!=='undefined'){
    const compressed=await collect(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate')),MAX_PACK);
    if(compressed.length<raw.length){bytes=compressed;encoding='z';}
  }
  const data=base45(bytes),count=Math.ceil(data.length/SLICE);
  if(count>128)throw bad();
  const header=`${PREFIX}${pairing.session.toUpperCase()}:${pairing.type.toUpperCase()}:${encoding.toUpperCase()}:${checksum(bytes).toUpperCase()}:${count}:`;
  return Array.from({length:count},(_,index)=>`${header}${index}:${data.slice(index*SLICE,(index+1)*SLICE)}`);
}
export class QrAssembly {
  private key='';private parts=new Map<number,string>();private size=0;private complete=false;
  clear(){this.key='';this.parts.clear();this.size=0;this.complete=false;}
  async add(frame:string,expected?:{session:string;type:'answer'}):Promise<{read:number;total:number;text?:string;pairing?:Pairing}>{
    if(frame.length>1100)throw bad();
    const match=frame.match(/^DINGOO-STREAM-QR:1:([A-F0-9]{32}):(OFFER|ANSWER):(R|Z):([A-F0-9]{8}):(\d{1,3}):(\d{1,3}):([0-9A-Z $%*+./:\-]+)$/);
    if(!match)throw bad();
    const [,sessionText,typeText,encodingText,hashText,countText,indexText,data]=match,count=Number(countText),index=Number(indexText);
    const session=sessionText.toLowerCase(),type=typeText.toLowerCase(),encoding=encodingText.toLowerCase(),hash=hashText.toLowerCase();
    if(count<1||count>128||index>=count||data.length>SLICE||index<count-1&&data.length!==SLICE)throw bad();
    if(expected){
      if(type!=='answer')throw new Error(t('这是主机连接二维码，请扫描接收端的回复二维码。'));
      if(session!==expected.session)throw new Error(t('这是另一次配对的二维码，请扫描本次回复。'));
    }else if(type!=='offer')throw new Error(t('这是回复二维码，请先扫描主机的连接二维码。'));
    const key=[session,type,encoding,hash,count].join(':');
    if(this.key&&this.key!==key)throw new Error(t('二维码来自不同的配对，请取消扫描后重试。'));
    this.key=key;
    if(this.parts.has(index)&&this.parts.get(index)!==data)throw bad();
    if(!this.parts.has(index)){this.parts.set(index,data);this.size+=data.length;}
    if(this.size>MAX_PACK)throw bad();
    const progress={read:this.parts.size,total:count};
    if(this.parts.size!==count||this.complete)return progress;
    const packed=Array.from({length:count},(_,i)=>this.parts.get(i)!).join('');
    let bytes:Uint8Array;
    bytes=unbase45(packed);
    if(checksum(bytes)!==hash)throw bad();
    if(encoding==='z'){
      if(typeof DecompressionStream==='undefined')throw new Error(t('浏览器不支持此二维码，请更新浏览器或使用文本配对。'));
      bytes=await collect(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate')),MAX_RAW);
    }
    if(bytes.length>MAX_RAW)throw bad();
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw bad();}
    const pairing=parsePairing(text);
    if(pairing.session!==session||pairing.type!==type)throw bad();
    this.complete=true;return {...progress,text,pairing};
  }
}
