export interface AnagramTableItems<TItem = unknown> {
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

function createRowForItem(data: AnagramTableData, item: unknown, height: number): AnagramTableRow {
    const rowElement = document.createElement('anagram-table-row');
    rowElement.style.height = `${height}px`;
    rowElement.appendChild(data.renderItem(item));
    return rowElement;
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

function *createRows(
    data: AnagramTableData,
    {items, hasPrevious, hasNext}: AnagramTableItems,
    rowHeight: number
): Iterable<TableRowDataWithElement>{
    for(let index = 0; index < items.length; index++){
        const item = items[index];
        yield {
            data: {
                item,
                hasPrevious: index > 0 || hasPrevious,
                hasNext: index < items.length - 1 || hasNext
            },
            element: createRowForItem(data, item, rowHeight)
        }
    }
}

export class AnagramTable extends HTMLElement {
    private lineHeight: number = 20;
    private shadow: ShadowRoot | undefined;
    private numberOfRowsInHeight: number = 1;
    private observer: IntersectionObserver | undefined;
    private data: AnagramTableData | undefined;
    private rows: TableRowDataWithElement[] = [];
    private loading = false;
    private queuedAddRowsAbove = queued(() => this.addRowsAbove());

    private handleObservedIntersections(entries: IntersectionObserverEntry[]): void {
        for(const {isIntersecting, target} of entries){
            const rowIndex = this.rows.findIndex(r => r.element === target);
            if(rowIndex === -1 || !isIntersecting){
                continue;
            }
            if(rowIndex >= this.rows.length - this.numberOfRowsInHeight){
                this.addRowsBelow();
                return;
            }
            if(rowIndex <= this.numberOfRowsInHeight){
                this.queuedAddRowsAbove();
                return;
            }
        }
    }

    private spliceRows(startIndex: number, deleteCount: number): void {
        if(!this.observer){
            return;
        }
        const rowsToRemove = this.rows.splice(startIndex, deleteCount);
        for(const rowToRemove of rowsToRemove){
            rowToRemove.element.remove();
            this.observer.unobserve(rowToRemove.element);
        }
    }

    private async addRowsAbove(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer){
            return;
        }
        const firstRow = this.rows[0];
        if(!firstRow || !firstRow.data.hasPrevious){
            return;
        }
        this.loading = true;
        const containerElement = this.shadow.getElementById('container')!;
        const tableItems = await this.data.getItemsBeforeItem(firstRow.data.item, this.numberOfRowsInHeight);
        const scrollTop = containerElement.scrollTop;
        const items = tableItems.items;
        if(items.length === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        let elementToInsertBefore = firstRow.element;
        const newRows = [...createRows(this.data, tableItems, this.lineHeight)];
        for(let index = newRows.length - 1; index >= 0; index--){
            const newRow = newRows[index];
            const rowElement = newRow.element;
            contentElement.insertBefore(rowElement, elementToInsertBefore);
            elementToInsertBefore = rowElement;
            this.rows.unshift(newRow);
        }
        this.spliceRows(this.rows.length - items.length, items.length);
        const desiredScrollTop = scrollTop + newRows.length * this.lineHeight;
        await scrollElement(containerElement, desiredScrollTop);
        for(let index = newRows.length - 1; index >= 0; index--){
            const rowElement = newRows[index].element;
            if(index === 0){
                this.observer.observe(rowElement);
            }
        }
        this.loading = false;
    }

    private async addRowsBelow(): Promise<void> {
        if(this.loading || !this.data || !this.shadow || !this.observer){
            return;
        }
        const lastRow = this.rows[this.rows.length - 1];
        if(!lastRow || !lastRow.data.hasNext){
            return;
        }
        this.loading = true;
        const tableItems = await this.data.getItemsAfterItem(lastRow.data.item, this.numberOfRowsInHeight);
        const items = tableItems.items;
        if(items.length === 0){
            return;
        }
        const contentElement = this.shadow.getElementById('content')!;
        const newRows = [...createRows(this.data, tableItems, this.lineHeight)]
        for(let index = 0; index < newRows.length; index++){
            const newRow = newRows[index];
            const rowElement = newRow.element;
            contentElement.appendChild(rowElement);
            this.rows.push(newRow);
            if(index === 0){
                this.observer.observe(rowElement);
            }
        }
        this.spliceRows(0, items.length)
        this.loading = false;
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
        this.spliceRows(0, this.rows.length);
        this.data = data;
        const { hasPrevious, hasNext, items } = data.items;
        let nrOfItemsBefore = 0;
        if(hasPrevious){
            const itemsBefore = await data.getItemsBeforeItem(items[0], 2 * this.numberOfRowsInHeight);
            this.rows.push(...createRows(data, itemsBefore, this.lineHeight));
            nrOfItemsBefore = itemsBefore.items.length;
        }
        this.rows.push(...createRows(data, data.items, this.lineHeight));
        const tooFew = 3 * this.numberOfRowsInHeight - items.length;
        if(tooFew > 0 && hasNext){
            const itemsAfter = await data.getItemsAfterItem(items[items.length - 1], tooFew);
            this.rows.push(...createRows(data, itemsAfter, this.lineHeight));
        }
        const nrOfRowsBefore = Math.min(Math.max(0, this.rows.length - this.numberOfRowsInHeight), nrOfItemsBefore);
        const contentElement = this.shadow.getElementById('content')!;
        const containerElement = this.shadow.getElementById('container')!;
        for(const row of this.rows){
            contentElement.appendChild(row.element);
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
