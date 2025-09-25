import type { SetElements } from "../shared/anagram-list-messages";
import type { WorkerRequest } from "../shared/worker-messages"
import { AnagramList } from "./anagram-list";

const list = new AnagramList();

function isRequest(data: unknown): data is WorkerRequest {
    return !!data && (data as WorkerRequest).payload !== undefined;
}

function isSetElements(message: unknown): message is SetElements {
    return (message as SetElements).type === 'setElements';
}

function handleRequest(request: unknown): unknown {
    if(isSetElements(request)){
        return list.setElements(request.elements);
    }
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