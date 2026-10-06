import {t,setText} from './i18n';
interface InstallPrompt extends Event {
  prompt():Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}

function waitForController(scriptURL:string):Promise<ServiceWorker> {
  return new Promise((resolve,reject)=>{
    const done=()=>{
      const worker=navigator.serviceWorker.controller;
      if(worker?.scriptURL===scriptURL){cleanup();resolve(worker);}
    };
    const timer=setTimeout(()=>{cleanup();reject(new Error('controller timeout'));},30000);
    const cleanup=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);};
    navigator.serviceWorker.addEventListener('controllerchange',done);done();
  });
}

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
  let prompt:InstallPrompt|undefined;
  let gameStarted=false;
  // Import is briefly gated while the first install prepares isolation. If it
  // takes longer, allow compatible audio and never reload after game selection.
  const fallback={ready:Promise.resolve(),gameStarted:()=>{gameStarted=true;}};
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();prompt=event as InstallPrompt;install.hidden=standalone();
  });
  window.addEventListener('appinstalled',()=>{prompt=undefined;install.hidden=true;});
  install.onclick=async()=>{
    if(!prompt)return;
    const current=prompt;prompt=undefined;install.hidden=true;
    try {await current.prompt();await current.userChoice;} catch {setText(status,t("请通过浏览器菜单安装网页应用。"));}
  };
  if(!import.meta.env.PROD){setText(status,t("离线安装支持将在构建版本中启用。"));return fallback;}
  if(!('serviceWorker' in navigator)||!window.isSecureContext){setText(status,t("安装和离线运行需要 HTTPS 或本机地址。"));return fallback;}
  setText(status,t("正在准备离线运行包…"));
  const preparation=(async()=>{
    try {
      const root=new URL(import.meta.env.BASE_URL,location.href);
      const registration=await navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.href,updateViaCache:'none'});
      let isolationNote='';
      const ready=()=>{setText(status,registration.waiting?t("新版已准备好，关闭所有应用窗口后重新打开即可更新。"):t("{0}{1}",navigator.onLine?t("离线运行已就绪"):t("离线模式 · 可导入本地 .app"),isolationNote));};
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&registration.active)ready();
          if(worker.state==='redundant')setText(status,registration.active?t("新版离线准备未完成；当前版本仍可离线使用。"):t("离线准备未完成，联网后刷新重试。"));
        });
      });
      // ready alone may resolve to an ancestor site's registration. Wait for
      // our own controller so /<repo>/ installations get their own cache/policy.
      const worker=await waitForController(new URL('sw.js',root).href);
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
    } catch {setText(status,t("离线准备未完成，联网后刷新重试。"));}
  })();
  let timeout:ReturnType<typeof setTimeout>;
  const deadline=new Promise<void>(resolve=>{timeout=setTimeout(resolve,8000);});
  const ready=Promise.race([preparation,deadline]).finally(()=>clearTimeout(timeout));
  return {ready,gameStarted:fallback.gameStarted};
}

