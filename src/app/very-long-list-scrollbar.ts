export class VeryLongListScrollbar extends HTMLElement {
    private shadow: ShadowRoot | undefined;
    private isVisible = false

    public get visible(): boolean {
        return this.isVisible;
    }
    public set visible(value: boolean){
        this.isVisible = value;
        if(!this.shadow){
            return;
        }
        const container = this.shadow.getElementById('container')!;
        if(value){
            container.classList.add('visible');
        }else{
            container.classList.remove('visible')
        }
    }
    protected connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-scrollbar-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        this.shadow = shadow;
    }
}

customElements.define('very-long-list-scrollbar', VeryLongListScrollbar);

declare global {
    interface HTMLElementTagNameMap {
        'very-long-list-scrollbar': VeryLongListScrollbar
    }
}