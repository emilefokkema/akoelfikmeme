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

function waitForAnimationFrameWhen<T>(calculate: () => T, predicate: (v: T) => boolean, maxRetries: number): Promise<T> {
    return new Promise<T>((res, rej) => {
        let triesLeft = maxRetries;
        check();
        function check(): void {
            const value = calculate();
            if(predicate(value)){
                res(value);
                return;
            }
            triesLeft--;
            if(triesLeft === 0){
                rej(new Error(`After ${maxRetries} tries, predicate did not become true`));
                return;
            }
            requestAnimationFrame(check);
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

function createItemElement(data: VeryLongListData, item: unknown): VeryLongListItem {
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

function *createItemsWithElements(
    data: VeryLongListData,
    {items, hasPrevious, hasNext}: VeryLongListItems
): Iterable<ItemDataWithElement>{
    for(let index = 0; index < items.length; index++){
        const item = items[index];
        yield {
            data: {
                item,
                hasPrevious: index > 0 || hasPrevious,
                hasNext: index < items.length - 1 || hasNext
            },
            element: createItemElement(data, item)
        }
    }
}

class DisplayedVeryLongListData<TItem = unknown> {
    constructor(
        public readonly data: VeryLongListData<TItem>,
        public readonly itemHeight: number,
        public readonly height: number,
        public readonly numberOfItemsInHeight: number,
        public scrollbarThumbRatio: number,
        public firstItemRelativePosition: number
    ){

    }

    getScrolledRatio(scrollTop: number): number {
        const partOfHeightScrolled = scrollTop / this.height;
        return this.firstItemRelativePosition + partOfHeightScrolled * this.scrollbarThumbRatio;
    }

    async setPosition(items: ItemDataWithElement<TItem>[]): Promise<void> {
        const itemsLength = items.length;
        if(itemsLength === 0){
            this.scrollbarThumbRatio = 0;
            this.firstItemRelativePosition = 0;
            return;
        }
        const firstItem = items[0].data;
        const posFirst = await this.data.getRelativePositionOfItem(firstItem.item);
        this.firstItemRelativePosition = posFirst;
        if(itemsLength === 1){
            if(firstItem.hasNext){
                const { items: [secondItem] } = await this.data.getItemsAfterItem(firstItem.item, 1);
                const posSecond = await this.data.getRelativePositionOfItem(secondItem);
                const itemsRatio = posSecond - posFirst;
                this.scrollbarThumbRatio = itemsRatio * this.height / this.itemHeight;
                return;
            }
            if(firstItem.hasPrevious){
                const { items: [itemBeforeFirst] } = await this.data.getItemsBeforeItem(firstItem.item, 1);
                const posBeforeFirst = await this.data.getRelativePositionOfItem(itemBeforeFirst);
                const itemsRatio = posFirst - posBeforeFirst;
                this.scrollbarThumbRatio = itemsRatio * this.height / this.itemHeight;
                return;
            }
            this.scrollbarThumbRatio = this.height / this.itemHeight;
            return;
        }
        const posLast = await this.data.getRelativePositionOfItem(items[itemsLength - 1].data.item);
        const itemsRatio = (posLast - posFirst) * itemsLength / (itemsLength - 1);
        this.scrollbarThumbRatio = itemsRatio * this.height / (this.itemHeight * itemsLength);
    }
}

class ConnectedVeryLongList {
    private readonly scrollListener: () => void
    private readonly observer: IntersectionObserver
    private readonly scrollRequestedListener: (ev: ScrollRequestedEvent) => void
    constructor(
        public readonly containerElement: HTMLElement,
        public readonly contentElement: HTMLElement,
        public readonly scrollbar: VeryLongListScrollbar
    ){
        const scrollListener = () => this.handleScroll();
        containerElement.addEventListener('scroll', scrollListener);
        this.scrollListener = scrollListener;
        this.observer = new IntersectionObserver(
            (entries) => this.handleObservedIntersections(entries),
            { root: containerElement }
        );
        const scrollRequestedListener = (e: ScrollRequestedEvent) => this.handleScrollRequested(e);
        scrollbar.addEventListener('scrollrequested', scrollRequestedListener);
        this.scrollRequestedListener = scrollRequestedListener;
    }

    private handleScroll(): void {

    }

    private handleScrollRequested({ detail: { ratio }}: ScrollRequestedEvent): void {

    }

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {

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
        
        const connectedList = ConnectedVeryLongList.create(
            shadow
        );
        
        // connectedList.scrollbar.addEventListener('scrollrequested', ({detail: { ratio }}) => {
        //     console.log(`got request to scroll to ratio ${ratio}`);
        // });
        this.connectedList = connectedList;
    }

    public async setData(data: VeryLongListData | undefined): Promise<void>{

        
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
