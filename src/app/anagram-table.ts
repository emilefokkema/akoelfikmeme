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
    connectedCallback(){
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

export class AnagramTable extends HTMLElement {
    private lineHeight: number = 20;
    private shadow: ShadowRoot | undefined;
    private numberOfRowsInHeight: number = 1;

    connectedCallback(){
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
    }

    async setData<TItem>(data: AnagramTableData<TItem>): Promise<void> {
        if(!this.shadow){
            return;
        }
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
        if(tooFew && hasNext){
            const itemsAfter = await data.getItemsAfterItem(items[items.length - 1], tooFew);
            allItems.push(...itemsAfter.items.map((item, index) => ({
                item,
                hasPrevious: true,
                hasNext: index < itemsAfter.items.length - 1 || itemsAfter.hasNext
            })))
        }
        const nrOfRowsBefore = Math.min(Math.max(0, allItems.length - this.numberOfRowsInHeight), nrOfItemsBefore);
        const contentElement = this.shadow.getElementById('content')!;
        const containerElement = this.shadow.getElementById('container')!;
        for(const item of allItems){
            const rowElement = document.createElement('anagram-table-row');
            rowElement.style.height = `${this.lineHeight}px`;
            rowElement.appendChild(data.renderItem(item.item));
            contentElement.appendChild(rowElement);
        }
        
        if(nrOfRowsBefore > 0){
            const scrollTop = this.lineHeight * nrOfRowsBefore;
            scrollElement(containerElement, scrollTop)
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
