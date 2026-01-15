import type { AnagramListItem } from "../shared/anagram-list-messages";

class ConnectedAnagramItem {
    constructor(
        private readonly content: HTMLElement
    ){}

    setItem(item: AnagramListItem): void {
        this.content.innerText = item.elements.join('')
    }
}
export class AnagramItem extends HTMLElement {
    private connected: ConnectedAnagramItem | undefined
    private item: AnagramListItem | undefined;

    setItem(item: AnagramListItem): void {
        if(!this.connected){
            this.item = item;
            return;
        }
        this.connected.setItem(item)
    }
    connectedCallback(){
        const templateEl = document.getElementById('anagram-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);

        const contentElement = shadow.getElementById('content')!;
        this.connected = new ConnectedAnagramItem(contentElement);
        if(this.item){
            this.connected.setItem(this.item);
        }
    }
}

customElements.define('anagram-item', AnagramItem);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-item': AnagramItem
    }
}