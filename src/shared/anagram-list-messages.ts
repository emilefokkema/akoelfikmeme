export type AnagramElements = string[]
export interface AnagramListItem {
    elements: AnagramElements
    permutation: readonly number[]
}
export interface AnagramListItemData {
    items: AnagramListItem[]
    hasPrevious: boolean
    hasNext: boolean
}
export interface ContinuationRequest {
    item: AnagramListItem,
    maxItems: number
}

export interface AnagramListClient {
    setElements(elements: AnagramElements): void
    getItems(): AnagramListItemData | undefined
    getItemsAfterItem(request: ContinuationRequest): AnagramListItemData
    getItemsBeforeItem(request: ContinuationRequest): AnagramListItemData
    getRelativePositionOfItem(item: AnagramListItem): number
}