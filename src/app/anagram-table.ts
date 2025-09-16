export interface AnagramTableItems<TItem> {
    items: TItem[]
    hasPrevious: boolean
    hasNext: boolean
}

export interface AnagramTableData<TItem = unknown> {
    items: AnagramTableItems<TItem>
    getItemsAfterItem(item: TItem, nrOfItems: number): Promise<AnagramTableItems<TItem>>
    getItemsBeforeItem(item: TItem, nrOfItems: number): Promise<AnagramTableItems<TItem>>
    renderItem(item: TItem): Element
}

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

class AnagramTableRow extends HTMLElement {
    
    connectedCallback(): void {
        const templateEl = document.getElementById('anagram-table-row-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
    }
}

interface TableRowData<TItem> {
    item: TItem
    hasNext: boolean
    hasPrevious: boolean
}

interface TableRowDataWithElement<TItem = unknown> {
    data: TableRowData<TItem>
    element: Element
}

export class AnagramTable extends HTMLElement {
    private lineHeight: number = 20;
    private shadow: ShadowRoot | undefined;
    private numberOfRowsInHeight: number = 1;
    private observer: IntersectionObserver | undefined;
    private data: AnagramTableData | undefined;
    private rows: TableRowDataWithElement[] = [];
    private loading = false;

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {
        for(const {isIntersecting, target} of entries){
            const rowIndex = this.rows.findIndex(r => r.element === target);
            if(rowIndex === -1){
                continue;
            }
            if(isIntersecting){
                if(rowIndex >= this.rows.length - this.numberOfRowsInHeight){
                    console.log(`row ${rowIndex} is visible, trying to add new rows`)
                    this.addRowsBelow();
                    return;
                }
                if(rowIndex <= this.numberOfRowsInHeight){
                    console.log(`row ${rowIndex} is visible, trying to add new rows`)
                    this.addRowsAbove();
                    return;
                }
            }
        }
    }

    private async addRowsAbove(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer){
            return;
        }
        const firstRow = this.rows[0];
        if(!firstRow){
            return;
        }
        if(!firstRow.data.hasPrevious){
            console.log('no more before', firstRow.data.item)
            return;
        }
        this.loading = true;
        const {items, hasPrevious} = await this.data.getItemsBeforeItem(firstRow.data.item, this.numberOfRowsInHeight);
        if(items.length === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        let elementToInsertBefore = firstRow.element;
        for(let index = items.length - 1; index >= 0; index--){
            const item = items[index];
            const rowElement = document.createElement('anagram-table-row');
            rowElement.style.height = `${this.lineHeight}px`;
            rowElement.appendChild(this.data.renderItem(item));
            contentElement.insertBefore(rowElement, elementToInsertBefore);
            elementToInsertBefore = rowElement;
            this.rows.unshift({
                data: {
                    item,
                    hasPrevious: index > 0 || hasPrevious,
                    hasNext: true
                },
                element: rowElement
            })
            if(index === 0){
                this.observer.observe(rowElement)
            }
        }
        const rowsToRemove = this.rows.splice(this.rows.length - items.length, items.length);
        for(const rowToRemove of rowsToRemove){
            rowToRemove.element.remove();
            this.observer.unobserve(rowToRemove.element);
        }
        this.loading = false;
        console.log(`Did add rows above. Current number of rows ${this.rows.length}`)
    }

    private async addRowsBelow(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer){
            return;
        }
        const lastRow = this.rows[this.rows.length - 1];
        if(!lastRow){
            return;
        }
        if(!lastRow.data.hasNext){
            console.log('no more after', lastRow.data.item)
            return;
        }
        this.loading = true;
        const {items, hasNext} = await this.data.getItemsAfterItem(lastRow.data.item, this.numberOfRowsInHeight);
        if(items.length === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        for(let index = 0; index < items.length; index++){
            const item = items[index];
            const rowElement = document.createElement('anagram-table-row');
            rowElement.style.height = `${this.lineHeight}px`;
            rowElement.appendChild(this.data.renderItem(item));
            contentElement.appendChild(rowElement);
            this.rows.push({
                data: {
                    item,
                    hasPrevious: true,
                    hasNext: index < items.length - 1 || hasNext
                },
                element: rowElement
            })
            if(index === 0){
                this.observer.observe(rowElement)
            }
        }
        const rowsToRemove = this.rows.splice(0, items.length);
        for(const rowToRemove of rowsToRemove){
            rowToRemove.element.remove();
            this.observer.unobserve(rowToRemove.element);
        }
        this.loading = false;
        console.log(`Did add rows below. Current number of rows ${this.rows.length}`)
    }

    protected connectedCallback(){
        const templateEl = document.getElementById('anagram-table-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        this.shadow = shadow;
        const lineHeightAttributeValue = this.getAttribute('line-height');
        if(lineHeightAttributeValue !== null){
            this.lineHeight = Number(lineHeightAttributeValue);
        }
        const {height} = this.getBoundingClientRect();
        this.numberOfRowsInHeight = Math.ceil(height / this.lineHeight);
        const containerElement = shadow.getElementById('container')!;
        this.observer = new IntersectionObserver((entries) => this.handleObservedIntersections(entries), {
            root: containerElement
        })
    }

    public async setData<TItem>(data: AnagramTableData<TItem>): Promise<void> {
        if(!this.shadow || !this.observer){
            return;
        }
        this.data = data;
        const { hasPrevious, hasNext, items } = data.items;
        let nrOfItemsBefore = 0;
        const allItems: TableRowData<TItem>[] = [];
        if(hasPrevious){
            const itemsBefore = await data.getItemsBeforeItem(items[0], 2 * this.numberOfRowsInHeight);
            allItems.push(...itemsBefore.items.map((item, index) => ({
                item,
                hasNext: true,
                hasPrevious: index > 0 || itemsBefore.hasPrevious
            })));
            nrOfItemsBefore = itemsBefore.items.length;
        }
        allItems.push(...items.map((item, index) => ({
            item,
            hasNext: index < items.length - 1 || hasNext,
            hasPrevious: index > 0 || hasPrevious
        })));
        const tooFew = 3 * this.numberOfRowsInHeight - items.length;
        if(tooFew > 0 && hasNext){
            const itemsAfter = await data.getItemsAfterItem(items[items.length - 1], tooFew);
            allItems.push(...itemsAfter.items.map((item, index) => ({
                item,
                hasPrevious: true,
                hasNext: index < itemsAfter.items.length - 1 || itemsAfter.hasNext
            })))
        }
        console.log('number of items', allItems.length)
        const nrOfRowsBefore = Math.min(Math.max(0, allItems.length - this.numberOfRowsInHeight), nrOfItemsBefore);
        const contentElement = this.shadow.getElementById('content')!;
        const containerElement = this.shadow.getElementById('container')!;
        for(const item of allItems){
            const rowElement = document.createElement('anagram-table-row');
            rowElement.style.height = `${this.lineHeight}px`;
            rowElement.appendChild(data.renderItem(item.item));
            contentElement.appendChild(rowElement);
            this.rows.push({
                data: item,
                element: rowElement
            });
        }
        
        const scrollTop = this.lineHeight * nrOfRowsBefore;
        await scrollElement(containerElement, scrollTop);
        for(let index = 0; index < this.rows.length; index += this.numberOfRowsInHeight){
            const row = this.rows[index];
            this.observer.observe(row.element);
        }
    }
}

customElements.define('anagram-table', AnagramTable);
customElements.define('anagram-table-row', AnagramTableRow);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-table': AnagramTable
        'anagram-table-row': AnagramTableRow
    }
}
