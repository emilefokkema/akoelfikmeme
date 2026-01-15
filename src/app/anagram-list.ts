import type { AnagramElements, AnagramListClient, AnagramListItem } from "../shared/anagram-list-messages";
import { createRequestResponseClient } from "./request-response-client";
import type { VeryLongListData } from "./very-long-list/very-long-list-data"
import { createWorkerRequests } from "./worker-requests"

export interface AnagramList {
    setElements(elements: AnagramElements, abortSignal: AbortSignal): Promise<void>
    getListData(abortSignal: AbortSignal): Promise<VeryLongListData<AnagramListItem>>
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
        getRelativePositionOfItem: true,
        getItemsAtRelativePosition: true
    });
    return {
        setElements(elements, abortSignal) {
            return client.setElements(elements, abortSignal);
        },
        async getListData(abortSignal) {
            const data = await client.getItems({ maxItems: 1 }, abortSignal);
            return {
                items: data,
                total: {
                    getRelativePositionOfItem(item, abortSignal2) {
                        return client.getRelativePositionOfItem(item, abortSignal2)
                    },
                    getItemsAtRelativePosition(position: number, nrOfItems: number, abortSignal?: AbortSignal){
                        return client.getItemsAtRelativePosition({ relativePosition: position, maxItems: nrOfItems}, abortSignal)
                    }
                },
                getItemsAfterItem(item, maxItems, abortSignal2) {
                    return client.getItemsAfterItem({item, maxItems}, abortSignal2)
                },
                getItemsBeforeItem(item, maxItems, abortSignal2) {
                    return client.getItemsBeforeItem({item, maxItems}, abortSignal2)
                },
                renderItem(item) {
                    const anagramItem = document.createElement('anagram-item');
                    anagramItem.setItem(item);
                    return anagramItem;
                }
            };
        },
    }
}