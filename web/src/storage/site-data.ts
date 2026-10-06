import {t} from '../i18n';

function deleteDatabase(name:string,onBlocked:()=>void):Promise<void> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(name);
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
    // Deletion cannot be cancelled. Keep waiting, with an explicit UI message,
    // until the other window closes its connection instead of reporting success.
    request.onblocked=onBlocked;
  });
}

function clearSettings(storage:Storage,prefix:string) {
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    // Nested installations have a slash in the suffix; they have their own data.
    if(key?.startsWith(prefix)&&!key.slice(prefix.length).includes('/'))keys.push(key);
  }
  for(const key of keys)storage.removeItem(key);
}

export async function clearSiteData(prefix:string,onBlocked:(message:string)=>void) {
  // These are the two databases created by this installation. Do not delete
  // unrelated databases on the same origin (e.g. other GitHub Pages projects).
  for(const suffix of ['files','snapshots']){
    await deleteDatabase(prefix+suffix,()=>onBlocked(t("请关闭本站其他窗口，清理将在解除占用后继续。")));
  }
  clearSettings(localStorage,prefix);
  clearSettings(sessionStorage,prefix);
}
