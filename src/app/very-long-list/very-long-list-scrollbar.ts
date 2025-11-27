export interface ScrollRequestedEvent extends CustomEvent {
    detail: {
        ratio: number
    }
}

export interface VeryLongListScrollbarEventMap extends HTMLElementEventMap {
    'scrollrequested': ScrollRequestedEvent
}

export class VeryLongListScrollbar extends HTMLElement {
    private shadow: ShadowRoot | undefined;
    private isVisible = false
    private _ratio = 1;
    private _scrolledRatio = 0;
    private thumb: HTMLElement | undefined;
    private extraThumbUpperScrollRatioBoundary: number | undefined;
    private extraThumbLowerScrollRatioBoundary: number | undefined;
    private isOutsideExtraThumbScrollRatioBoundaries: boolean | undefined;
    private extaThumb: HTMLElement | undefined;
    private extraTrackVisible = false;

    public get thumbRatio(): number {
        return this._ratio;
    }
    public set thumbRatio(value: number){
        if(this._ratio === value || !this.thumb){
            return;
        }
        this._ratio = value;
        if(!this.shadow){
            return;
        }
        const container = this.shadow.getElementById('container')!;
        const { height } = container.getBoundingClientRect();
        const thumbHeight = value * 100;
        const thumbHeightInPixels = height * value;
        const extraTrackVisible = thumbHeightInPixels <= 1;
        if(extraTrackVisible){
            container.classList.add('extra-track-visible');
            const boundary = 5 / height;
            this.extraThumbLowerScrollRatioBoundary = boundary;
            this.extraThumbUpperScrollRatioBoundary = 1 - boundary;
        }else{
            container.classList.remove('extra-track-visible');
        }
        this.extraTrackVisible = extraTrackVisible;
        this.thumb.style.height = `${thumbHeight}%`;
        this.setExtraTrackThumb(0)
    }
    public get scrolledRatio(): number {
        return this._scrolledRatio;
    }
    public set scrolledRatio(value: number){
        if(this._scrolledRatio === value || !this.thumb){
            return;
        }
        this._scrolledRatio = value;
        if(!this.shadow){
            return;
        }
        const thumbTop = value * 100;
        this.thumb.style.top = `${thumbTop}%`;
        this.setExtraTrackThumb(value)
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
    private setExtraTrackThumb(value: number): void {
        if(
            !this.extraTrackVisible ||
            !this.extaThumb ||
            this.extraThumbLowerScrollRatioBoundary === undefined ||
            this.extraThumbUpperScrollRatioBoundary === undefined
        ){
            return;
        }
        const thumbTop = value * 100;
        const isOutsideExtraThumbScrollRatioBoundaries = value > this.extraThumbLowerScrollRatioBoundary && value < this.extraThumbUpperScrollRatioBoundary;
        if(isOutsideExtraThumbScrollRatioBoundaries){
            if(this.isOutsideExtraThumbScrollRatioBoundaries !== true){
                this.isOutsideExtraThumbScrollRatioBoundaries = true;
                this.extaThumb.style.removeProperty('clip-path');
            }
            this.extaThumb.style.top = `${thumbTop - 100 * this.extraThumbLowerScrollRatioBoundary}%`
        }else{
            const isInLower = value < this.extraThumbLowerScrollRatioBoundary
            const isInUpper = value > this.extraThumbUpperScrollRatioBoundary;
            if(this.isOutsideExtraThumbScrollRatioBoundaries){
                this.isOutsideExtraThumbScrollRatioBoundaries = false;
                if(isInLower){
                    this.extaThumb.style.removeProperty('top');
                }
            }
            if(isInLower){
                this.extaThumb.style.clipPath = `polygon(0 100%, 100% ${(value / this.extraThumbLowerScrollRatioBoundary) * 50}%, 0 0)`
            }
            if(isInUpper){
                this.extaThumb.style.clipPath = `polygon(0 100%, 100% ${(1 + (value - this.extraThumbUpperScrollRatioBoundary) / this.extraThumbLowerScrollRatioBoundary) * 50}%, 0 0)`
            }
        }
    }
    protected connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-scrollbar-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        this.shadow = shadow;
        this.thumb = shadow.getElementById('thumb')!;
        this.extaThumb = shadow.getElementById('extra-thumb')!;
        const container = shadow.getElementById('container')!;
        container.addEventListener('click', (e) => {
            const { y: containerY, height } = container.getBoundingClientRect();
            const containerOffsetY = e.pageY - containerY;
            const clickedRatio = containerOffsetY / height;
            if(clickedRatio > this._scrolledRatio && clickedRatio < this._scrolledRatio + this.thumbRatio){
                return;
            }
            const ratio = Math.min(1 - this.thumbRatio, clickedRatio);
            const customEvent = new CustomEvent('scrollrequested', { 
                detail: { ratio },
                composed: true,
                bubbles: true
            });
            this.dispatchEvent(customEvent);
        }, {capture: true})
    }
    addEventListener<K extends keyof VeryLongListScrollbarEventMap>(type: K, listener: (this: HTMLElement, ev: VeryLongListScrollbarEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.addEventListener(type, listener as (ev: Event) => void, options);
    }
    removeEventListener<K extends keyof VeryLongListScrollbarEventMap>(type: K, listener: (this: HTMLElement, ev: VeryLongListScrollbarEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.removeEventListener(type, listener as (ev: Event) => void, options);
    }
}

customElements.define('very-long-list-scrollbar', VeryLongListScrollbar);

declare global {
    interface HTMLElementTagNameMap {
        'very-long-list-scrollbar': VeryLongListScrollbar
    }
}