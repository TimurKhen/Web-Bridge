import { Contract } from "../lib";
import { workerTransport } from "../lib";
import "../lib/pipes/pipe";

interface CalcResponse {
    status: string;
    result: number;
}

const worker = new Worker(new URL("./calc.worker.ts", import.meta.url), { type: "module" });
const contract = new Contract<CalcResponse>(workerTransport(worker));


const unsubscribe = contract.on((value) => {
    console.log(value);
});

contract.emit({ action: "sum", a: 5, b: 5 });
contract.emit({ action: "sum", a: 2, b: 3 });

setTimeout(() => { unsubscribe(); }, 1000);
