export interface DisplayedItem<TItem, TDisplayedItem> {
    item: TItem
    displayed: TDisplayedItem
}

export interface ContentDisplay<TItem, TDisplayedItem> {
    appendItems(items: TItem[]): DisplayedItem<TItem, TDisplayedItem>[]
    prependItems(referenceItem: TDisplayedItem, items: TItem[], totalHeight: number): Promise<DisplayedItem<TItem, TDisplayedItem>[]>
    getDisplayedHeight(displayedItem: TDisplayedItem, abortSignal?: AbortSignal): Promise<number | undefined>
    removeDisplayedItem(displayedItem: TDisplayedItem): void
}