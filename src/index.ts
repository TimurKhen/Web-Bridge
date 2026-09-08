import {Contract, workerTransport} from "../lib/";
import {map} from "rxjs/operators";

import "../lib/pipes/modes";
import "../lib/pipes/rxjs";

interface CalcResponse {
    status: string;
    result: number;
}

const worker = new Worker(new URL("./calc.worker.ts", import.meta.url), {
    type: "module",
});

const contract = new Contract<CalcResponse>(workerTransport(worker));

const subscription = contract.toObservable()
    .pipe(map(data => data.result),)
    .subscribe((totalSum) => {
        console.log(`rxjs: ${totalSum}`);
    });


contract.makeSync();
contract.emit({action: "sum", a: 10, b: 2});
contract.emit({action: "sum", a: 5, b: 5});

setTimeout(() => {
    contract.makeAsync();

    contract.emit({action: "sum", a: 100, b: 10});
    contract.emit({action: "sum", a: 20, b: 20});
    contract.emit({action: "sum", a: 20, b: 20});
}, 1000);


setTimeout(() => {
    subscription.unsubscribe();
    contract.destroy();
}, 20000);
