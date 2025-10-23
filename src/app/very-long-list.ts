import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";
import './very-long-list-scrollbar'
import type { VeryLongListScrollbar } from "./very-long-list-scrollbar";

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
    constructor(
        public readonly containerElement: HTMLElement,
        public readonly observer: IntersectionObserver,
        public readonly contentElement: HTMLElement,
        public readonly scrollbar: VeryLongListScrollbar
    ){

    }

    static create(
        shadow: ShadowRoot,
        observerCallback: IntersectionObserverCallback
    ): ConnectedVeryLongList {
        const containerElement = shadow.getElementById('content-container')!;
        const observer = new IntersectionObserver(observerCallback, { root: containerElement });
        const scrollbar = shadow.querySelector('very-long-list-scrollbar')!;
        const contentElement = shadow.getElementById('content')!;
        return new ConnectedVeryLongList(
            containerElement,
            observer,
            contentElement,
            scrollbar
        )
    }
}

export class VeryLongList extends HTMLElement {
    private connectedList: ConnectedVeryLongList | undefined;
    private displayedData: DisplayedVeryLongListData | undefined;
    private items: ItemDataWithElement[] = [];
    private loading = false;
    private queuedAddItemsAbove = queued(() => this.addItemsAbove());

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {
        if(!this.displayedData){
            return;
        }
        for(const {isIntersecting, target} of entries){
            const itemIndex = this.items.findIndex(r => r.element === target);
            if(itemIndex === -1 || !isIntersecting){
                continue;
            }
            if(itemIndex >= this.items.length - this.displayedData.numberOfItemsInHeight){
                this.addItemsBelow();
                return;
            }
            if(itemIndex <= this.displayedData.numberOfItemsInHeight){
                this.queuedAddItemsAbove();
                return;
            }
        }
    }

    private spliceItems(startIndex: number, deleteCount: number): void {
        if(!this.connectedList){
            return;
        }
        const itemsToRemove = this.items.splice(startIndex, deleteCount);
        for(const itemToRemove of itemsToRemove){
            itemToRemove.element.remove();
            this.connectedList.observer.unobserve(itemToRemove.element);
        }
    }

    private async addItemsAbove(): Promise<void> {
        if(this.loading || !this.displayedData || !this.connectedList
        ){
            return;
        }
        
        const firstItem = this.items[0];
        if(!firstItem || !firstItem.data.hasPrevious){
            return;
        }
        this.loading = true;
        const listItems = await this.displayedData.data.getItemsBeforeItem(firstItem.data.item, this.displayedData.numberOfItemsInHeight);
        const scrollTop = this.connectedList.containerElement.scrollTop;
        const items = listItems.items;
        if(items.length === 0){
            return;
        }
        const newItems = [...createItemsWithElements(this.displayedData.data, listItems)];
        this.prependItems(newItems, firstItem.element);
        this.spliceItems(this.items.length - items.length, items.length);
        const desiredScrollTop = scrollTop + newItems.length * this.displayedData.itemHeight;
        await scrollElement(this.connectedList.containerElement, desiredScrollTop);
        for(let index = newItems.length - 1; index >= 0; index--){
            const itemElement = newItems[index].element;
            if(index === 0){
                this.connectedList.observer.observe(itemElement);
            }
        }
        await this.displayedData.setPosition(this.items);
        this.loading = false;
    }

    private async addItemsBelow(): Promise<void> {
        if(this.loading
            || !this.displayedData
            || !this.connectedList
        ){
            return;
        }
        const lastItem = this.items[this.items.length - 1];
        if(!lastItem || !lastItem.data.hasNext){
            return;
        }
        this.loading = true;
        const listItems = await this.displayedData.data.getItemsAfterItem(lastItem.data.item, this.displayedData.numberOfItemsInHeight);
        const items = listItems.items;
        if(items.length === 0){
            return;
        }
        const newItems = [...createItemsWithElements(this.displayedData.data, listItems)]
        for(let index = 0; index < newItems.length; index++){
            const newItem = newItems[index];
            const itemElement = newItem.element;
            this.connectedList.contentElement.appendChild(itemElement);
            this.items.push(newItem);
            if(index === 0){
                this.connectedList.observer.observe(itemElement);
            }
        }
        const tooMany = this.items.length - 5 * this.displayedData.numberOfItemsInHeight;
        if(tooMany > 0){
            this.spliceItems(0, tooMany)
        }
        await this.displayedData.setPosition(this.items);
        this.loading = false;
    }

    private setScrolledRatio(): void {
        if(!this.displayedData || !this.connectedList){
            return;
        }
        this.connectedList.scrollbar.scrolledRatio = this.displayedData.getScrolledRatio(this.connectedList.containerElement.scrollTop);
    }

    private handleScrollRequest(ratio: number): void {
        if(!this.displayedData || !this.connectedList){
            return;
        }
        if(ratio < this.displayedData.firstItemRelativePosition){
            console.log('need to add items above');
            return;
        }
        const partOfHeightScrolled = this.connectedList.containerElement.scrollTop / this.displayedData.height;
        const positionOfScreenTop = this.displayedData.firstItemRelativePosition + partOfHeightScrolled * this.displayedData.scrollbarThumbRatio;
        if(ratio < positionOfScreenTop) {
            console.log('need to scroll up');
            return;
        }

    }

    protected connectedCallback(){
        const templateEl = document.getElementById('very-long-list-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        
        const connectedList = ConnectedVeryLongList.create(
            shadow,
            (entries) => this.handleObservedIntersections(entries)
        );
        connectedList.containerElement.addEventListener('scroll', () => this.setScrolledRatio());
        connectedList.scrollbar.addEventListener('scrollrequested', ({detail: { ratio }}) => {
            console.log(`got request to scroll to ratio ${ratio}`);
        });
        this.connectedList = connectedList;
    }

    private prependItems(items: ItemDataWithElement[], firstItemElement: Element): void {
        if(!this.connectedList){
            return;
        }
        let elementToInsertBefore = firstItemElement;
        for(let index = items.length - 1; index >= 0; index--){
            const newItem = items[index];
            const itemElement = newItem.element;
            this.connectedList.contentElement.insertBefore(itemElement, elementToInsertBefore);
            elementToInsertBefore = itemElement;
            this.items.unshift(newItem);
        }
    }

    public async setData<TItem>(data: VeryLongListData<TItem> | undefined): Promise<void>{
        this.spliceItems(0, this.items.length);
        if(!data){
            if(this.connectedList){
                this.connectedList.scrollbar.visible = false;
            }
            return;
        }
        const { hasPrevious, hasNext, items } = data.items;
        if(items.length === 0 || !this.connectedList){
            return;
        }
        const {height} = await waitForAnimationFrameWhen(() => this.getBoundingClientRect(), ({height}) => height > 0, 20);
        if(height === 0){
            return;
        }
        this.items.push(...createItemsWithElements(data, data.items));
        for(const item of this.items){
            this.connectedList.contentElement.appendChild(item.element);
        }
        const firstItemElement = this.items[0].element;
        const {height: itemHeight} = await waitForAnimationFrameWhen(() => firstItemElement.getBoundingClientRect(), ({height}) => height > 0, 20);
        const numberOfItemsInHeight = Math.ceil(height / itemHeight);
        this.displayedData = new DisplayedVeryLongListData(
            data,
            itemHeight,
            height,
            numberOfItemsInHeight,
            0,
            0
        )
        let nrOfItemsBefore = 0;
        if(hasPrevious){
            const itemsBefore = await data.getItemsBeforeItem(items[0], 2 * numberOfItemsInHeight);
            const itemsWithElementsBefore = [...createItemsWithElements(data, itemsBefore)];
            this.prependItems(itemsWithElementsBefore, firstItemElement);
            nrOfItemsBefore = itemsBefore.items.length;
        }
        const tooFew = 3 * numberOfItemsInHeight - items.length;
        if(tooFew > 0 && hasNext){
            const itemsAfter = await data.getItemsAfterItem(items[items.length - 1], tooFew);
            const itemsWithElementsAfter = [...createItemsWithElements(data, itemsAfter)];
            this.items.push(...itemsWithElementsAfter);
            for(const item of itemsWithElementsAfter){
                this.connectedList.contentElement.appendChild(item.element);
            }
        }
        const scrollbarVisible = this.items.length >= numberOfItemsInHeight;
        this.connectedList.scrollbar.visible = scrollbarVisible;
        await this.displayedData.setPosition(this.items);
        this.connectedList.scrollbar.thumbRatio = this.displayedData.scrollbarThumbRatio;
        this.connectedList.scrollbar.scrolledRatio = 0;
        nrOfItemsBefore = Math.min(Math.max(0, this.items.length - numberOfItemsInHeight), nrOfItemsBefore);
        const scrollTop = itemHeight * nrOfItemsBefore;
        await scrollElement(this.connectedList.containerElement, scrollTop);
        for(let index = 0; index < this.items.length; index += numberOfItemsInHeight){
            const item = this.items[index];
            this.connectedList.observer.observe(item.element);
        }
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
