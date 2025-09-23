import type { VeryLongListData } from "./very-long-list-data"

export type AnagramElements = string[]
export interface AnagramListItem {
    elements: AnagramElements
    permutation: number[]
}

export interface AnagramList {
    setElements(elements: AnagramElements): Promise<void>
    getListData(): Promise<VeryLongListData<AnagramListItem>>
}

export function createAnagramList(): AnagramList {
    const worker = new Worker('../worker/main.ts');
    worker.postMessage('blah')
    return {
        setElements(elements) {
            return Promise.resolve();
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