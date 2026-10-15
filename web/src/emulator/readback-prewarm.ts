// Used only while the owning Worker is paused after a successful readback.
export async function waitForReadbackPrewarm(
  call:(op:number)=>Promise<number>,
  now:()=>number=()=>performance.now(),
  sleep:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
):Promise<'ready'|'empty'|'cancelled'> {
  const deadline=now()+50;
  try {
    for (;;) {
      const status=await call(25),remaining=deadline-now();
      if(status===2)return 'empty';
      if(status===1&&remaining>=0)return 'ready';
      if(status!==0||remaining<=0)break;
      await sleep(Math.min(4,remaining));
    }
  } catch { /* A failed poll must cancel before the caller resumes the core. */ }
  if(await call(26)!==1)throw new Error('Could not cancel readback precompilation');
  return 'cancelled';
}
