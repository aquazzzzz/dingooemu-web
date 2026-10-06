export const buttons = {Up:2**20,Down:2**27,Left:2**28,Right:2**18,A:2**31,B:2**21,X:2**16,Y:2**6,L:2**8,R:2**29,Start:2**11,Select:2**10};
export type Button = keyof typeof buttons;
export const defaults:Record<Button,string> = {Up:'ArrowUp',Down:'ArrowDown',Left:'ArrowLeft',Right:'ArrowRight',A:'KeyX',B:'KeyZ',X:'KeyS',Y:'KeyA',L:'KeyQ',R:'KeyW',Start:'Enter',Select:'ShiftRight'};
export interface InputUpdate { source: string; buttons: number; cancel: boolean }
export class InputState {
  private sources = new Map<string,number>();
  constructor(private changed:(update:InputUpdate)=>void) {}
  set(source:string,mask:number,cancel=false) {
    if(mask) this.sources.set(source,mask>>>0); else this.sources.delete(source);
    this.changed({source,buttons:mask>>>0,cancel});
  }
  clear(source:string) {
    this.sources.delete(source);
    this.changed({source,buttons:0,cancel:true});
  }
  clearAll() {this.sources.clear(); this.changed({source:'*',buttons:0,cancel:true});}
  clearPrefix(prefix:string) {
    for(const source of this.sources.keys()) if(source.startsWith(prefix)) this.sources.delete(source);
    this.changed({source:prefix+'*',buttons:0,cancel:true});
  }
  get mask() {return [...this.sources.values()].reduce((a,b)=>a|b,0)>>>0;}
}
