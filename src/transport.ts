export interface Transport<T = any> {
    send(data: T): void;
    onMessage(handler: (data: T) => void): () => void;
    terminate?(): void;
}
