import {t,language} from '../i18n';
import type {SaveStore,MountedFile} from '../storage/saves';
import type {SnapshotStore} from '../storage/snapshots';

const root='userdata/web-library/',absolute='/home/web_user/retroarch/';
// Small virtual entries identify data in IndexedDB. Game bytes/resources and
// snapshots are loaded only on selection through the website's existing flow.
export async function frontendLibrary(games:SaveStore,states:SnapshotStore):Promise<MountedFile[]> {
  const [packages,snapshots]=await Promise.all([games.listPackages(),states.list()]);
  const files:MountedFile[]=[];
  const entry=(filename:string,label:string)=>{
    files.push({path:root+filename,bytes:new Uint8Array()});
    return {path:absolute+root+filename,label,core_path:absolute+'cores/dingooemu_libretro.core',core_name:'DingooEmu',crc32:'00000000|crc',db_name:''};
  };
  const playlist=(name:string,items:ReturnType<typeof entry>[])=>files.push({path:'userdata/playlists/'+name+'.lpl',bytes:new TextEncoder().encode(JSON.stringify({version:'1.5',default_core_path:absolute+'cores/dingooemu_libretro.core',default_core_name:'DingooEmu',label_display_mode:0,right_thumbnail_mode:0,left_thumbnail_mode:0,sort_mode:2,items}))});
  playlist('01 '+t('网站游戏库'),packages.sort((a,b)=>a.name.localeCompare(b.name)).map(game=>entry('game-'+game.hash+(game.name.match(/\.(app|cc|c2s|c3s)$/i)?.[0].toLowerCase()||'.app'),game.name)));
  playlist('02 '+t('网站即时存档'),snapshots.map(state=>entry('state-'+state.id+'.app',state.name+' · '+new Date(state.createdAt).toLocaleString(language())+' · '+state.id.slice(0,6))));
  return files;
}
