import {Contract} from "../contract";


const ORIG_EMIT = Symbol("orig_emit");
const ORIG_DESTROY = Symbol("orig_destroy");
const SYNC_CLEANUP = Symbol("sync_cleanup");


declare module "../contract" {
    interface Contract<TResponse = any> {
        makeSync(): this;

        makeAsync(): this;
    }
}

export function modes<TResponse = any>(contract: Contract<TResponse>): Contract<TResponse> {
    if ((contract as any)[SYNC_CLEANUP]) {
        return contract;
    }

    const target = contract as any;

    if (!target[ORIG_EMIT]) {
        target[ORIG_EMIT] = contract.emit.bind(contract);
        target[ORIG_DESTROY] = contract.destroy.bind(contract);
    }

    const rawEmit = target[ORIG_EMIT];
    const rawDestroy = target[ORIG_DESTROY];
    const queue: any[] = [];
    let isProcessing = false;

    const processNext = () => {
        if (queue.length === 0) {
            isProcessing = false;
            return;
        }

        isProcessing = true;
        const payload = queue.shift();
        rawEmit(payload);
    };


    const unsubscribe = contract.on(() => {
        if (isProcessing) {
            processNext();
        }
    });


    contract.emit = function (payload: any): void {
        queue.push(payload);
        if (!isProcessing) {
            processNext();
        }
    };


    const cleanup = () => {
        unsubscribe();
        queue.length = 0;
        isProcessing = false;
        target[SYNC_CLEANUP] = undefined;
    };

    target[SYNC_CLEANUP] = cleanup;


    contract.destroy = function (): void {
        cleanup();
        rawDestroy();
    };

    return contract;
}


export function makeAsync<TResponse = any>(contract: Contract<TResponse>): Contract<TResponse> {
    const target = contract as any;

    if (target[SYNC_CLEANUP]) {
        target[SYNC_CLEANUP]();
    }

    if (target[ORIG_EMIT]) {
        contract.emit = target[ORIG_EMIT];
    }
    if (target[ORIG_DESTROY]) {
        contract.destroy = target[ORIG_DESTROY];
    }

    return contract;
}


Contract.prototype.makeSync = function () {
    return modes(this);
};

Contract.prototype.makeAsync = function () {
    return makeAsync(this);
};
