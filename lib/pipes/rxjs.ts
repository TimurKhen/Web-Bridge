import { Contract } from "../contract";
import { Observable } from "rxjs";

declare module "../contract" {
    interface Contract<TResponse = any> {
        toObservable(): Observable<TResponse>;
    }
}

export function toObservable<TResponse = any>(contract: Contract<TResponse>): Observable<TResponse> {
    return new Observable<TResponse>((subscriber) => {
        const unsubscribe = contract.on((data) => {
            subscriber.next(data);
        });

        return () => {
            unsubscribe();
        };
    });
}

Contract.prototype.toObservable = function () {
    return toObservable(this);
};
