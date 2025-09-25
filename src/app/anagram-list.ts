import type { AnagramElements, AnagramListItem, SetElements } from "../shared/anagram-list-messages";
import type { VeryLongListData } from "./very-long-list-data"
import { createWorkerRequests } from "./worker-requests"

export interface AnagramList {
    setElements(elements: AnagramElements, abortSignal: AbortSignal): Promise<void>
    getListData(): Promise<VeryLongListData<AnagramListItem>>
}

export function createAnagramList(): AnagramList {
    const worker = new Worker('../worker/main.ts');
    worker.addEventListener('error', e => console.log(e))
    const requests = createWorkerRequests(worker);
    return {
        setElements(elements, abortSignal) {
            const request: SetElements = {
                type: 'setElements',
                elements
            }
            return requests.send<void>(request, abortSignal);
        },
        getListData() {
            return Promise.resolve({
                items: {
                    items: [
                        {
                            elements: ['a','n', 'a', 'g', 'r', 'a', 'm'],
                            permutation: [0, 1, 2, 3, 4, 5, 6]
                        }
                    ],
                    hasPrevious: false,
                    hasNext: false
                },
                getItemsAfterItem(item, nrOfItems) {
                    return Promise.resolve({
                        items: [],
                        hasPrevious: false,
                        hasNext: false
                    })
                },
                getItemsBeforeItem(item, nrOfItems) {
                    return Promise.resolve({
                        items: [],
                        hasPrevious: false,
                        hasNext: false
                    })
                },
                renderItem(item) {
                    const span = document.createElement('span');
                    span.textContent = item.elements.join('');
                    return span;
                },
            })
        },
    }
}