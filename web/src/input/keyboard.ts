import {buttons,defaults,type Button,type InputState} from './state';
export class Keyboard {
  bindings:Record<Button,string>;
  private held = new Set<string>();
  private blocked = false;
  private recording:Button|undefined;
  private suppressed = new Set<string>();
  get recordingButton() {return this.recording;}
  constructor(private input:InputState,private key:string,private onBinding:()=>void) {
    this.bindings={...defaults};
    try {const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved && Object.keys(saved).length===12 && Object.keys(defaults).every(b => typeof saved[b]==='string' && saved[b].length>0) && new Set(Object.values(saved)).size===12) this.bindings=saved;} catch {}
    window.addEventListener('keydown',e => {
      if(!e.bubbles)return;
      if(this.recording) {
        e.preventDefault(); const button=this.recording;
        if(e.repeat)return;
        if(e.code==='Escape') {this.clear();return;}
        const existing=(Object.keys(this.bindings) as Button[]).find(b=>this.bindings[b]===e.code);
        if(existing && existing!==button) this.bindings[existing]=this.bindings[button];
        this.bindings[button]=e.code; this.recording=undefined; this.clear();this.suppressed.add(e.code); this.save(); this.onBinding(); return;
      }
      if(this.blocked)return;
      if(e.target instanceof HTMLElement && (e.target.closest('[data-control-settings],#control-settings-toggle') || e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]),textarea,select') || e.target.isContentEditable)) return;
      if(this.suppressed.has(e.code) || (e.repeat && !this.held.has(e.code)))return;
      if(Object.values(this.bindings).includes(e.code)) {e.preventDefault(); this.held.add(e.code); this.publish();}
    },true);
    window.addEventListener('keyup',e=> {if(!e.bubbles)return;this.suppressed.delete(e.code);if(this.held.delete(e.code)) {e.preventDefault(); this.publish();}},true);
  }
  setBlocked(value:boolean) {this.clear();this.blocked=value;}
  record(button:Button) {this.clear(); this.recording=button;this.onBinding();}
  reset() {this.bindings={...defaults};this.clear(); this.save(); this.onBinding();}
  clear() {const recording=this.recording;this.recording=undefined;this.suppressed.clear();this.held.clear(); this.input.clear('keyboard');if(recording)this.onBinding();}
  private publish() {this.input.set('keyboard',(Object.keys(buttons) as Button[]).reduce((mask,b)=>mask|(this.held.has(this.bindings[b])?buttons[b]:0),0)>>>0);}
  private save() {try {localStorage.setItem(this.key,JSON.stringify(this.bindings));} catch {}}
}
