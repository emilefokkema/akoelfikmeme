export class VeryLongListScrollbar extends HTMLElement {
    private shadow: ShadowRoot | undefined;
    private isVisible = false
    private _ratio = 1;
    private _scrolledRatio = 0;
    private height = 1;

    public get thumbRatio(): number {
        return this._ratio;
    }
    public set thumbRatio(value: number){
        if(this._ratio === value){
            return;
        }
        this._ratio = value;
        if(!this.shadow){
            return;
        }
        const container = this.shadow.getElementById('container')!;
        const thumb = this.shadow.getElementById('thumb')!;
        const {height} = container.getBoundingClientRect();
        this.height = height;
        const thumbHeight = height * value;
        thumb.style.height = `${thumbHeight}px`;
    }
    public get scrolledRatio(): number {
        return this._scrolledRatio;
    }
    public set scrolledRatio(value: number){
        if(this._scrolledRatio === value){
            return;
        }
        this._scrolledRatio = value;
        if(!this.shadow){
            return;
        }
        const thumb = this.shadow.getElementById('thumb')!;
        const thumbTop = this.height * value;
        thumb.style.top = `${thumbTop}px`;
    }
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