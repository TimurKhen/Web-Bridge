export interface Transport<T> {
    send(data: T): void;
    onMessage(handler: (data: T) => void): () => void;
    terminate(): void;
}
