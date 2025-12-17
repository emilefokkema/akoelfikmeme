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
export interface ItemsRequest {
    maxItems: number
}
export interface ItemsAtRelativePositionRequest extends ItemsRequest {
    relativePosition: number
}

export interface AnagramListClient {
    setElements(elements: AnagramElements): void
    getItems(request: ItemsRequest): AnagramListItemData
    getItemsAfterItem(request: ContinuationRequest): AnagramListItemData
    getItemsBeforeItem(request: ContinuationRequest): AnagramListItemData
    getRelativePositionOfItem(item: AnagramListItem): number
    getItemsAtRelativePosition(request: ItemsAtRelativePositionRequest): AnagramListItemData
}