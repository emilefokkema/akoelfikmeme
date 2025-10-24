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

class VeryLongListItem extends HTMLElement {
    
    connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-item-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
    }
}

function createItemElement<TItem>(data: VeryLongListData, item: TItem): VeryLongListItem {
    const itemElement = document.createElement('very-long-list-item');
    itemElement.appendChild(data.renderItem(item));
    return itemElement;
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

function queued(fn: () => Promise<void>): () => void {
    let nrQueued = 0;
    let running = false;
    return () => run();
    async function run(): Promise<void> {
        if(running){
            nrQueued++;
            return;
        }
        if(nrQueued > 0){
            nrQueued--;
        }
        running = true;
        await fn();
        running = false;
        if(nrQueued === 0){
            return;
        }
        run();
    }
}

class DisplayedVeryLongListData<TItem = unknown> {
    private displayHeight = 0;
    private scrollTop = 0;
    private itemHeight = 0;
    private displayedItems: ItemDataWithElement<TItem>[] = [];
    private lastInitialDisplayedIndex = -1;
    private initialItemsLength: number
    private constructor(
        private readonly data: VeryLongListData<TItem>,
        private readonly contentElement: HTMLElement,
    ){
        this.initialItemsLength = data.items.items.length;
    }
    destroy(): void {

    }
    setHeight(height: number, abortSignal?: AbortSignal): void {
        this.displayHeight = height;
        this.display(abortSignal);
    }
    private async display(abortSignal?: AbortSignal): Promise<void> {
        if(this.displayHeight <= 0 || this.initialItemsLength === 0){
            return;
        }
        if(this.itemHeight === 0){
            let firstItem = this.displayedItems[0];
            if(!firstItem){
                this.displayFirstItem();
                firstItem = this.displayedItems[0];
            }
            const rect = await waitForAnimationFrameWhen(() => firstItem.element.getBoundingClientRect(), ({height}) => height > 0, 20, abortSignal);
            if(rect.height === 0){
                return;
            }
            this.itemHeight = rect.height;
        }
        const displayedItemHeight = this.itemHeight * this.displayedItems.length;
        const displayBottomHeight = this.scrollTop + this.displayHeight;
        const displayedItemHeightBelow = displayedItemHeight - displayBottomHeight;
        const heightToAddBelow = displayedItemHeightBelow <= 0
            ? 2 * this.displayHeight - displayedItemHeightBelow
            : displayedItemHeightBelow < this.displayHeight
                ? this.displayHeight
                : 0;
        if(heightToAddBelow > 0){
            const nrOfItemsToAddBelow = Math.ceil(heightToAddBelow / this.itemHeight);
            console.log(`want to add ${nrOfItemsToAddBelow} items below`)
        }
    }
    private async addItemsBelow(nrItems: number, abortSignal?: AbortSignal): Promise<void> {
        
    }

    private displayFirstItem(): void {
        const first = this.data.items.items[0];
        const element = this.createItemElement(first);
        this.contentElement.appendChild(element);
        this.displayedItems.push({
            data: {
                item: first,
                hasNext: this.initialItemsLength > 1,
                hasPrevious: this.data.items.hasPrevious
            },
            element
        });
        this.lastInitialDisplayedIndex = 0;
    }
    private createItemElement(item: TItem): VeryLongListItem {
        const itemElement = document.createElement('very-long-list-item');
        itemElement.appendChild(this.data.renderItem(item));
        return itemElement;
    }
    static async create<TItem = unknown>(
        data: VeryLongListData<TItem>,
        contentElement: HTMLElement,
        displayHeight: number | undefined,
        abortSignal: AbortSignal
    ): Promise<DisplayedVeryLongListData<TItem>> {
        const result = new DisplayedVeryLongListData(data, contentElement);
        if(displayHeight !== undefined){
            await result.setHeight(displayHeight, abortSignal);
        }
        return result;
    }
}

class ConnectedVeryLongList {
    private height: number | undefined;
    private displayedData: DisplayedVeryLongListData | undefined
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
        this.displayedData = await DisplayedVeryLongListData.create(
            data,
            this.contentElement,
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
