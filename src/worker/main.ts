import type { WorkerRequest } from "../shared/worker-messages"

function isRequest(data: unknown): data is WorkerRequest {
    return !!data && (data as WorkerRequest).payload !== undefined;
}

function handleRequest(request: unknown): unknown {
    console.log('handling request', request)
    return 'foo!';
}

addEventListener('message', ({data}) => {
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