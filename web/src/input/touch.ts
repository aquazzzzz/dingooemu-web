import {buttons,type Button,type InputState} from './state';
export class Touch {
  private pointers = new Map<number,{mask:number;element:HTMLElement}>();
  private enabled = false;
  private editing = false;
  constructor(private root:HTMLElement,private input:InputState) {
    root.addEventListener('pointerdown',e=> {
      if(!this.enabled||this.editing) return;
      const element=(e.target as HTMLElement).closest<HTMLElement>('[data-button],[data-dpad]'); if(!element) return;
      e.preventDefault();
      if(document.activeElement instanceof HTMLElement&&document.activeElement.closest('[data-control-settings]'))document.activeElement.blur();
      element.setPointerCapture(e.pointerId);
      const mask=this.mask(element,e);
      this.hover(0);this.pointers.set(e.pointerId,{mask,element});this.feedback(); this.input.set(this.source(e.pointerId),mask);
    });
    root.addEventListener('pointermove',e=> {
      const p=this.pointers.get(e.pointerId);
      if(!p) {
        if(e.pointerType==='mouse'&&this.enabled&&!this.editing) {
          const dpad=(e.target as HTMLElement).closest<HTMLElement>('[data-dpad]');
          this.hover(dpad?this.mask(dpad,e):0);
        }
        return;
      }
      const mask=this.mask(p.element,e); if(mask===p.mask)return;
      // A direction slide replaces the old direction immediately; otherwise
      // the short-tap window can leave Left+Right pressed together.
      p.mask=mask;this.feedback();this.input.clear(this.source(e.pointerId));this.input.set(this.source(e.pointerId),mask);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture']) root.addEventListener(event,e=> {
      const id=(e as PointerEvent).pointerId;
      if(this.pointers.delete(id)) {
        this.feedback();
        if(event==='pointerup')this.input.set(this.source(id),0);else this.input.clear(this.source(id));
      }
    });
    root.addEventListener('pointerleave',()=>this.hover(0));
  }
  setEditing(value:boolean) {this.editing=value;this.clear();}
  setEnabled(value:boolean) {this.enabled=value; this.root.hidden=!value; if(!value) this.clear();}
  clear() {
    const previous=[...this.pointers.entries()]; this.pointers.clear(); this.input.clearPrefix('touch:');
    this.feedback();this.hover(0);
    for(const [id,p] of previous) if(p.element.hasPointerCapture(id))p.element.releasePointerCapture(id);
  }
  private feedback() {
    for(const element of this.root.querySelectorAll<HTMLElement>('[data-button],[data-dpad]')) {
      const mask=[...this.pointers.values()].filter(p=>p.element===element).reduce((value,p)=>value|p.mask,0)>>>0;
      element.classList.toggle('is-pressed',mask!==0);
      for(const arm of element.querySelectorAll<HTMLElement>('[data-direction]')) {
        arm.classList.toggle('is-down',(mask&buttons[arm.dataset.direction as Button])!==0);
      }
    }
  }
  private hover(mask:number) {
    for(const arm of this.root.querySelectorAll<HTMLElement>('[data-direction]')) {
      arm.classList.toggle('is-hovered',(mask&buttons[arm.dataset.direction as Button])!==0);
    }
  }
  private mask(element:HTMLElement,e:PointerEvent) {
    if(element.dataset.button) return buttons[element.dataset.button as Button];
    const box=element.getBoundingClientRect(); const x=(e.clientX-box.left)/box.width-.5, y=(e.clientY-box.top)/box.height-.5;
    return ((x<-.16?buttons.Left:x>.16?buttons.Right:0)|(y<-.16?buttons.Up:y>.16?buttons.Down:0))>>>0;
  }
  private source(id:number) {return `touch:${id}`;}
}
