import {t,setText} from '../i18n';
type Mode = 'page' | 'portrait' | 'landscape';
type Offset = [number, number];
type Layouts = Record<Mode, Record<string, Offset>>;
type Drag = {element:HTMLElement; x:number; y:number; start:DOMRect; base:DOMRect};

// Keep layout editing separate from game input. Offsets are relative to the
// stage, with separate profiles for the page and each fullscreen orientation.
export class ControlSettings {
  private layouts:Layouts = {page:{},portrait:{},landscape:{}};
  private editing = false;
  private drags = new Map<number,Drag>();
  private targets:HTMLElement[];
  private edit:HTMLButtonElement;
  constructor(private root:HTMLElement,private panel:HTMLElement,
    private toggle:HTMLButtonElement,private key:string,
    private onEditing:(value:boolean)=>void) {
    this.targets=[...root.querySelectorAll<HTMLElement>('[data-button],[data-dpad],#control-settings-toggle')];
    this.edit=panel.querySelector<HTMLButtonElement>('#edit-control-layout')!;
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      for(const mode of ['page','portrait','landscape'] as Mode[]) {
        for(const element of this.targets) {
          const name=this.name(element),offset=saved?.[mode]?.[name];
          if(Array.isArray(offset)&&offset.length===2&&offset.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1))this.layouts[mode][name]=offset as Offset;
        }
      }
    } catch {}
    toggle.onclick=()=>{if(!this.editing)this.open(!root.classList.contains('settings-open'));};
    panel.querySelector<HTMLButtonElement>('#close-control-settings')!.onclick=()=>this.open(false);
    this.edit.onclick=()=>this.setEditing(!this.editing);
    panel.querySelector<HTMLButtonElement>('#reset-control-layout')!.onclick=()=>{
      this.cancelDrags();this.layouts={page:{},portrait:{},landscape:{}};this.save();this.refresh();
    };
    root.addEventListener('pointerdown',event=>{
      if(!this.editing)return;
      const element=(event.target as HTMLElement).closest<HTMLElement>('[data-button],[data-dpad],#control-settings-toggle');
      if(!element||[...this.drags.values()].some(d=>d.element===element))return;
      event.preventDefault();event.stopPropagation();
      const start=element.getBoundingClientRect();element.style.removeProperty('translate');
      const base=element.getBoundingClientRect();this.apply(element);element.setPointerCapture(event.pointerId);
      this.drags.set(event.pointerId,{element,x:event.clientX,y:event.clientY,start,base});
      element.classList.add('is-dragging');
    },true);
    root.addEventListener('pointermove',event=>{
      const drag=this.drags.get(event.pointerId);if(!drag)return;
      event.preventDefault();event.stopPropagation();
      const area=root.getBoundingClientRect();
      const x=this.clamp(drag.start.x+event.clientX-drag.x,area.left,area.right-drag.base.width);
      const y=this.clamp(drag.start.y+event.clientY-drag.y,area.top,area.bottom-drag.base.height);
      this.layouts[this.mode()][this.name(drag.element)]=[(x-drag.base.x)/area.width,(y-drag.base.y)/area.height];
      this.apply(drag.element);
    },true);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>{
      const id=(event as PointerEvent).pointerId,drag=this.drags.get(id);if(!drag)return;
      event.stopPropagation();this.drags.delete(id);drag.element.classList.remove('is-dragging');this.save();
      if(drag.element.hasPointerCapture(id))drag.element.releasePointerCapture(id);
    },true);
    new ResizeObserver(()=>{this.cancelDrags();this.refresh();}).observe(root);
    this.refresh();
  }
  layoutChanged() {this.cancelDrags();this.refresh();}
  presentationChanged() {
    this.setEditing(false);this.root.classList.remove('settings-open');
    this.toggle.setAttribute('aria-expanded','false');this.refresh();
  }
  cancelDrags() {
    const previous=[...this.drags];this.drags.clear();
    for(const [id,drag] of previous) {
      drag.element.classList.remove('is-dragging');
      if(drag.element.hasPointerCapture(id))drag.element.releasePointerCapture(id);
    }
    if(previous.length)this.save();
  }
  private open(value:boolean) {
    if(!value){this.setEditing(false);this.root.querySelector<HTMLCanvasElement>('canvas')?.focus({preventScroll:true});}
    else this.onEditing(false);
    this.root.classList.toggle('settings-open',value);this.toggle.setAttribute('aria-expanded',String(value));
  }
  private setEditing(value:boolean) {
    this.cancelDrags();this.editing=value;this.onEditing(value);
    this.root.classList.toggle('editing-controls',value);this.edit.setAttribute('aria-pressed',String(value));
    setText(this.edit,value?t("完成位置调整"):t("调整按键位置"));
    setText(this.panel.querySelector('#layout-help')!,value?
      t("拖动按键到合适位置；调整期间不向游戏发送按键。点击“完成位置调整”保存。"):
      t("调整时拖动十字键、各按键或全屏设置按钮，完成后保存。"));
    if(value){this.root.classList.add('settings-open');this.toggle.setAttribute('aria-expanded','true');}
    this.refresh();
  }
  private mode():Mode {return this.root.classList.contains('immersive')?(innerWidth>innerHeight?'landscape':'portrait'):'page';}
  private name(element:HTMLElement) {return element.dataset.button||(element.hasAttribute('data-dpad')?'dpad':'settings');}
  private clamp(value:number,min:number,max:number) {return Math.max(min,Math.min(value,Math.max(min,max)));}
  private refresh() {for(const element of this.targets)this.apply(element);}
  private apply(element:HTMLElement) {
    element.style.removeProperty('translate');
    const offset=this.layouts[this.mode()][this.name(element)];if(!offset||!element.getClientRects().length)return;
    const area=this.root.getBoundingClientRect(),base=element.getBoundingClientRect();
    const x=this.clamp(base.x+offset[0]*area.width,area.left,area.right-base.width)-base.x;
    const y=this.clamp(base.y+offset[1]*area.height,area.top,area.bottom-base.height)-base.y;
    element.style.translate=`${x}px ${y}px`;
  }
  private save() {try{localStorage.setItem(this.key,JSON.stringify(this.layouts));}catch{}}
}

