export interface AnagramTableData<TItem = unknown> {
    item: TItem
    hasItemsAfterItem(item: TItem): Promise<boolean>
    getItemsAfterItem(item: TItem, nrOfItems: number): Promise<TItem[]>
    renderItem(item: TItem): Element
}

class AnagramTableRow extends HTMLElement {
    connectedCallback(){
        const templateEl = document.getElementById('anagram-table-row-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
    }
}

export class AnagramTable extends HTMLElement {
    private lineHeight: number = 20;
    private shadow: ShadowRoot | undefined;

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
    }

    async setData(data: AnagramTableData): Promise<void> {
        if(!this.shadow){
            return;
        }
        const {height} = this.getBoundingClientRect();
        const numberOfItemsNeeded = Math.floor(3 * height / this.lineHeight);
        const desiredHeight = numberOfItemsNeeded * this.lineHeight;
        const contentElement = this.shadow.getElementById('content')!;
        contentElement.style.height = `${desiredHeight}px`;
        const newItems = await data.getItemsAfterItem(data.item, numberOfItemsNeeded - 1);
        for(const newItem of [data.item, ...newItems]){
            const rowElement = document.createElement('anagram-table-row');
            rowElement.style.height = `${this.lineHeight}px`;
            rowElement.appendChild(data.renderItem(newItem));
            contentElement.appendChild(rowElement);
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
