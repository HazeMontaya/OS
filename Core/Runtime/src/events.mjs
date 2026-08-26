import { EventEmitter } from 'node:events';

export function createEventBus() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);
  const history = [];
  const publish = (type, payload = {}) => {
    const event = { ts: new Date().toISOString(), type, payload };
    history.push(event);
    if (history.length > 500) history.shift();
    emitter.emit(type, event);
    emitter.emit('*', event);
    return event;
  };
  return {
    publish,
    on: (type, handler) => { emitter.on(type, handler); return () => emitter.off(type, handler); },
    recent: (limit = 100) => history.slice(-Math.min(Math.max(Number(limit) || 100, 1), 500)).reverse()
  };
}
