import {t} from '../i18n';
import type {MountedFile} from '../storage/saves';

let assets:Promise<MountedFile[]>|undefined;
export function frontendAssets() {
  if(!assets)assets=(async()=>{
    const base=import.meta.env.BASE_URL+'runtime/frontend/';
    const [indexResponse,dataResponse]=await Promise.all([fetch(base+'assets.json'),fetch(base+'assets.bin')]);
    if(!indexResponse.ok||!dataResponse.ok)throw new Error(t('无法加载 RetroArch 前端资源，请联网后重试。'));
    const index=await indexResponse.json() as {files:[string,number,number][]};
    const bytes=new Uint8Array(await dataResponse.arrayBuffer());
    return index.files.map(([path,offset,length])=>({path,bytes:bytes.subarray(offset,offset+length)}));
  })().catch(error=>{assets=undefined;throw error;});
  return assets;
}
