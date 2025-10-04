import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";

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

export class VeryLongList extends HTMLElement {
    private itemHeight: number = 20;
    private shadow: ShadowRoot | undefined;
    private numberOfItemsInHeight: number | undefined;
    private observer: IntersectionObserver | undefined;
    private data: VeryLongListData | undefined;
    private items: ItemDataWithElement[] = [];
    private loading = false;
    private queuedAddItemsAbove = queued(() => this.addItemsAbove());

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {
        if(this.numberOfItemsInHeight === undefined){
            return;
        }
        for(const {isIntersecting, target} of entries){
            const itemIndex = this.items.findIndex(r => r.element === target);
            if(itemIndex === -1 || !isIntersecting){
                continue;
            }
            if(itemIndex >= this.items.length - this.numberOfItemsInHeight){
                this.addItemsBelow();
                return;
            }
            if(itemIndex <= this.numberOfItemsInHeight){
                this.queuedAddItemsAbove();
                return;
            }
        }
    }

    private spliceItems(startIndex: number, deleteCount: number): void {
        if(!this.observer){
            return;
        }
        const itemsToRemove = this.items.splice(startIndex, deleteCount);
        for(const itemToRemove of itemsToRemove){
            itemToRemove.element.remove();
            this.observer.unobserve(itemToRemove.element);
        }
    }

    private async addItemsAbove(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer || this.numberOfItemsInHeight === undefined){
            return;
        }
        
        const firstItem = this.items[0];
        if(!firstItem || !firstItem.data.hasPrevious){
            return;
        }
        this.loading = true;
        const containerElement = this.shadow.getElementById('container')!;
        const listItems = await this.data.getItemsBeforeItem(firstItem.data.item, this.numberOfItemsInHeight);
        const scrollTop = containerElement.scrollTop;
        const items = listItems.items;
        if(items.length === 0){
            return;
        }
        const newItems = [...createItemsWithElements(this.data, listItems)];
        this.prependItems(newItems, firstItem.element);
        this.spliceItems(this.items.length - items.length, items.length);
        const desiredScrollTop = scrollTop + newItems.length * this.itemHeight;
        await scrollElement(containerElement, desiredScrollTop);
        for(let index = newItems.length - 1; index >= 0; index--){
            const itemElement = newItems[index].element;
            if(index === 0){
                this.observer.observe(itemElement);
            }
        }
        this.loading = false;
    }

    private async addItemsBelow(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer || this.numberOfItemsInHeight === undefined){
            return;
        }
        const lastItem = this.items[this.items.length - 1];
        if(!lastItem || !lastItem.data.hasNext){
            return;
        }
        this.loading = true;
        const listItems = await this.data.getItemsAfterItem(lastItem.data.item, this.numberOfItemsInHeight);
        const items = listItems.items;
        if(items.length === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        const newItems = [...createItemsWithElements(this.data, listItems)]
        for(let index = 0; index < newItems.length; index++){
            const newItem = newItems[index];
            const itemElement = newItem.element;
            contentElement.appendChild(itemElement);
            this.items.push(newItem);
            if(index === 0){
                this.observer.observe(itemElement);
            }
        }
        this.spliceItems(0, items.length)
        this.loading = false;
    }

    protected connectedCallback(){
        const templateEl = document.getElementById('very-long-list-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        this.shadow = shadow;
        
        const containerElement = shadow.getElementById('container')!;
        this.observer = new IntersectionObserver((entries) => this.handleObservedIntersections(entries), {
            root: containerElement
        })
    }

    private prependItems(items: ItemDataWithElement[], firstItemElement: Element): void {
        if(!this.shadow){
            return;
        }
        let elementToInsertBefore = firstItemElement;
        const contentElement = this.shadow.getElementById('content')!;
        for(let index = items.length - 1; index >= 0; index--){
            const newItem = items[index];
            const itemElement = newItem.element;
            contentElement.insertBefore(itemElement, elementToInsertBefore);
            elementToInsertBefore = itemElement;
            this.items.unshift(newItem);
        }
    }

    public async setData<TItem>(data: VeryLongListData<TItem> | undefined): Promise<void>{
        this.spliceItems(0, this.items.length);
        this.data = data;
        if(!data){
            return;
        }
        const { hasPrevious, hasNext, items } = data.items;
        if(items.length === 0 || !this.shadow || !this.observer){
            return;
        }
        const {height} = await waitForAnimationFrameWhen(() => this.getBoundingClientRect(), ({height}) => height > 0, 20);
        if(height === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        this.items.push(...createItemsWithElements(data, data.items));
        for(const item of this.items){
            contentElement.appendChild(item.element);
        }
        const firstItemElement = this.items[0].element;
        const {height: itemHeight} = await waitForAnimationFrameWhen(() => firstItemElement.getBoundingClientRect(), ({height}) => height > 0, 20);
        this.itemHeight = itemHeight;
        const numberOfItemsInHeight = Math.ceil(height / itemHeight);
        this.numberOfItemsInHeight = numberOfItemsInHeight;
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
                contentElement.appendChild(item.element);
            }
        }
        nrOfItemsBefore = Math.min(Math.max(0, this.items.length - numberOfItemsInHeight), nrOfItemsBefore);
        const containerElement = this.shadow.getElementById('container')!;
        const scrollTop = this.itemHeight * nrOfItemsBefore;
        await scrollElement(containerElement, scrollTop);
        for(let index = 0; index < this.items.length; index += this.numberOfItemsInHeight){
            const item = this.items[index];
            this.observer.observe(item.element);
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
