export type AnagramElements = string[]

export interface AnagramList {
    setElements(elements: AnagramElements): Promise<void>
}

export function createAnagramList(): AnagramList {
    return {
        setElements(elements) {
            return Promise.resolve();
        },
    }
}