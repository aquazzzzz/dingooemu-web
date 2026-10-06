import {} from '../i18n';
export class InputSampler {
  private masks = new Map<string, number>();
  private budgets = new Map<string, Uint8Array>();
  private minimumTicks: number;

  constructor(minimumTicks = 6) {
    this.minimumTicks = Math.max(1, Math.min(255, Math.floor(minimumTicks)));
  }

  update(source: string, mask: number, cancel = false) {
    if (source === '*') { this.clear(); return; }
    if(source.endsWith('*')) {
      const prefix=source.slice(0,-1);
      for(const key of this.budgets.keys()) if(key.startsWith(prefix)) {this.budgets.delete(key);this.masks.delete(key);}
      return;
    }
    mask >>>= 0;
    const previous = this.masks.get(source) || 0;
    if(mask) this.masks.set(source, mask); else this.masks.delete(source);
    let budget = this.budgets.get(source);
    if (!budget) { budget = new Uint8Array(32); this.budgets.set(source, budget); }
    if (cancel) { budget.fill(0); return; }
    const pressed = (mask & ~previous) >>> 0;
    for (let bit = 0; bit < 32; bit++) {
      if (pressed & (2 ** bit)) budget[bit] = this.minimumTicks;
    }
  }

  sample(): number {
    let mask = 0;
    for (const held of this.masks.values()) mask |= held;
    for (const [source,budget] of this.budgets) {
      for (let bit = 0; bit < 32; bit++) {
        if (budget[bit] > 0) { mask |= 2 ** bit; budget[bit]--; }
      }
      if(!this.masks.has(source) && budget.every(value=>value===0)) this.budgets.delete(source);
    }
    return mask >>> 0;
  }

  clear() { this.masks.clear(); this.budgets.clear(); }
}

