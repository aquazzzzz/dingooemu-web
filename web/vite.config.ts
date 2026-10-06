import { defineConfig } from 'vite';
import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';

// Version the complete release, including public Wasm and font assets.
function offlineRelease() {
  let output='';
  return {
    name:'dingoo-offline-release', apply:'build' as const,
    configResolved(config:{root:string;build:{outDir:string}}) {output=resolve(config.root,config.build.outDir);},
    async closeBundle() {
      async function files(dir:string):Promise<string[]> {
        const entries=await readdir(dir,{withFileTypes:true});
        return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(resolve(dir,entry.name)):Promise.resolve([resolve(dir,entry.name)])))).flat();
      }
      const paths=(await files(output)).map(path=>relative(output,path).replaceAll('\\','/')).filter(path=>path!=='sw.js'&&!path.startsWith('_')).sort();
      const template=await readFile(new URL('./service-worker.js',import.meta.url),'utf8');
      const hash=createHash('sha256').update(template);
      for(const path of paths)hash.update(path).update(await readFile(resolve(output,path)));
      const version=hash.digest('hex').slice(0,20);
      await writeFile(resolve(output,'sw.js'),template.replace('__VERSION__',JSON.stringify(version)).replace('__ASSETS__',JSON.stringify(paths)));
    }
  };
}
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({base: process.env.WEB_BASE || './', plugins:[offlineRelease()], server:{headers}, preview:{headers}, worker: {format: 'es'}, build: {target: 'es2022', rolldownOptions:{input:{main:resolve(import.meta.dirname,'index.html'),licenses:resolve(import.meta.dirname,'licenses.html')}}}});
