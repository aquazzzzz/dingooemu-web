import {messages} from './locales';
export type Language='zh-CN'|'en'|'ja';
interface Message {key:string;args:(string|Message)[];prefix?:string}
interface Literal {literal:string}
export const literal=(value:string):Literal=>({literal:value});
const storageKey=`dingooemu-hybrid:${location.pathname.replace(/\/[^/]*$/, '/')}language`;
let current:Language='zh-CN';
try {const saved=localStorage.getItem(storageKey);if(saved==='en'||saved==='ja')current=saved;}catch{}
const recent=new Map<string,Message>();
const bindings=new Map<Node,{message:Message}>();
let newBindings=0;
function bind(node:Node,message:Message) {
  if(!bindings.has(node)&&++newBindings===128){
    newBindings=0;
    queueMicrotask(()=>{for(const node of bindings.keys())if(!node.isConnected)bindings.delete(node);});
  }
  bindings.set(node,{message});
}
const listeners=new Set<()=>void>();
export const language=()=>current;
export const onLanguageChange=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
function descriptor(value:unknown):string|Message {
  if(value&&typeof value==='object'&&'literal' in value)return (value as Literal).literal;
  const text=String(value??'');
  const known=recent.get(text);if(known)return known;
  if(text.startsWith('Error: ')){const error=recent.get(text.slice(7));if(error)return {...error,prefix:'Error: '};}
  return text;
}
function render(message:Message):string {
  const pattern=current==='zh-CN'?message.key:messages[message.key]?.[current==='en'?0:1]??message.key;
  return (message.prefix||'')+pattern.replace(/\{(\d+)\}/g,(_,i)=>{const arg=message.args[Number(i)];return typeof arg==='string'?arg:arg?render(arg):'{'+i+'}';});
}
export function messageKey(value:string):string {
  const resolved=descriptor(value);
  return typeof resolved==='string'?value:resolved.key;
}
export function t(key:string,...values:unknown[]):string {
  const message={key,args:values.map(descriptor)};
  const text=render(message);recent.delete(text);recent.set(text,message);
  if(recent.size>256)recent.delete(recent.keys().next().value!);
  return text;
}
// Bind only displayed message descriptors, never emulator buffers or callbacks.
export function setText(node:Node,value:string|null) {
  const text=value??'',resolved=descriptor(text);
  node.textContent=text;
  if(typeof resolved==='string')bindings.delete(node);else bind(node,resolved);
}
export function localize(root:HTMLElement) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('[data-language]'))continue;
    const source=node.textContent||'',key=source.trim();
    const resolved=recent.get(key)??(messages[key]?{key,args:[]}:undefined);
    if(resolved){const prefix=source.slice(0,source.indexOf(key)),suffix=source.slice(source.indexOf(key)+key.length);const message:Message=prefix||suffix?{key:'{0}{1}{2}',args:[prefix,resolved,suffix]}:resolved;bind(node,message);node.textContent=render(message);}
  }
  for(const element of [root,...root.querySelectorAll<HTMLElement>('*')])for(const attribute of ['aria-label','placeholder','title']){
    const key=element.getAttribute(attribute);if(key&&messages[key]){
      let records=attributes.get(element);if(!records)attributes.set(element,records=new Map());
      records.set(attribute,{key,args:[]});element.setAttribute(attribute,t(key));
    }
  }
}
const attributes=new Map<HTMLElement,Map<string,Message>>();
function applyLanguage() {
  document.documentElement.lang=current;
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if(manifest){const root=new URL(import.meta.env.BASE_URL,location.href);manifest.href=new URL(current==='zh-CN'?'manifest.webmanifest':`manifest-${current}.webmanifest`,root).href;}
  for(const [node,binding] of bindings){if(!node.isConnected){bindings.delete(node);continue;}node.textContent=render(binding.message);}
  for(const [element,records] of attributes){if(!element.isConnected){attributes.delete(element);continue;}for(const [name,message] of records)element.setAttribute(name,render(message));}
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')){const selected=button.dataset.language===current;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
}
export function setLanguage(value:Language) {
  if(!['zh-CN','en','ja'].includes(value))return;
  current=value;try{localStorage.setItem(storageKey,value);}catch{}
  applyLanguage();for(const listener of listeners)listener();
}
export function setupLanguages(root:HTMLElement) {
  localize(root);applyLanguage();
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-language]'))button.onclick=()=>setLanguage(button.dataset.language as Language);
}
