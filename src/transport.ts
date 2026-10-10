export interface Transport {
    send(data: any): void;

    onMessage(handler: (data: any) => void): () => void;

    terminate?(): void;
}
