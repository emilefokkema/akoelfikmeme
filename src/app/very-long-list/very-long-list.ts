import { ElementScroller } from "./element-scroller";
import { debounceWithAbort, throttle, waitForAnimationFrameWhen } from "../utils";
import type { VeryLongListData, VeryLongListItems } from "./very-long-list-data";
import './very-long-list-scrollbar'
import './very-long-list-item'
import type { ScrollRequestedEvent, VeryLongListScrollbar } from "./very-long-list-scrollbar";
import type { VeryLongListItem } from "./very-long-list-item";
import type { DisplayedItem, ContentDisplay } from "./content-display";
import { DisplayedData, type DisplayHeightRatioChangedEvent, type ScrolledRatioChangedEvent } from "./displayed-data";


class ContentDisplayImpl<TItem> implements ContentDisplay<TItem, VeryLongListItem> {
    constructor(
        private readonly containerElement: HTMLElement,
        private readonly containerElementScroller: ElementScroller,
        private readonly contentElement: HTMLElement,
        private readonly data: VeryLongListData<TItem>
    ){}

    appendItems(items: TItem[]): DisplayedItem<TItem, VeryLongListItem>[] {
        const result: DisplayedItem<TItem, VeryLongListItem>[] = [];
        for(const item of items){
            const displayed = this.createItemElement(item);
            this.contentElement.appendChild(displayed);
            result.push({ item, displayed })
        }
        return result;
    }

    async prependItems(referenceItem: VeryLongListItem, items: TItem[], totalHeight: number): Promise<DisplayedItem<TItem, VeryLongListItem>[]> {
        const result: DisplayedItem<TItem, VeryLongListItem>[] = [];
        const newScrollTop = this.containerElement.scrollTop + totalHeight;
        let elementToInsertBefore = referenceItem;
        for(let index = items.length - 1; index >= 0; index--){
            const item = items[index];
            const displayed = this.createItemElement(item);
            this.contentElement.insertBefore(displayed, elementToInsertBefore);
            result.unshift({ item, displayed })
            elementToInsertBefore = displayed;
        }
        this.containerElementScroller.scrollTo(newScrollTop).catch((e) => {
            console.warn(e)
        });
        return result;
    }

    removeDisplayedItem(item: VeryLongListItem): void {
        item.remove();
    }

    async getDisplayedHeight(displayedItem: VeryLongListItem, abortSignal?: AbortSignal): Promise<number | undefined> {
        const rect = await waitForAnimationFrameWhen(() => displayedItem.getBoundingClientRect(), ({height}) => height > 0, 20, abortSignal);
        if(rect.height === 0){
            return undefined;
        }
        return rect.height;
    }

    private createItemElement(item: TItem): VeryLongListItem {
        const itemElement = document.createElement('very-long-list-item');
        itemElement.appendChild(this.data.renderItem(item));
        return itemElement;
    }
}

class ConnectedVeryLongList {
    private height: number | undefined;
    private displayedData: DisplayedData<unknown, VeryLongListItem> | undefined
    private readonly scrollListener: () => void
    private readonly displayHeightRatioChangedListener: (ev: DisplayHeightRatioChangedEvent) => void
    private readonly scrolledRatioChangedListener: (ev: ScrolledRatioChangedEvent) => void
    private readonly resizeObserver: ResizeObserver;
    private readonly scrollRequestedListener: (ev: ScrollRequestedEvent) => void
    private readonly containerElementScroller: ElementScroller;
    private debouncedSetDataHeight = debounceWithAbort((abortSignal) => this.setDisplayedDataHeight(abortSignal), 300)
    constructor(
        public readonly containerElement: HTMLElement,
        public readonly contentElement: HTMLElement,
        public readonly scrollbar: VeryLongListScrollbar
    ){
        this.containerElementScroller = new ElementScroller(containerElement);
        this.displayHeightRatioChangedListener = (ev) => this.handleDisplayHeightRatioChanged(ev);
        this.scrolledRatioChangedListener = (ev) => this.handleScrolledRatioChanged(ev)
        const scrollListener = () => this.handleScroll();
        containerElement.addEventListener('scroll', scrollListener);
        this.scrollListener = scrollListener;
        const scrollRequestedListener = (e: ScrollRequestedEvent) => this.handleScrollRequested(e);
        scrollbar.addEventListener('scrollrequested', scrollRequestedListener);
        this.scrollRequestedListener = scrollRequestedListener;
        const resizeObserver = new ResizeObserver((entries) => this.handleResize(entries));
        resizeObserver.observe(containerElement);
        this.resizeObserver = resizeObserver;
    }

    displayData(data: VeryLongListData | undefined, abortSignal: AbortSignal): void {
        this.scrollbar.visible = false;
        if(this.displayedData){
            this.displayedData.destroy();
            this.displayedData = undefined;
        }
        if(!data){
            return;
        }
        this.displayedData = DisplayedData.create<unknown, VeryLongListItem>(
            data,
            new ContentDisplayImpl(
                this.containerElement,
                this.containerElementScroller,
                this.contentElement,
                data
            ),
            this.height,
            abortSignal
        );
        this.displayedData.addEventListener('displayheightratiochanged', this.displayHeightRatioChangedListener);
        this.displayedData.addEventListener('scrolledratiochanged', this.scrolledRatioChangedListener)
    }

    destroy(): void {
        this.containerElementScroller.destroy();
        this.containerElement.removeEventListener('scroll', this.scrollListener);
        this.scrollbar.removeEventListener('scrollrequested', this.scrollRequestedListener);
        this.resizeObserver.disconnect();
        if(this.displayedData){
            this.displayedData.removeEventListener('displayheightratiochanged', this.displayHeightRatioChangedListener);
            this.displayedData.removeEventListener('scrolledratiochanged', this.scrolledRatioChangedListener)
            this.displayedData.destroy();
        }
    }

    private handleScroll(): void {
        if(this.displayedData){
            const scrollTop = this.containerElement.scrollTop;
            this.displayedData.setScrollTop(scrollTop);
        }
    }

    private handleScrollRequested({ detail: { ratio }}: ScrollRequestedEvent): void {
        if(!this.displayedData){
            return;
        }
        const scrollTop = this.displayedData.getScrollTopAtRelativePosition(ratio);
        if(scrollTop === undefined){
            this.displayedData.scrollToPosition(ratio);
            return;
        }
        this.containerElementScroller.scrollTo(scrollTop)
    }

    private handleDisplayHeightRatioChanged({ detail: { displayHeightRatio }}: DisplayHeightRatioChangedEvent): void {
        if(displayHeightRatio >= 1){
            this.scrollbar.visible = false;
            return;
        }
        this.scrollbar.visible = true;
        this.scrollbar.thumbRatio = displayHeightRatio;
    }

    private handleScrolledRatioChanged({detail: { scrolledRatio }}: ScrolledRatioChangedEvent): void {
        this.scrollbar.scrolledRatio = scrolledRatio;
    }

    private setDisplayedDataHeight(abortSignal: AbortSignal): void {
        if(this.displayedData && this.height !== undefined){
            this.displayedData.setHeight(this.height, abortSignal);
        }
    }

    private handleResize([{contentRect: {height}}]: ResizeObserverEntry[]): void {
        this.height = height;
        this.debouncedSetDataHeight();
    }

    static create(
        shadow: ShadowRoot
    ): ConnectedVeryLongList {
        const containerElement = shadow.getElementById('content-container')!;
        const scrollbar = shadow.querySelector('very-long-list-scrollbar')!;
        const contentElement = shadow.getElementById('content')!;
        return new ConnectedVeryLongList(
            containerElement,
            contentElement,
            scrollbar
        )
    }
}

export class VeryLongList extends HTMLElement {
    private connectedList: ConnectedVeryLongList | undefined;

    protected connectedCallback(){
        const templateEl = document.getElementById('very-long-list-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        
        const connectedList = ConnectedVeryLongList.create(shadow);
        
        this.connectedList = connectedList;
    }

    protected disconnectedCallback(){
        if(this.connectedList){
            this.connectedList.destroy();
            this.connectedList = undefined;
        }
    }

    public setData(data: VeryLongListData | undefined, abortSignal: AbortSignal): void {
        if(!this.connectedList){
            return;
        }
        this.connectedList.displayData(data, abortSignal);
    }
}

customElements.define('very-long-list', VeryLongList);

declare global {
    interface HTMLElementTagNameMap {
        'very-long-list': VeryLongList
    }
}
