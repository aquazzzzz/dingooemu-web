// All control calls complete asynchronously; never block the browser thread.
addToLibrary({
  $DingooWorker__deps: ['dingooemu_worker_dispatch', '$PThread', '$PlatformEmscriptenFreeBrowser', '$emAudio'],
  $DingooWorker__postset: `
    Module['dingooWorkerCall'] = (op, a = 0, b = 0) => new Promise((resolve, reject) => {
      const id = ++DingooWorker.next;
      const timer = setTimeout(() => {
        DingooWorker.pending.delete(id);
        reject(new Error('Core Worker response timed out'));
      }, 15000);
      DingooWorker.pending.set(id, {resolve, reject, timer});
      if (!_dingooemu_worker_dispatch(id, op, a, b)) {
        clearTimeout(timer); DingooWorker.pending.delete(id);
        reject(new Error('Core Worker is unavailable'));
      }
    });
    Module['dingooWorkerWatch'] = () => {
      for (const worker of [...PThread.unusedWorkers, ...Object.values(PThread.pthreads)])
        worker.addEventListener('error', (event) => {
          DingooWorker.rejectAll(new Error(event.message || 'Core Worker failed'));
          Module['dingooWorkerError']?.(event.message || 'Core Worker failed');
        });
    };
    Module['dingooWorkerStop'] = () => {
      Module['dingooStreamAudioStop']?.();
      DingooWorker.rejectAll(new Error('Core Worker stopped'));
      PThread.terminateAllThreads();
      PlatformEmscriptenFreeBrowser();
      for (const audio of Object.values(emAudio))
        if (typeof audio?.close === 'function') audio.close().catch(() => {});
    };
    // Audio objects are owned by the browser thread even when the core is a
    // pthread. Allocate this branch only while a remote-play session exists.
    let dingooAudioTap;
    Module['dingooStreamAudioStart'] = (muted) => {
      if (dingooAudioTap) throw new Error('Audio stream already active');
      const nodes = Object.values(emAudio).filter(value =>
        typeof AudioWorkletNode !== 'undefined' && value instanceof AudioWorkletNode);
      if (nodes.length !== 1) throw new Error('Game audio is not ready');
      const node = nodes[0], context = node.context;
      const output = context.createMediaStreamDestination(), monitor = context.createGain();
      try {
        node.connect(output);
        monitor.gain.value = muted ? 0 : 1;
        monitor.connect(context.destination);
        node.connect(monitor);
        node.disconnect(context.destination);
      } catch (error) {
        try { node.disconnect(output); node.disconnect(monitor); } catch {}
        monitor.disconnect(); output.stream.getTracks().forEach(track => track.stop());
        throw error;
      }
      dingooAudioTap = {node, context, output, monitor};
      return output.stream;
    };
    Module['dingooStreamMonitorMuted'] = (muted) => {
      if (dingooAudioTap) dingooAudioTap.monitor.gain.value = muted ? 0 : 1;
    };
    Module['dingooStreamAudioStop'] = () => {
      const tap = dingooAudioTap;
      if (!tap) return;
      dingooAudioTap = undefined;
      try { tap.node.disconnect(tap.output); tap.node.disconnect(tap.monitor);
        if (tap.context.state !== 'closed') tap.node.connect(tap.context.destination);
      } catch {}
      tap.monitor.disconnect(); tap.output.stream.getTracks().forEach(track => track.stop());
    };
  `,
  $DingooWorker: {
    next: 0, pending: new Map(),
    rejectAll: function(error) {
      for (var item of this.pending.values()) {clearTimeout(item.timer);item.reject(error);}
      this.pending.clear();
    }
  },
  DingooWorkerComplete__deps: ['$DingooWorker'],
  DingooWorkerComplete__proxy: 'async',
  DingooWorkerComplete: function(id, result) {
    var pending = DingooWorker.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);DingooWorker.pending.delete(id);
    pending.resolve(result);
  }
});
