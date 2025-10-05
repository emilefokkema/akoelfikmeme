import type { AnagramElements, AnagramListClient, AnagramListItem } from "../shared/anagram-list-messages";
import { createRequestResponseClient } from "./request-response-client";
import type { VeryLongListData } from "./very-long-list-data"
import { createWorkerRequests } from "./worker-requests"

export interface AnagramList {
    setElements(elements: AnagramElements, abortSignal: AbortSignal): Promise<void>
    getListData(abortSignal: AbortSignal): Promise<VeryLongListData<AnagramListItem> | undefined>
}

export function createAnagramList(): AnagramList {
    const worker = new Worker('../worker/main.ts', {type: 'module'});
    worker.addEventListener('error', e => console.log(e))
    const requests = createWorkerRequests(worker);
    const client = createRequestResponseClient<AnagramListClient>(requests, {
        setElements: true,
        getItems: true,
        getItemsAfterItem: true,
        getItemsBeforeItem: true,
        getRelativePositionOfItem: true
    });
    return {
        setElements(elements, abortSignal) {
            return client.setElements(elements, abortSignal);
        },
        async getListData(abortSignal) {
            const data = await client.getItems(undefined, abortSignal);
            if(!data){
                return undefined;
            }
            return {
                items: data,
                getItemsAfterItem(item, maxItems) {
                    return client.getItemsAfterItem({item, maxItems}, abortSignal)
                },
                getItemsBeforeItem(item, maxItems) {
                    return client.getItemsBeforeItem({item, maxItems}, abortSignal)
                },
                renderItem(item) {
                    const span = document.createElement('span');
                    span.textContent = item.elements.join('');
                    return span;
                },
                getRelativePositionOfItem(item) {
                    return client.getRelativePositionOfItem(item, abortSignal)
                },
            };
        },
    }
}