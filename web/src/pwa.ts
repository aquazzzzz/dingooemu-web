import {t,setText,literal} from './i18n';
interface InstallPrompt extends Event {
  prompt():Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}

function waitForController(scriptURL:string,signal:AbortSignal):Promise<ServiceWorker> {
  return new Promise((resolve,reject)=>{
    const done=()=>{
      const worker=navigator.serviceWorker.controller;
      if(worker?.scriptURL===scriptURL){cleanup();resolve(worker);}
    };
    // Large Wasm/font downloads can legitimately take longer than thirty seconds.
    const timer=setTimeout(()=>{cleanup();reject(new Error(t("离线包下载仍未完成，请检查网络后刷新重试。")));},180000);
    const failed=()=>{cleanup();reject(new Error('offline installation failed'));};
    const cleanup=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);signal.removeEventListener('abort',failed);};
    navigator.serviceWorker.addEventListener('controllerchange',done);signal.addEventListener('abort',failed);
    if(signal.aborted)failed();else done();
  });
}

interface OfflineStatus {type:string;scope:string;phase:string;completed:number;total:number;reason?:string;resource?:string}

function isolationVersion(worker:ServiceWorker):Promise<string|undefined> {
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const done=(version?:string)=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(version);};
    const timer=setTimeout(()=>done(),750);
    channel.port1.onmessage=event=>done(event.data?.isolation===true&&typeof event.data.version==='string'?event.data.version:undefined);
    worker.postMessage({type:'isolation-status'},[channel.port2]);
  });
}

export function setupPwa() {
  const status=document.querySelector<HTMLElement>('#pwa-status')!;
  const install=document.querySelector<HTMLButtonElement>('#pwa-install')!;
  const guide=document.querySelector<HTMLElement>('#pwa-install-guide')!;
  const homeGuide=guide.querySelector<HTMLElement>('[data-install-guide="ios"]')!;
  const dockGuide=guide.querySelector<HTMLElement>('[data-install-guide="mac"]')!;
  let prompt:InstallPrompt|undefined;
  let installed=false;
  let gameStarted=false;
  // Import is briefly gated while the first install prepares isolation. If it
  // takes longer, allow compatible audio and never reload after game selection.
  const fallback={ready:Promise.resolve(),prepared:Promise.resolve(),gameStarted:()=>{gameStarted=true;}};
  const displayMode=matchMedia('(display-mode: standalone)');
  const standalone=()=>displayMode.matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
  // iOS has no native install prompt. Include iPads using a desktop user agent.
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  // Safari on Mac also uses a browser menu rather than beforeinstallprompt.
  // Its macOS user agent does not reliably identify the installed OS version,
  // so explain the macOS requirement in the guide rather than guessing it.
  const macSafari=!ios&&/Mac/.test(navigator.platform||navigator.userAgent)
    &&/Version\/[\d.]+.*Safari\//.test(navigator.userAgent)
    &&!/Chrome|Chromium|Edg\/|OPR\//.test(navigator.userAgent);
  const manualInstall=ios||macSafari;
  const syncInstall=()=>{
    install.hidden=installed||standalone()||(!prompt&&!manualInstall);
    setText(install,prompt?t("安装网页应用"):macSafari?t("添加到程序坞"):t("添加到主屏幕"));
    homeGuide.hidden=!ios;
    dockGuide.hidden=!macSafari;
    if(install.hidden||prompt)guide.hidden=true;
    if(manualInstall&&!prompt){
      install.setAttribute('aria-controls',guide.id);
      install.setAttribute('aria-expanded',String(!guide.hidden));
    } else {
      install.removeAttribute('aria-controls');install.removeAttribute('aria-expanded');
    }
  };
  syncInstall();
  displayMode.addEventListener('change',syncInstall);
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();prompt=event as InstallPrompt;syncInstall();
  });
  window.addEventListener('appinstalled',()=>{prompt=undefined;installed=true;syncInstall();});
  install.onclick=async()=>{
    if(!prompt){
      if(manualInstall&&!standalone()&&!installed){guide.hidden=!guide.hidden;install.setAttribute('aria-expanded',String(!guide.hidden));}
      return;
    }
    const current=prompt;prompt=undefined;install.hidden=true;
    try {await current.prompt();await current.userChoice;} catch {setText(status,t("请通过浏览器菜单安装网页应用。"));}
  };
  if(!import.meta.env.PROD){setText(status,t("离线安装支持将在构建版本中启用。"));return fallback;}
  if(!('serviceWorker' in navigator)||!window.isSecureContext){setText(status,t("安装和离线运行需要 HTTPS 或本机地址。"));return fallback;}
  setText(status,t("正在准备离线运行包…"));
  const preparation=(async()=>{
    const root=new URL(import.meta.env.BASE_URL,location.href);
    const scriptURL=new URL('sw.js',root).href;
    const installation=new AbortController();
    let offlineFailure='';
    const progress=(data:OfflineStatus)=>{
      if(data?.type!=='offline-status'||data.scope!==root.href)return;
      if(data.phase==='downloading')setText(status,t("正在下载离线运行包：{0}/{1} 项；首次下载可能需要几分钟。",data.completed,data.total));
      if(data.phase==='failed'){
        const reason=data.reason==='timeout'?t("下载超时"):data.reason==='storage'?t("浏览器缓存写入失败"):t("资源下载失败");
        offlineFailure=data.resource?t("离线准备失败：{0}（{1}）。请检查网络和浏览器存储空间后，点击“获取最新版”重试。",literal(data.resource),reason):t("离线准备失败：{0}。请检查网络和浏览器存储空间后，点击“获取最新版”重试。",reason);
        setText(status,offlineFailure);installation.abort();
      }
    };
    navigator.serviceWorker.addEventListener('message',event=>{
      if((event.source as ServiceWorker|null)?.scriptURL===scriptURL)progress(event.data);
    });
    try {
      const registration=await navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.href,updateViaCache:'none'});
      let isolationNote='';
      const ready=()=>{
        if(registration.installing||offlineFailure)return;
        setText(status,registration.waiting?t("新版已准备好，关闭所有应用窗口后重新打开即可更新。"):t("{0}{1}",navigator.onLine?t("离线运行已就绪"):t("离线模式 · 可导入本地 .app"),isolationNote));
      };
      const watched=new WeakSet<ServiceWorker>();
      const watchInstallation=()=>{
        const worker=registration.installing;
        if(!worker||watched.has(worker))return;watched.add(worker);
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&registration.active)ready();
          if(worker.state==='activated')ready();
          if(worker.state==='redundant'){
            if(!offlineFailure)offlineFailure=registration.active?t("新版离线准备未完成；当前版本仍可离线使用。"):t("离线准备未完成，联网后刷新重试。");
            setText(status,offlineFailure);installation.abort();
          }
        });
        // Registration may return after installation has already started. Ask
        // for the latest counters rather than waiting for the next broadcast.
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();channel.port2.close();},750);
        channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();channel.port2.close();progress(event.data);};
        worker.postMessage({type:'offline-status'},[channel.port2]);
      };
      registration.addEventListener('updatefound',watchInstallation);watchInstallation();
      // ready alone may resolve to an ancestor site's registration. Wait for
      // our own controller so /<repo>/ installations get their own cache/policy.
      const worker=await waitForController(scriptURL,installation.signal);
      if(!window.crossOriginIsolated&&'crossOriginIsolated' in window){
        const version=await isolationVersion(worker);
        if(version){
          const key='dingoo-hybrid:isolation-reload:'+root.href;
          let attempted=true;
          try {attempted=sessionStorage.getItem(key)===version;if(!attempted&&!gameStarted)sessionStorage.setItem(key,version);} catch { /* Storage denied: require a manual refresh rather than risk a loop. */ }
          if(!attempted&&!gameStarted){
            setText(status,t("正在启用独立音频线程，即将刷新…"));
            location.reload();
            return await new Promise<void>(()=>{});
          }
          isolationNote=gameStarted?t(" · 结束游戏后刷新，可重试启用独立音频线程。"):t(" · 当前声音使用兼容模式，可刷新重试。");
        }
      }
      ready();
      window.addEventListener('online',ready);window.addEventListener('offline',ready);
    } catch(error) {setText(status,offlineFailure||t("离线准备未完成：{0}",error instanceof Error?error.message:String(error)));}
  })();
  let timeout:ReturnType<typeof setTimeout>;
  const deadline=new Promise<void>(resolve=>{timeout=setTimeout(resolve,8000);});
  const ready=Promise.race([preparation,deadline]).finally(()=>clearTimeout(timeout));
  return {ready,prepared:preparation,gameStarted:fallback.gameStarted};
}
