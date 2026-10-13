import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fixtures=JSON.parse(await readFile(process.argv[2],'utf8'));
let executions=0,mutatedBytes=0;
const ramSize=32*1024*1024,ramBase=65536,context=64,registers=256,layout=fixtures.registers;
for(const shared of [false,true]){
 const memory=new WebAssembly.Memory({initial:515,maximum:32768,shared});
 let bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
 function put(state,base=ramBase){
  bytes.fill(0xa5,0,4096);view.setUint32(context,registers,true);view.setUint32(context+4,base,true);
  for(const [offset,name] of [[16,'branchDelay'],[20,'branchTarget'],[24,'branchPending']])view.setUint32(context+offset,state[name]??0,true);
  state.gpr.forEach((v,i)=>view.setUint32(registers+layout.gpr+i*4,v,true));
  for(const name of ['pc','hi','lo'])view.setUint32(registers+layout[name],state[name],true);
 }
 let last;
 for(const g of fixtures.groups){
  const code=Uint8Array.from(g.words.flatMap(w=>[w&255,(w>>>8)&255,(w>>>16)&255,w>>>24]));
  const source=ramBase+g.physical;bytes.set(code,source);
  const {instance}=await WebAssembly.instantiate(Uint8Array.from(shared?g.shared:g.regular),{env:{memory}});
  function invoke(before,budget,exit,count,after){
   put(before);const expected=bytes.slice(0,4096);
   if(after){const ev=new DataView(expected.buffer);after.gpr.forEach((v,i)=>ev.setUint32(registers+layout.gpr+i*4,v,true));for(const name of ['pc','hi','lo'])ev.setUint32(registers+layout[name],after[name],true);}
   assert.equal(instance.exports.block(context,budget),(BigInt(exit)<<32n)|BigInt(count));
   assert.deepEqual(bytes.slice(0,4096),expected,'full context/registers untouched outside expected CPU writes');
   executions++;
  }
  invoke(g.before,g.count,1,g.count,g.after);
  invoke(g.before,g.count-1,2,0);
  invoke({...g.before,pc:(g.start+4)>>>0},g.count,3,0);
  for(let i=0;i<code.length;i++){
   bytes[source+i]^=1;
   for(const [budget,pc] of [[g.count,g.start],[0,g.start],[g.count,(g.start+4)>>>0]])invoke({...g.before,pc},budget,5,0);
   assert.equal(bytes[source+i],code[i]^1,'stale exit did not repair/mutate code');
   bytes[source+i]^=1;mutatedBytes++;
  }
  // Outside-prefix bytes do not cause false stale exits or an over-read.
  if(g.physical>0){bytes[source-1]^=1;invoke(g.before,g.count,1,g.count,g.after);bytes[source-1]^=1;}
  if(g.physical+code.length<ramSize){bytes[source+code.length]^=1;invoke(g.before,g.count,1,g.count,g.after);bytes[source+code.length]^=1;}
  assert.deepEqual(bytes.slice(source,source+code.length),code);
  bytes.fill(0,source,source+code.length);last={g,code,instance};
 }
 // A fresh RAM pointer after growth/relocation must be consumed on every call.
 memory.grow(520);bytes=new Uint8Array(memory.buffer);view=new DataView(memory.buffer);
 const relocated=ramBase+ramSize+65536,{g,code,instance}=last;
 bytes.set(code,relocated+g.physical);put(g.before,relocated);
 assert.equal(instance.exports.block(context,g.count),(1n<<32n)|BigInt(g.count));executions++;
 bytes[relocated+g.physical+code.length-1]^=1;put(g.before,relocated);const before=bytes.slice(0,4096);
 assert.equal(instance.exports.block(context,g.count),5n<<32n);assert.deepEqual(bytes.slice(0,4096),before);executions++;
}
console.log(JSON.stringify({guardGroups:fixtures.groups.length,guardExecutions:executions,mutatedBytes,memoryModes:['ordinary','shared'],zeroMutationStaleExit:true,growthAndRamRelocation:true}));
