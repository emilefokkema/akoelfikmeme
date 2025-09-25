export type AnagramElements = string[]
export interface AnagramListItem {
    elements: AnagramElements
    permutation: number[]
}

export interface SetElements {
    type: 'setElements'
    elements: AnagramElements
}