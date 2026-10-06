interface Tap {
  id:number;
  x:number;
  y:number;
  time:number;
  target:HTMLElement;
}

// Some iOS versions still zoom on double taps with touch-action: manipulation.
// Cancel only the end of a second short, stationary tap; never cancel a swipe.
export function setupTouchGestures(root:HTMLElement) {
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)
    ||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!ios)return;
  const controlSelector='[data-button],[data-dpad],#control-settings-toggle';
  const isControl=(target:EventTarget|null)=>{
    const element=target instanceof Element?target:target instanceof Node?target.parentElement:null;
    const control=element?.closest(controlSelector);
    return !!control&&root.contains(control);
  };
  // Cancel native selection/callouts, not touchstart or touchmove: dragging
  // from a virtual control must still be able to scroll the page.
  const preventControlAction=(event:Event)=>{
    if(event.cancelable&&isControl(event.target))event.preventDefault();
  };
  root.addEventListener('contextmenu',preventControlAction,{capture:true});
  root.addEventListener('selectstart',preventControlAction,{capture:true});
  // Some WebKit versions bypass selectstart when selecting on a long press.
  // Clear only selections that touch a virtual control; leave other text alone.
  root.ownerDocument.addEventListener('selectionchange',()=>{
    const selection=root.ownerDocument.getSelection();
    if(selection&&!selection.isCollapsed&&(isControl(selection.anchorNode)||isControl(selection.focusNode))) {
      selection.removeAllRanges();
    }
  });
  let active:Tap|undefined,previous:Tap|undefined;
  const reset=()=>{active=undefined;previous=undefined;};
  const nativeField='input,textarea,select,[contenteditable]:not([contenteditable="false"])';
  const tapTarget=(target:EventTarget|null):HTMLElement|undefined=>{
    if(!(target instanceof Element)||target.closest(nativeField))return;
    const control=target.closest<HTMLElement>('button,a[href],label,summary,[data-dpad]');
    // Keep native field editing, selection and slider gestures, including labels.
    if(control instanceof HTMLLabelElement&&control.control?.matches(nativeField))return;
    const element=control||target;
    return element instanceof HTMLElement?element:undefined;
  };
  root.addEventListener('touchstart',event=>{
    const target=tapTarget(event.target);
    if(event.touches.length!==1||!target){reset();return;}
    const touch=event.touches[0];
    active={id:touch.identifier,x:touch.clientX,y:touch.clientY,time:event.timeStamp,target};
  },{passive:true});
  root.addEventListener('touchmove',event=>{
    if(!active)return;
    const touch=event.touches[0];
    if(event.touches.length!==1||touch.identifier!==active.id
      ||Math.hypot(touch.clientX-active.x,touch.clientY-active.y)>10)reset();
  },{passive:true});
  root.addEventListener('touchcancel',reset,{passive:true});
  root.addEventListener('touchend',event=>{
    const start=active;active=undefined;
    const touch=Array.from(event.changedTouches).find(touch=>touch.identifier===start?.id);
    if(!start||!touch||event.touches.length||event.timeStamp-start.time>300
      ||Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>10){previous=undefined;return;}
    const tap={...start,x:touch.clientX,y:touch.clientY,time:event.timeStamp};
    const doubleTap=previous&&tap.time-previous.time>=0&&tap.time-previous.time<=350
      &&Math.hypot(tap.x-previous.x,tap.y-previous.y)<=30;
    previous=tap;
    if(!doubleTap||!event.cancelable)return;
    event.preventDefault();
    // touchend cancellation also suppresses the compatibility click. Restore
    // normal button/link activation; game controls already use pointer events.
    if(tap.target.isConnected&&!tap.target.matches('[data-button],[data-dpad]')
      &&tap.target.matches('button,a[href],label,summary'))tap.target.click();
  },{passive:false});
}
