export interface Transport {
    send(data: { 'uuid': string, 'payload': any }): void;

    onMessage(handler: (data: any) => void): () => void;

    terminate?(): void;
}
