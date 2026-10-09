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
      DingooWorker.rejectAll(new Error('Core Worker stopped'));
      PThread.terminateAllThreads();
      PlatformEmscriptenFreeBrowser();
      for (const audio of Object.values(emAudio))
        if (typeof audio?.close === 'function') audio.close().catch(() => {});
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
