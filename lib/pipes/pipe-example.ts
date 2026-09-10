import { Contract } from "../contract";

// adding methods to contract for TS know that.
declare module "../contract" {
    interface Contract<TResponse = any> {
        pipe(): any
    }
}

// Your fn.
export function pipe<TResponse = any>(contract: Contract<TResponse>) {

}


// Setup prototype:
Contract.prototype.pipe = function () {
    return pipe(this);
};
