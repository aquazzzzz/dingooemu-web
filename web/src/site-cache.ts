import {t,setText} from './i18n';

// A unique navigation bypasses the HTTP document cache. The service worker also
// recognizes this parameter so the outgoing controller cannot serve its index.
const reloadParameter='__dingoo_cache_reset';

export async function clearOfflineCache() {
  const root=new URL(import.meta.env.BASE_URL,location.href);
  if('serviceWorker' in navigator){
    const registrations=await navigator.serviceWorker.getRegistrations();
    for(const registration of registrations)if(registration.scope===root.href)await registration.unregister();
  }
  if('caches' in window){
    const prefix='dingoo-hybrid:'+encodeURIComponent(root.href)+':';
    for(const name of await caches.keys())if(name.startsWith(prefix))await caches.delete(name);
  }
  try {sessionStorage.removeItem('dingoo-hybrid:isolation-reload:'+root.href);} catch {}
}

export function reloadAfterCacheClear() {
  const target=new URL(location.href);
  target.searchParams.set(reloadParameter,Date.now().toString());
  location.replace(target.href);
}

export function setupSiteCache(prepared:Promise<void>,beforeClear:()=>Promise<void>) {
  const button=document.querySelector<HTMLButtonElement>('#clear-site-cache')!;
  const status=document.querySelector<HTMLElement>('#cache-status')!;
  const current=new URL(location.href);
  if(current.searchParams.has(reloadParameter)){
    current.searchParams.delete(reloadParameter);
    history.replaceState(history.state,'',current.href);
  }
  void prepared.then(()=>{button.disabled=false;});
  button.onclick=async()=>{
    if(button.disabled)return;
    if(!navigator.onLine){setText(status,t("请联网后再获取最新版，以便重新下载运行资源。"));return;}
    if(!confirm(t("获取最新版并刷新页面？将清除本站离线缓存并重新下载资源。游戏、存档和设置会保留；当前游戏将停止，未存档的进度会丢失。")))return;
    button.disabled=true;
    setText(status,t("正在准备获取最新版…"));
    try {
      // Save buffered game files before touching offline resources. A save
      // failure must abort the reload, allowing the user to retry or export.
      await beforeClear();
      await clearOfflineCache();
      setText(status,t("正在重新加载页面…"));
      reloadAfterCacheClear();
    } catch {
      setText(status,t("未能获取最新版，页面未刷新。请检查游戏文件保存状态和浏览器权限后重试。"));
      button.disabled=false;
    }
  };
}
