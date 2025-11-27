export class VeryLongListItem extends HTMLElement {
    
    connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-item-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
    }
}

customElements.define('very-long-list-item', VeryLongListItem);

declare global {
    interface HTMLElementTagNameMap {
        'very-long-list-item': VeryLongListItem
    }
}