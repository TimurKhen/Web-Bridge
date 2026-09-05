import { createContract } from '../lib/contract';
import { workerTransport } from '../lib/transport';

// 1. Инициализация контракта с транспортом воркера
const worker = new Worker(new URL('./calc.worker.ts', import.meta.url), { type: 'module' });
const contract = new createContract(workerTransport(worker));

// 2. Первый подписчик: обновляет UI
const unsubscribeUI = contract.on((data) => {
    console.log('UI Listener получил результат:', data.result);
});

// 3. Второй подписчик: логирование метрик
const unsubscribeLogger = contract.on((data) => {
    console.log('[Analytics] Операция завершена со статусом:', data.status);
});

// 4. Отправляем запрос на сложение чисел в воркер
contract.emit({
    action: 'sum',
    a: 40,
    b: 2,
});

// 5. Отписка от событий (когда слушатель больше не нужен)
setTimeout(() => {
    unsubscribeUI(); // через возвращенную функцию
    unsubscribeLogger();
    console.log('UI отписан от событий');
}, 1000);
