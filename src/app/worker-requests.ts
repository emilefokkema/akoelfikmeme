import type { WorkerResponse, SuccessWorkerResponse, ErrorWorkerResponse } from "../shared/worker-messages"

export interface WorkerRequests {
    send<TResponse>(request: unknown, abortSignal: AbortSignal): Promise<TResponse>
}

interface PendingWorkerRequest {
    id: string
    resolve(result: unknown): void
    reject(reason: unknown): void
}

function isWorkerResponse(data: unknown): data is WorkerResponse {
    return !!data && (data as WorkerResponse).requestId !== undefined;
}

function isSuccess(response: WorkerResponse): response is SuccessWorkerResponse {
    return (response as SuccessWorkerResponse).result !== undefined;
}

function isError(response: WorkerResponse): response is ErrorWorkerResponse {
    return (response as ErrorWorkerResponse).reason !== undefined;
}

export function createWorkerRequests(worker: Worker): WorkerRequests {
    let requestCount = 0;
    const requests: PendingWorkerRequest[] = [];
    worker.addEventListener('message', ({data}) => {
        if(!isWorkerResponse(data)){
            return;
        }
        if(isSuccess(data)){
            resolveRequest(data.requestId, data.result);
            return;
        }
        if(isError(data)){
            rejectRequest(data.requestId, data.reason);
        }
    })
    return {
        send<TResponse>(request: unknown, abortSignal: AbortSignal) {
            const { promise, resolve, reject } = Promise.withResolvers<TResponse>();
            const requestId = `${requestCount++}`
            requests.push({
                id: requestId,
                resolve,
                reject
            });
            abortSignal.addEventListener('abort', () => cancelRequest(requestId));
            worker.postMessage({
                id: requestId,
                payload: request
            })
            return promise;
        },
    }
    function rejectRequest(requestId: string, reason: unknown): void {
        const request = removeAndGetRequest(requestId);
        if(!request){
            return;
        }
        request.reject(reason);
    }
    function resolveRequest(requestId: string, result: unknown): void {
        const request = removeAndGetRequest(requestId);
        if(!request){
            return;
        }
        request.resolve(result);
    }
    function removeAndGetRequest(requestId: string): PendingWorkerRequest | undefined{
        const index = requests.findIndex(r => r.id === requestId);
        if(index === -1){
            return undefined;
        }
        const [result] = requests.splice(index, 1);
        return result;
    }
    function cancelRequest(requestId: string): void {
        removeAndGetRequest(requestId);
    }
}