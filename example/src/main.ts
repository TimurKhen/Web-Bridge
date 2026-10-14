import { Bridge, workerTransport, messagePort } from '../../lib/src';
import {broadcast} from "../../lib/src/transports/broadcast.ts";

const logs = document.getElementById('logs')!;
const log = (msg: string) => { logs.innerHTML += msg + '\n'; };

// ==========================================
// 1. Настройка Web Worker
// ==========================================
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const workerBridge = new Bridge<string>(workerTransport(worker));

workerBridge.on((message) => {
    console.log(message.charCodeAt(0))
    log(`[Main <- Worker]: ${JSON.stringify(message)}`);
});

document.getElementById('btn-worker')!.addEventListener('click', () => {
    log(`[Main -> Worker]: Отправляю hello`);
    workerBridge.emit('hello');
});

// ==========================================
// 2. Настройка Iframe
// ==========================================
const iframe = document.getElementById('target-iframe') as HTMLIFrameElement;

iframe.addEventListener('load', () => {
    const iframeBridge = new Bridge<string>(messagePort(iframe));

    iframeBridge.on((message) => {
        log(`[Main <- Iframe]: ${JSON.stringify(message)}`);
    });

    document.getElementById('btn-iframe')!.addEventListener('click', () => {
        log(`[Main -> Iframe]: Отправляю ping`);
        iframeBridge.emit('test');
    });
});


// ==========================================
// 3. Настройка Broadcast
// ==========================================
const broadcastBridge = new Bridge<any>(broadcast('broadcastTest'))

broadcastBridge.on((message) => {
    document.getElementById('input-preview').textContent = message;
    log(`[Main <- BroadcastTest]: ${JSON.stringify(message)}`);
})

document.getElementById('input').addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    broadcastBridge.emit(target.value);
    log(`[Main -> BroadcastTest]: ${target.value}`);
})
