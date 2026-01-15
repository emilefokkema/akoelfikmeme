import { createQueuedLockManager, throttle } from "../utils";
import type { ContentDisplay, DisplayedItem } from "./content-display";
import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";

export interface DisplayHeightRatioChangedEvent extends CustomEvent {
    detail: {
        displayHeightRatio: number
    }
}

export interface ScrolledRatioChangedEvent extends CustomEvent {
    detail: {
        scrolledRatio: number
    }
}
export interface DisplayedVeryLongListDataEventMap {
    'displayheightratiochanged': DisplayHeightRatioChangedEvent
    'scrolledratiochanged': ScrolledRatioChangedEvent
}

interface DisplayedItemData<TItem, TDisplayedItem> extends DisplayedItem<TItem, TDisplayedItem> {
    hasNext: boolean
    hasPrevious: boolean
}

export class DisplayedData<TItem = unknown, TDisplayedItem = unknown> {
    private eventTarget = new EventTarget();
    private displayHeight = 0;
    private displayHeightRatio = Infinity
    private firstItemRelativePosition: number | undefined;
    private scrollTop = 0;
    private itemHeight = 0;
    private displayedItems: DisplayedItemData<TItem, TDisplayedItem>[] = [];
    private lastInitialDisplayedIndex = -1;
    private initialItems: VeryLongListItems<TItem>
    private throttledDisplay = throttle((abortSignal) => this.display(abortSignal), 100);
    private displayLockManager = createQueuedLockManager();
    private constructor(
        private readonly data: VeryLongListData<TItem>,
        private readonly contentDisplay: ContentDisplay<TItem, TDisplayedItem>
    ){
        this.initialItems = data.items;
    }
    destroy(): void {
        for(const displayedItem of this.displayedItems){
            this.contentDisplay.removeDisplayedItem(displayedItem.displayed);
        }
        this.displayedItems.splice(0, this.displayedItems.length);
    }
    setHeight(height: number, abortSignal?: AbortSignal): void {
        this.displayHeight = height;
        this.displayHeightRatio = Infinity;
        this.throttledDisplay(abortSignal);
    }
    async scrollToPosition(relativePosition: number, abortSignal?: AbortSignal): Promise<void> {
        const lock = await this.displayLockManager.acquire(abortSignal);
        abortSignal?.addEventListener('abort', () => lock.release());
        if(!this.data.total || this.displayHeight === 0 || this.itemHeight === 0){
            return;
        }
        const numberOfItems = Math.ceil(this.displayHeight / this.itemHeight);
        const newItems = await this.data.total.getItemsAtRelativePosition(relativePosition, numberOfItems, abortSignal);
        if(abortSignal?.aborted){
            return;
        }
        this.destroy();
        this.initialItems = newItems;
        this.lastInitialDisplayedIndex = -1;
        await this.lockedDisplay(abortSignal);
        lock.release();
    }
    setScrollTop(scrollTop: number): void {
        this.scrollTop = scrollTop;
        this.setScrolledRatio();
        this.throttledDisplay();
    }
    getScrollTopAtRelativePosition(relativePosition: number): number | undefined {
        const firstItemRelativePosition = this.firstItemRelativePosition;
        if(firstItemRelativePosition === undefined){
            return undefined;
        }
        if(relativePosition < firstItemRelativePosition){
            return undefined;
        }
        const displayedHeight = this.displayedItems.length * this.itemHeight;
        const relativeDisplayedHeight = this.displayHeightRatio * displayedHeight / this.displayHeight;
        const lowestScrollablePosition = Math.max(firstItemRelativePosition, firstItemRelativePosition + relativeDisplayedHeight - this.displayHeightRatio);
        if(relativePosition > lowestScrollablePosition){
            return undefined;
        }
        const result = this.displayHeight * (relativePosition - firstItemRelativePosition) / this.displayHeightRatio;
        return result;
    }
    addEventListener<TType extends keyof DisplayedVeryLongListDataEventMap>(type: TType, listener: (ev: DisplayedVeryLongListDataEventMap[TType]) => void): void {
        this.eventTarget.addEventListener(type, listener as () => void)
    }
    removeEventListener<TType extends keyof DisplayedVeryLongListDataEventMap>(type: TType, listener: (ev: DisplayedVeryLongListDataEventMap[TType]) => void): void {
        this.eventTarget.removeEventListener(type, listener as () => void)
    }
    private async display(abortSignal?: AbortSignal): Promise<void> {
        const lock = await this.displayLockManager.acquire(abortSignal);
        abortSignal?.addEventListener('abort', () => lock.release());
        await this.lockedDisplay(abortSignal);
        lock.release();
    }
    private async lockedDisplay(abortSignal?: AbortSignal): Promise<void> {
        if(this.displayHeight <= 0 || this.initialItems.items.length === 0){
            return;
        }
        if(this.itemHeight === 0){
            const itemHeight = await this.determineItemHeight(abortSignal);
            if(itemHeight === undefined){
                return;
            }
            this.itemHeight = itemHeight;
        }
        const displayedItemHeight = this.itemHeight * this.displayedItems.length;
        const displayBottomHeight = this.scrollTop + this.displayHeight;
        const displayedItemHeightBelow = displayedItemHeight - displayBottomHeight;
        const heightToAddBelow = displayedItemHeightBelow < 0
            ? 2 * this.displayHeight - displayedItemHeightBelow
            : displayedItemHeightBelow < this.displayHeight
                ? this.displayHeight
                : displayedItemHeightBelow > 2 * this.displayHeight
                    ? this.displayHeight - displayedItemHeightBelow
                    : 0;
        const heightToAddAbove = this.scrollTop === 0 
            ? 2 * this.displayHeight
            : this.scrollTop < this.displayHeight
                ? this.displayHeight
                : this.scrollTop > 2 * this.displayHeight
                    ? this.displayHeight - this.scrollTop
                    : 0;
        if(heightToAddAbove < 0){
            const nrOfItemsToRemoveAbove = Math.floor(-heightToAddAbove / this.itemHeight);
            this.removeItemsAbove(nrOfItemsToRemoveAbove);
        }
        if(heightToAddBelow < 0){
            const nrOfItemsToRemoveBelow = Math.ceil(-heightToAddBelow / this.itemHeight);
            this.removeItemsBelow(nrOfItemsToRemoveBelow);
        }
        if(heightToAddBelow > 0){
            const nrOfItemsToAddBelow = Math.ceil(heightToAddBelow / this.itemHeight);
            await this.displayItemsBelow(nrOfItemsToAddBelow, abortSignal);
        }
        if(heightToAddAbove > 0){
            const nrOfItemsToAddAbove = Math.floor(heightToAddAbove / this.itemHeight);
            await this.displayItemsAbove(nrOfItemsToAddAbove, abortSignal);
        }
        if(heightToAddAbove !== 0){
            if(this.data.total){
                this.firstItemRelativePosition = await this.data.total.getRelativePositionOfItem(this.displayedItems[0].item);
            }
            
            this.setScrolledRatio()
        }
        if(this.displayHeightRatio === Infinity){
            this.displayHeightRatio = await this.calculateDisplayHeightRatio();
            this.eventTarget.dispatchEvent(new CustomEvent('displayheightratiochanged', {detail: {displayHeightRatio: this.displayHeightRatio}}))
            this.setScrolledRatio()
        }
    }
    private async displayItemsBelow(nrItems: number, abortSignal?: AbortSignal): Promise<void> {
        let nrOfItemsAdded = 0;
        const nrOfInitialItemsToDisplay = Math.min(this.initialItems.items.length - this.lastInitialDisplayedIndex - 1, nrItems);
        if(nrOfInitialItemsToDisplay > 0){
            const firstInitialIndexToDisplay = this.lastInitialDisplayedIndex + 1;
            const initialItemsToDisplay = this.initialItems.items.slice(firstInitialIndexToDisplay, firstInitialIndexToDisplay + nrOfInitialItemsToDisplay);
            this.appendItems(
                initialItemsToDisplay,
                firstInitialIndexToDisplay > 0 || this.initialItems.hasPrevious,
                firstInitialIndexToDisplay + nrOfInitialItemsToDisplay < this.initialItems.items.length || this.initialItems.hasNext
            )
            this.lastInitialDisplayedIndex += nrOfInitialItemsToDisplay;
            nrOfItemsAdded += nrOfInitialItemsToDisplay;
        }
        if(nrOfItemsAdded >= nrItems){
            return;
        }
        const lastDisplayedItem = this.displayedItems[this.displayedItems.length - 1];
        if(!lastDisplayedItem || !lastDisplayedItem.hasNext){
            return;
        }

        const nextItems = await this.data.getItemsAfterItem(lastDisplayedItem.item, nrItems - nrOfItemsAdded, abortSignal);
        if(nextItems.items.length === 0 || abortSignal?.aborted){
            return;
        }
        this.appendItems(nextItems.items, true, nextItems.hasNext);
    }
    private async displayItemsAbove(nrItems: number, abortSignal?: AbortSignal): Promise<void> {
        const firstDisplayedItem = this.displayedItems[0];
        if(!firstDisplayedItem || !firstDisplayedItem.hasPrevious){
            return;
        }

        const previousItems = await this.data.getItemsBeforeItem(firstDisplayedItem.item, nrItems, abortSignal);
        if(previousItems.items.length === 0 || abortSignal?.aborted){
            return;
        }
        await this.prependItems(firstDisplayedItem.displayed, previousItems.items, previousItems.hasPrevious, true);
    }

    private removeItemsAbove(nrItems: number): void {
        const itemsToRemove = this.displayedItems.splice(0, nrItems);
        for(const { displayed } of itemsToRemove){
            this.contentDisplay.removeDisplayedItem(displayed)
        }
    }
    private removeItemsBelow(nrItems: number): void {
        const itemsToRemove = this.displayedItems.splice(this.displayedItems.length - nrItems, nrItems);
        for(const { displayed } of itemsToRemove){
            this.contentDisplay.removeDisplayedItem(displayed)
        }
    }
    private appendItems(
        items: TItem[],
        hasPrevious: boolean,
        hasNext: boolean
    ): void {
        const displayedItems = this.contentDisplay.appendItems(items);
        for(let i = 0; i < displayedItems.length; i++){
            const { item, displayed } = displayedItems[i];
            this.displayedItems.push({
                item,
                displayed,
                hasPrevious: i > 0 || hasPrevious,
                hasNext: i < displayedItems.length - 1 || hasNext
            })
        }
    }
    private async prependItems(
        firstDisplayedItem: TDisplayedItem,
        items: TItem[],
        hasPrevious: boolean,
        hasNext: boolean
    ): Promise<void> {
        const displayedItems = await this.contentDisplay.prependItems(firstDisplayedItem, items, items.length * this.itemHeight);
        for(let i = displayedItems.length - 1; i >= 0; i--){
            const { item, displayed } = displayedItems[i];
            this.displayedItems.unshift({
                item,
                displayed,
                hasPrevious: i > 0 || hasPrevious,
                hasNext: i < displayedItems.length - 1 || hasNext
            })
        }
    }
    private async determineItemHeight(abortSignal?: AbortSignal): Promise<number | undefined> {
        let firstItem = this.displayedItems[0];
        if(!firstItem){
            this.appendItems(this.initialItems.items.slice(0, 1), this.initialItems.hasPrevious, this.initialItems.items.length > 1 || this.initialItems.hasNext)
            this.lastInitialDisplayedIndex = 0;
            firstItem = this.displayedItems[0];
        }
        return await this.contentDisplay.getDisplayedHeight(firstItem.displayed, abortSignal);
    }
    private setScrolledRatio(): void {
        const firstItemRelativePosition = this.firstItemRelativePosition;
        if(firstItemRelativePosition === undefined || this.displayHeightRatio === Infinity){
            return;
        }
        const newScrolledRatio = firstItemRelativePosition + this.displayHeightRatio * this.scrollTop / this.displayHeight;
        const event: ScrolledRatioChangedEvent = new CustomEvent('scrolledratiochanged', { detail: { scrolledRatio: newScrolledRatio }});
        this.eventTarget.dispatchEvent(event);
    }
    private async calculateDisplayHeightRatio(abortSignal?: AbortSignal): Promise<number> {
        const nrOfItems = this.displayedItems.length;
        if(nrOfItems === 0){
            return Infinity;
        }
        const firstItemRelativePosition = this.firstItemRelativePosition;
        if(firstItemRelativePosition === undefined){
            return Infinity;
        }
        const total = this.data.total;
        if(!total){
            return Infinity;
        }
        const itemsHeight = this.itemHeight * nrOfItems;
        if(nrOfItems === 1){
            const firstItem = this.displayedItems[0];
            if(firstItem.hasNext){
                const { items: [secondItem] } = await this.data.getItemsAfterItem(firstItem.item, 1, abortSignal);
                const posSecond = await total.getRelativePositionOfItem(secondItem, abortSignal);
                const itemsRatio = posSecond - firstItemRelativePosition;
                return itemsRatio * this.displayHeight / itemsHeight;
            }
            if(firstItem.hasPrevious){
                const { items: [itemBeforeFirst] } = await this.data.getItemsBeforeItem(firstItem.item, 1, abortSignal);
                const posBeforeFirst = await total.getRelativePositionOfItem(itemBeforeFirst, abortSignal);
                const itemsRatio = firstItemRelativePosition - posBeforeFirst;
                return itemsRatio * this.displayHeight / itemsHeight;
            }
            return this.displayHeight / itemsHeight;
        }
        const posLast = await total.getRelativePositionOfItem(this.displayedItems[nrOfItems - 1].item, abortSignal);
        const itemsRatio = (posLast - firstItemRelativePosition) * nrOfItems / (nrOfItems - 1);
        return itemsRatio * this.displayHeight / itemsHeight;
    }

    static create<TItem = unknown, TDisplayedItem = unknown>(
        data: VeryLongListData<TItem>,
        contentDisplay: ContentDisplay<TItem, TDisplayedItem>,
        displayHeight: number | undefined,
        abortSignal: AbortSignal
    ): DisplayedData<TItem, TDisplayedItem> {
        const result = new DisplayedData(data, contentDisplay);
        if(displayHeight !== undefined){
            result.setHeight(displayHeight, abortSignal);
        }
        return result;
    }
}