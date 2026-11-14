// Execute generated modules against fixtures produced by the existing ARM CPU.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const groups=JSON.parse(await readFile(process.argv[2],'utf8'));
let count=0;
for(const shared of [false,true]){
  const memory=new WebAssembly.Memory({initial:1800,maximum:32768,shared});
  const view=new DataView(memory.buffer), bytes=new Uint8Array(memory.buffer);
  const pointers=[65536,65536+0x4000000,65536+0x4100000,65536+0x6100000];
  for(const group of groups){
    const {instance}=await WebAssembly.instantiate(Uint8Array.from(shared?group.sharedModule:group.module),{env:{memory}});
    for(const row of group.cases){
      [256,320,...pointers,0x21000000,0x10100000,0x10200000,Number(row.packed)].forEach((v,i)=>view.setUint32(i*4,v,true));
      row.regs.forEach((v,i)=>view.setUint32(256+i*4,v,true));view.setUint32(320,row.flags,true);
      for(const p of pointers)for(let i=0;i<256;i++)bytes[p+i]=(i*37+19)&255;
      const result=instance.exports.block(0,row.budget,256,320);
      const label=`${shared?'shared':'ordinary'}/${group.words.map(w=>w.toString(16))}/${count}`;
      assert.equal(Number(result&0xffffffffn),row.steps,label+'/count');
      for(let i=0;i<16;i++)assert.equal(view.getUint32(256+i*4,true),row.expectedRegs[i],label+'/r'+i);
      assert.equal(view.getUint32(320,true),row.expectedFlags,label+'/CPSR');
      const actual=pointers.flatMap(p=>Array.from(bytes.subarray(p,p+256)));
      assert.deepEqual(actual,row.memory,label+'/memory');count++;
    }
  }
}
console.log(`A330 Wasm differential: ${count} cases passed (ordinary and shared memory).`);
