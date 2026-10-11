import {t,setText} from '../i18n';
// Fullscreen changes presentation only; RetroArch remains the simulation clock.
export class GameFullscreen {
  private mode: 'none' | 'native' | 'page' = 'none';
  private exitTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private integerScale = false;
  private frontend = false;
  private scrollPosition:[number,number]=[0,0];
  constructor(private root: HTMLElement, private screen: HTMLCanvasElement,
    private exitButton: HTMLButtonElement, private notice: HTMLElement,
    private clearInput: () => void, private onChange: () => void = () => {}) {
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement === this.root) this.activate('native');
      else if (this.mode === 'native') this.deactivate();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.mode === 'page') {
        event.preventDefault(); void this.exit();
      }
    });
    this.exitButton.onclick = () => void this.exit();
    this.root.addEventListener('pointerdown', () => this.revealExit());
    this.root.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') this.revealExit();
    });
    this.exitButton.addEventListener('focus', () => this.revealExit());
    new ResizeObserver(() => this.fit()).observe(this.screen.parentElement!);
    new MutationObserver(() => this.fit()).observe(this.screen,{attributes:true,attributeFilter:['width','height']});
    const resize=()=>{this.updateViewport();this.fit();};
    window.addEventListener('resize',resize);
    window.visualViewport?.addEventListener('resize',resize);
    window.visualViewport?.addEventListener('scroll',resize);
  }
  get active() {return this.mode!=='none';}
  setFrontend(value:boolean) {this.frontend=value;this.root.classList.toggle('retroarch-frontend',value);this.fit();}
  setIntegerScale(value:boolean) {this.integerScale=value;this.fit();}
  async enter() {
    if (this.pending || this.mode !== 'none') return;
    this.pending = true; this.clearInput();
    try {
      if (!document.fullscreenEnabled || !this.root.requestFullscreen) {
        this.activate('page');
      } else {
        try {
          // Called directly from the user's click, before any asynchronous work.
          await this.root.requestFullscreen({navigationUI: 'hide'});
          if (document.fullscreenElement === this.root) this.activate('native');
        } catch {
          this.activate('page');
        }
      }
    } finally { this.pending = false; }
  }
  async exit() {
    if (this.pending || this.mode === 'none') return;
    this.pending = true;
    try {
      if (document.fullscreenElement === this.root) await document.exitFullscreen();
      else this.deactivate();
    } catch {
      setText(this.notice,t("退出全屏失败，请使用浏览器的退出全屏操作。"));
      this.revealExit();
    } finally { this.pending = false; }
  }
  private activate(mode: 'native' | 'page') {
    if(this.mode==='none')this.scrollPosition=[scrollX,scrollY];
    this.mode = mode; this.clearInput();
    this.root.classList.add('immersive');
    document.body.classList.add('game-fullscreen');
    // Home Screen apps already omit browser bars even when iOS lacks the
    // element Fullscreen API. Filling their viewport is the expected mode.
    const standalone=matchMedia('(display-mode: standalone)').matches
      ||Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
    setText(this.notice,mode === 'page'&&!standalone ? t("浏览器未启用原生全屏，已改为铺满网页。") : '');
    this.updateViewport();
    this.exitButton.hidden = false; this.revealExit(); this.fit();this.screen.focus({preventScroll:true});this.onChange();
  }
  private deactivate() {
    this.mode = 'none'; this.clearInput(); clearTimeout(this.exitTimer);
    this.root.classList.remove('immersive', 'show-exit');
    document.body.classList.remove('game-fullscreen');
    this.exitButton.hidden = true; setText(this.notice,'');
    for(const name of ['--viewport-width','--viewport-height','--viewport-left','--viewport-top'])this.root.style.removeProperty(name);
    window.scrollTo(...this.scrollPosition);
    this.fit();this.screen.focus({preventScroll:true});this.onChange();
  }
  private revealExit() {
    if (this.mode === 'none') return;
    this.root.classList.add('show-exit'); clearTimeout(this.exitTimer);
    this.exitTimer = setTimeout(() => this.root.classList.remove('show-exit'), 2500);
  }
  private fit() {
    if(this.frontend){
      const area=this.screen.parentElement!;
      this.screen.style.width=`${area.clientWidth}px`;this.screen.style.height=`${area.clientHeight}px`;return;
    }
    if (this.mode === 'none'&&!this.integerScale) {
      this.screen.style.removeProperty('width');this.screen.style.removeProperty('height');return;
    }
    const area = this.screen.parentElement!;
    const portrait=this.screen.height>this.screen.width;
    const width=portrait?240:320,height=portrait?320:240;
    let scale = Math.min(area.clientWidth / width, area.clientHeight / height);
    if(this.integerScale){
      const dpr=window.devicePixelRatio||1,whole=Math.floor((scale*dpr)+1e-6);
      if(whole>=1)scale=whole/dpr;
    }
    this.screen.style.width = `${width * scale}px`;
    this.screen.style.height = `${height * scale}px`;
  }
  private updateViewport() {
    if(this.mode==='none')return;
    const viewport=this.mode==='page'?window.visualViewport:null;
    this.root.style.setProperty('--viewport-width',`${viewport?.width??innerWidth}px`);
    this.root.style.setProperty('--viewport-height',`${viewport?.height??innerHeight}px`);
    this.root.style.setProperty('--viewport-left',`${viewport?.offsetLeft??0}px`);
    this.root.style.setProperty('--viewport-top',`${viewport?.offsetTop??0}px`);
  }
}
