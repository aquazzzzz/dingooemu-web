import {t,setText} from '../i18n';
type NativeDocument=Document&{webkitFullscreenEnabled?:boolean;webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>void|Promise<void>};
type NativeElement=HTMLElement&{webkitRequestFullscreen?:()=>void|Promise<void>};
// Fullscreen changes presentation only; RetroArch remains the simulation clock.
export class GameFullscreen {
  private mode: 'none' | 'native' | 'page' = 'none';
  private exitTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private integerScale = false;
  private frontend = false;
  private streamSize?:[number,number];
  private scrollPosition:[number,number]=[0,0];
  constructor(private root: HTMLElement, private screen: HTMLCanvasElement,
    private exitButton: HTMLButtonElement, private notice: HTMLElement,
    private clearInput: () => void, private onChange: () => void = () => {}) {
    const changed=()=>{
      if(this.nativeElement===this.root){if(this.mode!=='native')this.activate('native');}
      else if(this.mode==='native')this.deactivate();
    };
    document.addEventListener('fullscreenchange',changed);
    document.addEventListener('webkitfullscreenchange',changed);
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
  private get nativeElement(){return document.fullscreenElement??(document as NativeDocument).webkitFullscreenElement;}
  // Prefixed WebKit methods may return void and complete via events. Waiting
  // for the actual state also keeps frontend startup from racing fullscreen.
  private nativeChange(action:()=>void|Promise<void>,entering:boolean) {
    return new Promise<void>((resolve,reject)=>{
      const changes=['fullscreenchange','webkitfullscreenchange'],errors=['fullscreenerror','webkitfullscreenerror'];
      let done=false;
      const finish=(error?:unknown)=>{
        if(done)return;done=true;clearTimeout(timer);
        changes.forEach(type=>document.removeEventListener(type,check));errors.forEach(type=>document.removeEventListener(type,failed));
        if(error)reject(error);else resolve();
      };
      const check=()=>{if((this.nativeElement===this.root)===entering)finish();};
      const failed=()=>finish(new Error('Native fullscreen failed'));
      const timer=setTimeout(failed,5000);
      changes.forEach(type=>document.addEventListener(type,check));errors.forEach(type=>document.addEventListener(type,failed));
      // Invoke directly in the click handler, before yielding user activation.
      try{Promise.resolve(action()).then(check,finish);check();}catch(error){finish(error);}
    });
  }
  setFrontend(value:boolean) {this.frontend=value;this.root.classList.toggle('retroarch-frontend',value);this.fit();}
  setStreamSize(width:number,height:number){this.streamSize=width&&height?[width,height]:undefined;this.fit();}
  setIntegerScale(value:boolean) {this.integerScale=value;this.fit();}
  async enter() {
    if (this.pending || this.mode !== 'none') return;
    this.pending = true; this.clearInput();
    try {
      const doc=document as NativeDocument,root=this.root as NativeElement;
      const request=typeof root.requestFullscreen==='function'&&doc.fullscreenEnabled!==false
        ?()=>root.requestFullscreen({navigationUI:'hide'})
        :typeof root.webkitRequestFullscreen==='function'&&doc.webkitFullscreenEnabled!==false
          ?()=>root.webkitRequestFullscreen!():undefined;
      if (!request) {
        this.activate('page');
      } else {
        try {
          await this.nativeChange(request,true);
          if(this.nativeElement===this.root&&!this.active)this.activate('native');
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
      if(this.nativeElement===this.root){
        const doc=document as NativeDocument;
        const exit=document.fullscreenElement===this.root?()=>doc.exitFullscreen():()=>doc.webkitExitFullscreen!();
        await this.nativeChange(exit,false);
      }
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
      if(this.mode==='none'){
        this.screen.style.removeProperty('width');this.screen.style.removeProperty('height');return;
      }
      const area=this.screen.parentElement!;
      this.screen.style.width=`${area.clientWidth}px`;this.screen.style.height=`${area.clientHeight}px`;return;
    }
    if (this.mode === 'none'&&!this.integerScale) {
      this.screen.style.removeProperty('width');this.screen.style.removeProperty('height');return;
    }
    const area = this.screen.parentElement!;
    const portrait=this.screen.height>this.screen.width;
    const [width,height]=this.streamSize??[portrait?240:320,portrait?320:240];
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
