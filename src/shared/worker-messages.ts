export interface WorkerRequest {
    id: string
    payload: unknown
}

export interface WorkerResponseBase {
    requestId: string
}

export interface SuccessWorkerResponse extends WorkerResponseBase {
    result: unknown
}

export interface ErrorWorkerResponse extends WorkerResponseBase {
    reason: unknown
}

export type WorkerResponse = SuccessWorkerResponse | ErrorWorkerResponse