import { debounceWithAbort } from "./debounce-with-abort";
import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";
import './very-long-list-scrollbar'
import type { ScrollRequestedEvent, VeryLongListScrollbar } from "./very-long-list-scrollbar";

class ElementScroller {
    private readonly scrollListener: () => void
    private onDidScroll: (() => void) | undefined;
    constructor(private readonly element: Element){
        this.scrollListener = () => this.handleScroll();
        element.addEventListener('scroll', this.scrollListener);
    }
    destroy(): void {
        this.element.removeEventListener('scroll', this.scrollListener);
    }
    async scrollTo(scrollTop: number): Promise<void> {
        let nrOfAttempts = 0;
        while(nrOfAttempts < 5){
            const actual = this.element.scrollTop;
            if(Math.abs(actual - scrollTop) < 3){
                return;
            }
            const scrollPromise = this.whenScrolled();
            this.element.scrollTop = scrollTop;
            await Promise.race([
                scrollPromise,
                waitMs(10)
            ])
            nrOfAttempts++;
        }
        throw new Error('Could not scroll the element')
    }
    private whenScrolled(): Promise<void> {
        return new Promise((res) => {
            this.onDidScroll = res;
        })
    }
    private handleScroll(): void {
        if(this.onDidScroll){
            this.onDidScroll();
            this.onDidScroll = undefined;
        }
    }
}

function waitForAnimationFrameWhen<T>(
    calculate: () => T,
    predicate: (v: T) => boolean,
    maxRetries: number,
    abortSignal?: AbortSignal
): Promise<T> {
    return new Promise<T>((res) => {
        let triesLeft = maxRetries;
        let requestedAnimationFrame: number | undefined;
        abortSignal?.addEventListener('abort', () => {
            if(requestedAnimationFrame !== undefined){
                cancelAnimationFrame(requestedAnimationFrame);
            }
        })
        check();
        function check(): void {
            const value = calculate();
            if(predicate(value)){
                res(value);
                return;
            }
            triesLeft--;
            if(triesLeft === 0 || abortSignal?.aborted){
                res(value);
                return;
            }
            requestedAnimationFrame = requestAnimationFrame(check);
        }
    })
}

function waitMs(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
}

function throttle(fn: (abortSignal?: AbortSignal) => Promise<void>, interval: number): (abortSignal?: AbortSignal) => void {
    let busy = false;
    let scheduled = false;
    let latestAbortSignal: AbortSignal | undefined
    return (abortSignal?: AbortSignal) => {
        latestAbortSignal = abortSignal;
        execute();
    };
    async function execute(): Promise<void> {
        if(busy){
            scheduled = true;
            return;
        }
        if(latestAbortSignal?.aborted){
            latestAbortSignal = undefined;
            return;
        }
        scheduled = false;
        busy = true;
        await Promise.all([
            fn(latestAbortSignal),
            waitMs(interval)
        ])
        busy = false;
        if(scheduled){
            execute();
        }
    }
}

class VeryLongListItem extends HTMLElement {
    
    connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-item-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
    }
}


interface DisplayedItem<TItem, TDisplayedItem> {
    item: TItem
    displayed: TDisplayedItem
}

interface DisplayedItemData<TItem, TDisplayedItem> extends DisplayedItem<TItem, TDisplayedItem> {
    hasNext: boolean
    hasPrevious: boolean
}

interface VeryLongListContentDisplay<TItem, TDisplayedItem> {
    appendItems(items: TItem[]): DisplayedItem<TItem, TDisplayedItem>[]
    prependItems(referenceItem: TDisplayedItem, items: TItem[], totalHeight: number): Promise<DisplayedItem<TItem, TDisplayedItem>[]>
    getDisplayedHeight(displayedItem: TDisplayedItem, abortSignal?: AbortSignal): Promise<number | undefined>
    removeDisplayedItem(displayedItem: TDisplayedItem): void
}

interface DisplayHeightRatioChangedEvent extends CustomEvent {
    detail: {
        displayHeightRatio: number
    }
}

interface ScrolledRatioChangedEvent extends CustomEvent {
    detail: {
        scrolledRatio: number
    }
}

interface DisplayedVeryLongListDataEventMap {
    'displayheightratiochanged': DisplayHeightRatioChangedEvent
    'scrolledratiochanged': ScrolledRatioChangedEvent
}

class DisplayedVeryLongListData<TItem = unknown, TDisplayedItem = unknown> {
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
    private constructor(
        private readonly data: VeryLongListData<TItem>,
        private readonly contentDisplay: VeryLongListContentDisplay<TItem, TDisplayedItem>
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
        this.throttledDisplay(abortSignal);
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
            this.firstItemRelativePosition = await this.data.getRelativePositionOfItem(this.displayedItems[0].item);
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
        if(firstItemRelativePosition === undefined){
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
        const itemsHeight = this.itemHeight * nrOfItems;
        if(nrOfItems === 1){
            const firstItem = this.displayedItems[0];
            if(firstItem.hasNext){
                const { items: [secondItem] } = await this.data.getItemsAfterItem(firstItem.item, 1, abortSignal);
                const posSecond = await this.data.getRelativePositionOfItem(secondItem, abortSignal);
                const itemsRatio = posSecond - firstItemRelativePosition;
                return itemsRatio * this.displayHeight / itemsHeight;
            }
            if(firstItem.hasPrevious){
                const { items: [itemBeforeFirst] } = await this.data.getItemsBeforeItem(firstItem.item, 1, abortSignal);
                const posBeforeFirst = await this.data.getRelativePositionOfItem(itemBeforeFirst, abortSignal);
                const itemsRatio = firstItemRelativePosition - posBeforeFirst;
                return itemsRatio * this.displayHeight / itemsHeight;
            }
            return this.displayHeight / itemsHeight;
        }
        const posLast = await this.data.getRelativePositionOfItem(this.displayedItems[nrOfItems - 1].item, abortSignal);
        const itemsRatio = (posLast - firstItemRelativePosition) * nrOfItems / (nrOfItems - 1);
        return itemsRatio * this.displayHeight / itemsHeight;
    }

    static async create<TItem = unknown, TDisplayedItem = unknown>(
        data: VeryLongListData<TItem>,
        contentDisplay: VeryLongListContentDisplay<TItem, TDisplayedItem>,
        displayHeight: number | undefined,
        abortSignal: AbortSignal
    ): Promise<DisplayedVeryLongListData<TItem, TDisplayedItem>> {
        const result = new DisplayedVeryLongListData(data, contentDisplay);
        if(displayHeight !== undefined){
            await result.setHeight(displayHeight, abortSignal);
        }
        return result;
    }
}

class ContentDisplay<TItem> implements VeryLongListContentDisplay<TItem, VeryLongListItem> {
    constructor(
        private readonly containerElement: HTMLElement,
        private readonly containerElementScroller: ElementScroller,
        private readonly contentElement: HTMLElement,
        private readonly data: VeryLongListData<TItem>
    ){}

    appendItems(items: TItem[]): DisplayedItem<TItem, VeryLongListItem>[] {
        const result: DisplayedItem<TItem, VeryLongListItem>[] = [];
        for(const item of items){
            const displayed = this.createItemElement(item);
            this.contentElement.appendChild(displayed);
            result.push({ item, displayed })
        }
        return result;
    }

    async prependItems(referenceItem: VeryLongListItem, items: TItem[], totalHeight: number): Promise<DisplayedItem<TItem, VeryLongListItem>[]> {
        const result: DisplayedItem<TItem, VeryLongListItem>[] = [];
        const newScrollTop = this.containerElement.scrollTop + totalHeight;
        let elementToInsertBefore = referenceItem;
        for(let index = items.length - 1; index >= 0; index--){
            const item = items[index];
            const displayed = this.createItemElement(item);
            this.contentElement.insertBefore(displayed, elementToInsertBefore);
            result.unshift({ item, displayed })
            elementToInsertBefore = displayed;
        }
        await this.containerElementScroller.scrollTo(newScrollTop);
        return result;
    }

    removeDisplayedItem(item: VeryLongListItem): void {
        item.remove();
    }

    async getDisplayedHeight(displayedItem: VeryLongListItem, abortSignal?: AbortSignal): Promise<number | undefined> {
        const rect = await waitForAnimationFrameWhen(() => displayedItem.getBoundingClientRect(), ({height}) => height > 0, 20, abortSignal);
        if(rect.height === 0){
            return undefined;
        }
        return rect.height;
    }

    private createItemElement(item: TItem): VeryLongListItem {
        const itemElement = document.createElement('very-long-list-item');
        itemElement.appendChild(this.data.renderItem(item));
        return itemElement;
    }
}

class ConnectedVeryLongList {
    private height: number | undefined;
    private displayedData: DisplayedVeryLongListData<unknown, VeryLongListItem> | undefined
    private readonly scrollListener: () => void
    private readonly displayHeightRatioChangedListener: (ev: DisplayHeightRatioChangedEvent) => void
    private readonly scrolledRatioChangedListener: (ev: ScrolledRatioChangedEvent) => void
    private readonly resizeObserver: ResizeObserver;
    private readonly scrollRequestedListener: (ev: ScrollRequestedEvent) => void
    private readonly containerElementScroller: ElementScroller;
    private debouncedSetDataHeight = debounceWithAbort((abortSignal) => this.setDisplayedDataHeight(abortSignal), 300)
    constructor(
        public readonly containerElement: HTMLElement,
        public readonly contentElement: HTMLElement,
        public readonly scrollbar: VeryLongListScrollbar
    ){
        this.containerElementScroller = new ElementScroller(containerElement);
        this.displayHeightRatioChangedListener = (ev) => this.handleDisplayHeightRatioChanged(ev);
        this.scrolledRatioChangedListener = (ev) => this.handleScrolledRatioChanged(ev)
        const scrollListener = () => this.handleScroll();
        containerElement.addEventListener('scroll', scrollListener);
        this.scrollListener = scrollListener;
        const scrollRequestedListener = (e: ScrollRequestedEvent) => this.handleScrollRequested(e);
        scrollbar.addEventListener('scrollrequested', scrollRequestedListener);
        this.scrollRequestedListener = scrollRequestedListener;
        const resizeObserver = new ResizeObserver((entries) => this.handleResize(entries));
        resizeObserver.observe(containerElement);
        this.resizeObserver = resizeObserver;
    }

    async displayData(data: VeryLongListData | undefined, abortSignal: AbortSignal): Promise<void> {
        if(this.displayedData){
            this.displayedData.destroy();
            this.displayedData = undefined;
        }
        if(!data){
            this.scrollbar.visible = false;
            return;
        }
        this.displayedData = await DisplayedVeryLongListData.create<unknown, VeryLongListItem>(
            data,
            new ContentDisplay(
                this.containerElement,
                this.containerElementScroller,
                this.contentElement,
                data
            ),
            this.height,
            abortSignal
        );
        this.displayedData.addEventListener('displayheightratiochanged', this.displayHeightRatioChangedListener);
        this.displayedData.addEventListener('scrolledratiochanged', this.scrolledRatioChangedListener)
    }

    destroy(): void {
        this.containerElementScroller.destroy();
        this.containerElement.removeEventListener('scroll', this.scrollListener);
        this.scrollbar.removeEventListener('scrollrequested', this.scrollRequestedListener);
        this.resizeObserver.disconnect();
        if(this.displayedData){
            this.displayedData.removeEventListener('displayheightratiochanged', this.displayHeightRatioChangedListener);
            this.displayedData.removeEventListener('scrolledratiochanged', this.scrolledRatioChangedListener)
            this.displayedData.destroy();
        }
    }

    private handleScroll(): void {
        if(this.displayedData){
            const scrollTop = this.containerElement.scrollTop;
            this.displayedData.setScrollTop(scrollTop);
        }
    }

    private handleScrollRequested({ detail: { ratio }}: ScrollRequestedEvent): void {
        if(!this.displayedData){
            return;
        }
        const scrollTop = this.displayedData.getScrollTopAtRelativePosition(ratio);
        if(scrollTop === undefined){
            console.log('cannot scroll there');
            return;
        }
        this.containerElementScroller.scrollTo(scrollTop)
    }

    private handleDisplayHeightRatioChanged({ detail: { displayHeightRatio }}: DisplayHeightRatioChangedEvent): void {
        if(displayHeightRatio >= 1){
            this.scrollbar.visible = false;
            return;
        }
        this.scrollbar.visible = true;
        this.scrollbar.thumbRatio = displayHeightRatio;
    }

    private handleScrolledRatioChanged({detail: { scrolledRatio }}: ScrolledRatioChangedEvent): void {
        this.scrollbar.scrolledRatio = scrolledRatio;
    }

    private setDisplayedDataHeight(abortSignal: AbortSignal): void {
        if(this.displayedData && this.height !== undefined){
            this.displayedData.setHeight(this.height, abortSignal);
        }
    }

    private handleResize([{contentRect: {height}}]: ResizeObserverEntry[]): void {
        this.height = height;
        this.debouncedSetDataHeight();
    }

    static create(
        shadow: ShadowRoot
    ): ConnectedVeryLongList {
        const containerElement = shadow.getElementById('content-container')!;
        const scrollbar = shadow.querySelector('very-long-list-scrollbar')!;
        const contentElement = shadow.getElementById('content')!;
        return new ConnectedVeryLongList(
            containerElement,
            contentElement,
            scrollbar
        )
    }
}

export class VeryLongList extends HTMLElement {
    private connectedList: ConnectedVeryLongList | undefined;

    protected connectedCallback(){
        const templateEl = document.getElementById('very-long-list-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        
        const connectedList = ConnectedVeryLongList.create(shadow);
        
        this.connectedList = connectedList;
    }

    protected disconnectedCallback(){
        if(this.connectedList){
            this.connectedList.destroy();
        }
    }

    public async setData(data: VeryLongListData | undefined, abortSignal: AbortSignal): Promise<void>{
        if(!this.connectedList){
            return;
        }
        await this.connectedList.displayData(data, abortSignal);
    }
}

customElements.define('very-long-list', VeryLongList);
customElements.define('very-long-list-item', VeryLongListItem);

declare global {
    interface HTMLElementTagNameMap {
        'very-long-list': VeryLongList
        'very-long-list-item': VeryLongListItem
    }
}
