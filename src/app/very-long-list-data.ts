export interface VeryLongListItems<TItem = unknown> {
    items: TItem[]
    hasPrevious: boolean
    hasNext: boolean
}

export interface VeryLongListData<TItem = unknown> {
    items: VeryLongListItems<TItem>
    getItemsAfterItem(item: TItem, nrOfItems: number): Promise<VeryLongListItems<TItem>>
    getItemsBeforeItem(item: TItem, nrOfItems: number): Promise<VeryLongListItems<TItem>>
    renderItem(item: TItem): Element
}