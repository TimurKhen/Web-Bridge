import { Bridge, createWorker } from '../../lib/src';

const bridge = new Bridge<string>(createWorker());

bridge.on((message) => {
    console.log('[Worker log] Получено:', message);

    bridge.emit('bye')
});
