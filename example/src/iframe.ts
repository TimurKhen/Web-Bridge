import {acceptMessagePort, Bridge} from '../../lib/src';
import type {Message} from "../../lib/src/transports/messagePort.ts";

async function initIframe() {
    const statusDiv = document.getElementById('iframe-status')!;

    const transport = await acceptMessagePort();
    statusDiv.textContent = 'Порт получен! Связь установлена.';

    const bridge = new Bridge<Message>(transport);

    bridge.on(() => {
        statusDiv.innerHTML = `Последнее сообщение: <br><b>${new Date().getTime()}</b>`;

        bridge.emit({
            payload: "qwerty", type: "answer"
        });
    });
}

initIframe();
