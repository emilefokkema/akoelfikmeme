export interface ScrollRequestedEvent extends CustomEvent {
    detail: {
        ratio: number
    }
}

export interface VeryLongListScrollbarEventMap extends HTMLElementEventMap {
    'scrollrequested': ScrollRequestedEvent
}

interface ExtraTrackRegion {
    contains(ratio: number): boolean
    setRatio(ratio: number, entering: boolean): void
}

interface ExtraTrackRegionMeasurements {
    lowerRegionUpperBoundary: number
    upperRegionLowerBoundary: number
    extraThumbHeightRatio: number
    extraThumbMaxTop: number
}

class LowerExtraTrackRegion implements ExtraTrackRegion {
    private readonly upperBoundary: number
    private readonly extraThumbHeightRatio: number
    constructor(
        private readonly extraThumb: HTMLElement,
        measurements: ExtraTrackRegionMeasurements
    ){
        this.upperBoundary = measurements.lowerRegionUpperBoundary;
        this.extraThumbHeightRatio = measurements.extraThumbHeightRatio;
    }

    contains(ratio: number): boolean {
        return ratio < this.upperBoundary;
    }

    setRatio(ratio: number, entering: boolean): void {
        if(entering){
            this.extraThumb.style.removeProperty('top');
        }
        const rightmostPointHeightPercentage = 100 * ratio / this.extraThumbHeightRatio;
        this.extraThumb.style.clipPath = `polygon(0 100%, 100% ${rightmostPointHeightPercentage}%, 0 0)`;
    }
}

class MiddleExtraTrackRegion implements ExtraTrackRegion {
    private readonly lowerBoundary: number
    private readonly upperBoundary: number
    private readonly extraThumbHeightRatio: number
    constructor(
        private readonly extraThumb: HTMLElement,
        measurements: ExtraTrackRegionMeasurements
    ){
        this.extraThumbHeightRatio = measurements.extraThumbHeightRatio;
        this.lowerBoundary = measurements.lowerRegionUpperBoundary;
        this.upperBoundary = measurements.upperRegionLowerBoundary;
    }

    contains(ratio: number): boolean {
        return ratio > this.lowerBoundary && ratio < this.upperBoundary;
    }

    setRatio(ratio: number, entering: boolean): void {
        if(entering){
            this.extraThumb.style.removeProperty('clip-path');
        }
        this.extraThumb.style.top = `${100 * (ratio - this.extraThumbHeightRatio / 2)}%`;
    }
}

class UpperExtraTrackRegion implements ExtraTrackRegion {
    private readonly lowerBoundary: number
    private readonly extraThumbMaxTop: number
    private readonly extraThumbMaxTopInPercent: number
    private readonly extraThumbHeightRatio: number
    constructor(
        private readonly extraThumb: HTMLElement,
        measurements: ExtraTrackRegionMeasurements
    ){
        this.lowerBoundary = measurements.upperRegionLowerBoundary;
        this.extraThumbMaxTop = measurements.extraThumbMaxTop;
        this.extraThumbMaxTopInPercent = 100 * measurements.extraThumbMaxTop;
        this.extraThumbHeightRatio = measurements.extraThumbHeightRatio;
    }

    contains(ratio: number): boolean {
        return ratio > this.lowerBoundary;
    }

    setRatio(ratio: number, entering: boolean): void {
        if(entering){
            this.extraThumb.style.top = `${this.extraThumbMaxTopInPercent}%`
        }
        const rightmostPointHeightPercentage = 100 * (ratio - this.extraThumbMaxTop) / this.extraThumbHeightRatio
        this.extraThumb.style.clipPath = `polygon(0 100%, 100% ${rightmostPointHeightPercentage}%, 0 0)`
    }
}

const extraThumbHeightInPixels = 10;

class ConnectedVeryLongListScrollbar {
    private _thumbRatio = 1;
    private _visible = false;
    private _scrolledRatio = 0;
    private extraTrackVisible = false;
    private extraTrackRegions: ExtraTrackRegion[] = []
    private currentExtraTrackRegion: ExtraTrackRegion | undefined
    private readonly clickListener: (ev: PointerEvent) => void
    constructor(
        private readonly thumb: HTMLElement,
        private readonly extraThumb: HTMLElement,
        private readonly container: HTMLElement,
        private readonly dispatchEvent: (ev: Event) => void
    ){
        const clickListener = (ev: PointerEvent): void => this.handleClick(ev);
        this.clickListener = clickListener;
        container.addEventListener('click', clickListener, {capture: true});
    }

    get thumbRatio(): number {
        return this._thumbRatio;
    }
    set thumbRatio(value: number) {
        if(this._thumbRatio === value){
            return;
        }
        this._thumbRatio = value;
        const { height } = this.container.getBoundingClientRect();
        const thumbHeight = value * 100;
        const thumbHeightInPixels = height * value;
        const extraTrackVisible = thumbHeightInPixels <= 1;
        this.extraTrackVisible = extraTrackVisible;
        if(extraTrackVisible) {
            this.container.classList.add('extra-track-visible');
            this.extraTrackRegions = this.createExtraTrackRegions(height);
            this.setExtraTrackThumb(this._scrolledRatio)
        } else {
            this.container.classList.remove('extra-track-visible');
        }
        this.thumb.style.height = `${thumbHeight}%`;
    }

    get scrolledRatio(): number {
        return this._scrolledRatio;
    }
    set scrolledRatio(value: number) {
        if(this._scrolledRatio === value){
            return;
        }
        this._scrolledRatio = value;
        const thumbTop = value * 100;
        this.thumb.style.top = `${thumbTop}%`;
        this.setExtraTrackThumb(value);
    }

    get visible(): boolean {
        return this._visible;
    }
    set visible(value: boolean){
        if(this._visible === value){
            return;
        }
        this._visible = value;
        if(value){
            this.container.classList.add('visible');
        }else{
            this.container.classList.remove('visible')
        }
    }

    destroy(): void {
        this.container.removeEventListener('click', this.clickListener, {capture: true});
    }

    private createExtraTrackRegions(
        scrollbarHeightInPixels: number
    ): ExtraTrackRegion[] {
        const extraThumbHeightRatio = extraThumbHeightInPixels / scrollbarHeightInPixels;
        const boundarySize = extraThumbHeightRatio / 2;
        const measurements: ExtraTrackRegionMeasurements = {
            lowerRegionUpperBoundary: boundarySize,
            upperRegionLowerBoundary: 1 - boundarySize,
            extraThumbHeightRatio,
            extraThumbMaxTop: 1 - extraThumbHeightRatio
        }
        return [
            new LowerExtraTrackRegion(this.extraThumb, measurements),
            new MiddleExtraTrackRegion(this.extraThumb, measurements),
            new UpperExtraTrackRegion(this.extraThumb, measurements)
        ]
    }

    private handleClick(e: PointerEvent): void {
        const { y: containerY, height } = this.container.getBoundingClientRect();
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
    }

    private setExtraTrackThumb(value: number): void {
        if(!this.extraTrackVisible){
            return;
        }
        const region = this.currentExtraTrackRegion?.contains(value) ? this.currentExtraTrackRegion : this.extraTrackRegions.find(r => r.contains(value));
        if(!region){
            return;
        }
        const entering = this.currentExtraTrackRegion !== region;
        region.setRatio(value, entering);
        this.currentExtraTrackRegion = region;
    }

    static create(
        shadow: ShadowRoot,
        dispatchEvent: (ev: Event) => void
    ): ConnectedVeryLongListScrollbar {
        const thumb = shadow.getElementById('thumb')!;
        const extaThumb = shadow.getElementById('extra-thumb')!;
        const container = shadow.getElementById('container')!;
        return new ConnectedVeryLongListScrollbar(
            thumb,
            extaThumb,
            container,
            dispatchEvent
        );
    }
}

export class VeryLongListScrollbar extends HTMLElement {
    private connected: ConnectedVeryLongListScrollbar | undefined

    public get thumbRatio(): number {
        return this.connected?.thumbRatio ?? 1;
    }
    public set thumbRatio(value: number){
        if(!this.connected){
            return;
        }
        this.connected.thumbRatio = value;
    }
    public get scrolledRatio(): number {
        return this.connected?.scrolledRatio ?? 0;
    }
    public set scrolledRatio(value: number){
        if(!this.connected){
            return;
        }
        this.connected.scrolledRatio = value;
    }
    public get visible(): boolean {
        return this.connected?.visible ?? false;
    }
    public set visible(value: boolean){
        if(!this.connected){
            return;
        }
        this.connected.visible = value;
    }

    protected connectedCallback(): void {
        const templateEl = document.getElementById('very-long-list-scrollbar-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);

        const connected = ConnectedVeryLongListScrollbar.create(
            shadow,
            (e) => this.dispatchEvent(e)
        );
        this.connected = connected;
    }

    protected disconnectedCallback() {
        if(this.connected){
            this.connected.destroy();
            this.connected = undefined;
        }
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