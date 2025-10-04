import type { WorkerRequest } from "../shared/worker-messages"

function isRequest(data: unknown): data is WorkerRequest {
    return !!data && (data as WorkerRequest).payload !== undefined;
}

export function respondToRequests(handleRequest: (request: unknown) => unknown): void {
    addEventListener('message', ({ data }) => {
        if(!isRequest(data)){
            return;
        }
        try {
            const result = handleRequest(data.payload);
            postMessage({
                requestId: data.id,
                result
            })
        } catch (e) {
            postMessage({
                requestId: data.id,
                reason: `${e}`
            })
        }
    })
}