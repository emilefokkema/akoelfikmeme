export interface AnagramTableData<TItem = unknown> {
    item: TItem
    hasItemsAfterItem(item: TItem): Promise<boolean>
    getItemsAfterItem(item: TItem, nrOfItems: number): Promise<TItem[]>
    renderItem(item: TItem): Element
}

export class AnagramTable extends HTMLElement {
    connectedCallback(){
        const templateEl = document.getElementById('anagram-table-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content)
        
    }

    setData(data: AnagramTableData){

    }
}

customElements.define('anagram-table', AnagramTable);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-table': AnagramTable
    }
}
