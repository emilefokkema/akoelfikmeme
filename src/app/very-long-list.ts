import { throttledWithAbort } from "./throttled-with-abort";
import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";
import './very-long-list-scrollbar'
import type { ScrollRequestedEvent, VeryLongListScrollbar } from "./very-long-list-scrollbar";

function whenElementScrolled(element: Element, signal: AbortSignal): Promise<void> {
    return new Promise<void>((res, rej) => {
        const listener = () => {
            element.removeEventListener('scroll', listener);
            res();
        }
        element.addEventListener('scroll', listener);
        signal.addEventListener('abort', rej);
    })
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

async function scrollElement(element: Element, scrollTop: number): Promise<void> {
    while(true){
        if(Math.abs(element.scrollTop - scrollTop) < 3){
            break;
        }
        const controller = new AbortController();
        element.scrollTop = scrollTop;
        await Promise.race([
            whenElementScrolled(element, controller.signal),
            waitMs(10)
        ]);
        controller.abort();

    }
}

function debounce(fn: () => Promise<void>, interval: number): () => void {
    let busy = false;
    let scheduled = false;
    return execute;
    async function execute(): Promise<void> {
        if(busy){
            scheduled = true;
            return;
        }
        scheduled = false;
        busy = true;
        await Promise.all([
            fn(),
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


interface ItemData<TItem> {
    item: TItem
    hasNext: boolean
    hasPrevious: boolean
}


interface ItemDataWithElement<TItem = unknown> {
    data: ItemData<TItem>
    element: Element
}

interface DisplayedItemData<TItem, TDisplayedItem> {
    displayedItem: DisplayedItem<TItem, TDisplayedItem>,
    hasNext: boolean
    hasPrevious: boolean
}

interface DisplayedItem<TItem, TDisplayedItem> {
    item: TItem
    displayed: TDisplayedItem
}

interface VeryLongListContentDisplay<TItem, TDisplayedItem> {
    appendItems(items: TItem[]): DisplayedItem<TItem, TDisplayedItem>[]
    getDisplayedHeight(displayedItem: TDisplayedItem, abortSignal?: AbortSignal): Promise<number | undefined>
    removeDisplayedItem(displayedItem: TDisplayedItem): void
}

class DisplayedVeryLongListData<TItem = unknown, TDisplayedItem = unknown> {
    private displayHeight = 0;
    private scrollTop = 0;
    private itemHeight = 0;
    private displayedItems: DisplayedItemData<TItem, TDisplayedItem>[] = [];
    private lastInitialDisplayedIndex = -1;
    private initialItemsLength: number
    private debouncedDisplay = debounce(() => this.display(), 200);
    private constructor(
        private readonly data: VeryLongListData<TItem>,
        private readonly contentElement: HTMLElement,
        private readonly contentDisplay: VeryLongListContentDisplay<TItem, TDisplayedItem>
    ){
        this.initialItemsLength = data.items.items.length;
    }
    destroy(): void {
        for(const displayedItem of this.displayedItems){
            this.contentDisplay.removeDisplayedItem(displayedItem.displayedItem.displayed);
        }
        this.displayedItems.splice(0, this.displayedItems.length);
    }
    setHeight(height: number, abortSignal?: AbortSignal): void {
        this.displayHeight = height;
        this.display(abortSignal);
    }
    setScrollTop(scrollTop: number): void {
        this.scrollTop = scrollTop;
        this.debouncedDisplay();
    }
    private async display(abortSignal?: AbortSignal): Promise<void> {
        if(this.displayHeight <= 0 || this.initialItemsLength === 0){
            return;
        }
        if(this.itemHeight === 0){
            const didDetermineItemHeight = await this.determineItemHeight(abortSignal);
            if(!didDetermineItemHeight){
                return;
            }
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
            const nrOfItemsToRemoveAbove = Math.ceil(-heightToAddAbove / this.itemHeight);
            console.log(`would like to remove ${nrOfItemsToRemoveAbove} items above`)
        }
        if(heightToAddBelow > 0){
            //console.log(`want to add a height of ${heightToAddBelow} below. item height is ${this.itemHeight}. display height is ${this.displayHeight}`)
            const nrOfItemsToAddBelow = Math.ceil(heightToAddBelow / this.itemHeight);
            await this.addItemsBelow(nrOfItemsToAddBelow, abortSignal);
        }else if(heightToAddBelow < 0){
            
        }
        
        //console.log(`finish display. display scheduled:`, this.displayScheduled)
    }
    private async addItemsBelow(nrItems: number, abortSignal?: AbortSignal): Promise<void> {
        let nrOfItemsAdded = 0;
        while(this.lastInitialDisplayedIndex < this.initialItemsLength - 1 && nrOfItemsAdded < nrItems){
            const initialIndexToDisplay = this.lastInitialDisplayedIndex + 1;
            const item = this.data.items.items[initialIndexToDisplay];
            const element = this.createItemElement(item);
            this.contentElement.appendChild(element);
            this.displayedItems.push({
                data: {
                    item,
                    hasPrevious: initialIndexToDisplay > 0 || this.data.items.hasPrevious,
                    hasNext: initialIndexToDisplay + 1 < this.initialItemsLength || this.data.items.hasNext
                },
                element
            })
            this.lastInitialDisplayedIndex = initialIndexToDisplay;
            nrOfItemsAdded++;
        }
        if(nrOfItemsAdded >= nrItems){
            return;
        }
        const lastDisplayedItem = this.displayedItems[this.displayedItems.length - 1];
        if(!lastDisplayedItem || !lastDisplayedItem.data.hasNext){
            return;
        }
        const nextItems = await this.data.getItemsAfterItem(lastDisplayedItem.data.item, nrItems - nrOfItemsAdded, abortSignal);
        if(nextItems.items.length === 0 || abortSignal?.aborted){
            return;
        }
        let indexToDisplay = 0;
        while(nrOfItemsAdded < nrItems && indexToDisplay < nextItems.items.length){
            const item = nextItems.items[indexToDisplay];
            const element = this.createItemElement(item);
            this.contentElement.appendChild(element);
            this.displayedItems.push({
                data: {
                    item,
                    hasPrevious: true,
                    hasNext: indexToDisplay + 1 < nextItems.items.length || nextItems.hasNext
                },
                element
            });
            indexToDisplay++;
            nrOfItemsAdded++;
        }
        console.log(`did add ${nrOfItemsAdded} items`)
    }
    private async determineItemHeight(abortSignal?: AbortSignal): Promise<boolean> {
        let firstItem = this.displayedItems[0];
        if(!firstItem){
            this.displayFirstItem();
            firstItem = this.displayedItems[0];
        }
        const rect = await waitForAnimationFrameWhen(() => firstItem.element.getBoundingClientRect(), ({height}) => height > 0, 20, abortSignal);
        if(rect.height === 0){
            return false;
        }
        this.itemHeight = rect.height;
        return true;
    }
    private displayFirstItem(): void {
        const first = this.data.items.items[0];
        const element = this.createItemElement(first);
        this.contentElement.appendChild(element);
        this.displayedItems.push({
            data: {
                item: first,
                hasNext: this.initialItemsLength > 1 || this.data.items.hasNext,
                hasPrevious: this.data.items.hasPrevious
            },
            element
        });
        this.lastInitialDisplayedIndex = 0;
    }

    static async create<TItem = unknown, TDisplayedItem = unknown>(
        data: VeryLongListData<TItem>,
        contentElement: HTMLElement,
        contentDisplay: VeryLongListContentDisplay<TItem, TDisplayedItem>,
        displayHeight: number | undefined,
        abortSignal: AbortSignal
    ): Promise<DisplayedVeryLongListData<TItem, TDisplayedItem>> {
        const result = new DisplayedVeryLongListData(data, contentElement, contentDisplay);
        if(displayHeight !== undefined){
            await result.setHeight(displayHeight, abortSignal);
        }
        return result;
    }
}

class ContentDisplay<TItem> implements VeryLongListContentDisplay<TItem, VeryLongListItem> {
    constructor(
        private readonly containerElement: HTMLElement,
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
    private readonly intersectionObserver: IntersectionObserver
    private readonly resizeObserver: ResizeObserver;
    private readonly scrollRequestedListener: (ev: ScrollRequestedEvent) => void
    private throttledSetDataHeight = throttledWithAbort((abortSignal) => this.setDisplayedDataHeight(abortSignal), 300)
    constructor(
        public readonly containerElement: HTMLElement,
        public readonly contentElement: HTMLElement,
        public readonly scrollbar: VeryLongListScrollbar
    ){
        const scrollListener = () => this.handleScroll();
        containerElement.addEventListener('scroll', scrollListener);
        this.scrollListener = scrollListener;
        this.intersectionObserver = new IntersectionObserver(
            (entries) => this.handleObservedIntersections(entries),
            { root: containerElement }
        );
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
            this.contentElement,
            new ContentDisplay(this.containerElement, this.contentElement, data),
            this.height,
            abortSignal
        );
    }

    destroy(): void {
        this.containerElement.removeEventListener('scroll', this.scrollListener);
        this.intersectionObserver.disconnect();
        this.scrollbar.removeEventListener('scrollrequested', this.scrollRequestedListener);
        this.resizeObserver.disconnect();
        if(this.displayedData){
            this.displayedData.destroy();
        }
    }

    private handleScroll(): void {
        if(this.displayedData){
            this.displayedData.setScrollTop(this.containerElement.scrollTop);
        }
    }

    private handleScrollRequested({ detail: { ratio }}: ScrollRequestedEvent): void {

    }

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {

    }

    private setDisplayedDataHeight(abortSignal: AbortSignal): void {
        if(this.displayedData && this.height !== undefined){
            this.displayedData.setHeight(this.height, abortSignal);
        }
    }

    private handleResize([{contentRect: {height}}]: ResizeObserverEntry[]): void {
        this.height = height;
        this.throttledSetDataHeight();
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
