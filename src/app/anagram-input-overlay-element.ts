import { CustomElement, type ConnectedElement } from "./html-utils";

export interface ElementDropEvent extends CustomEvent {
    detail: {
        location: 'inside' | 'after'
    }
}

export interface ElementDragEnterEvent extends CustomEvent {
    detail: {
        location: 'inside' | 'after'
    }
}
export interface AnagramInputOverlayEventMap extends HTMLElementEventMap {
    'elementdragenter': ElementDragEnterEvent
    'elementdrop': ElementDropEvent
}
class ConnectedAnagramInputOverlayElement {
    private _value: string | undefined;

    get value(): string | undefined {
        return this._value;
    }
    set value(value: string | undefined) {
        this._value = value;
        this.textContainer.textContent = value || '';
    }
    constructor(
        container: HTMLElement,
        private readonly textContainer: HTMLElement,
        private readonly interstice: HTMLElement,
        private readonly connectedElement: ConnectedElement
    ){
        connectedElement.listeners.target(container).addEventListener('dragenter', (e) => this.handleDragEnter(e));
        connectedElement.listeners.target(container).addEventListener('dragover', (e) => this.handleDragOver(e));
        connectedElement.listeners.target(container).addEventListener('drop', (e) => this.handleDrop(e));
    }

    private handleDragEnter(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        e.stopPropagation();
        if(e.target === this.textContainer){
            const event: ElementDragEnterEvent = new CustomEvent('elementdragenter', { composed: true, bubbles: true, detail: { location: 'inside' as const}})
            this.connectedElement.dispatchEvent(event);
            return;
        }
        if(e.target === this.interstice) {
            const event: ElementDragEnterEvent = new CustomEvent('elementdragenter', { composed: true, bubbles: true, detail: { location: 'after' as const}})
            this.connectedElement.dispatchEvent(event);
        }
    }

    private handleDragOver(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move'
    }

    private handleDrop(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }

        const event: ElementDropEvent = new CustomEvent(
            'elementdrop',
            { 
                bubbles: true,
                composed: true,
                detail: { 
                    location: e.target === this.interstice ? 'after' as const : 'inside' as const
                }
            }
        );
        this.connectedElement.dispatchEvent(event)
    }

    static create(
        connectedElement: ConnectedElement
    ): ConnectedAnagramInputOverlayElement {
        const container = connectedElement.shadowRoot.getElementById('container') as HTMLElement;
        const textContainer = connectedElement.shadowRoot.getElementById('text-container') as HTMLElement;
        const interstice = connectedElement.shadowRoot.getElementById('interstice') as HTMLElement;
        return new ConnectedAnagramInputOverlayElement(
            container,
            textContainer,
            interstice,
            connectedElement
        )
    }
}

export class AnagramInputOverlayElement extends CustomElement<ConnectedAnagramInputOverlayElement, AnagramInputOverlayEventMap> {
    private _value: string | undefined;

    get value(): string | undefined {
        if(this.connected) {
            return this.connected.value;
        }
        return this._value;
    }
    set value(value: string | undefined) {
        if(this.connected) {
            this.connected.value = value;
            return;
        }
        this._value = value;
    }

    protected createConnected(connected: ConnectedElement): ConnectedAnagramInputOverlayElement {
        const result = ConnectedAnagramInputOverlayElement.create(connected);
        if(this._value !== undefined){
            result.value = this._value;
        }
        return result;
    }

    protected createContent(): Node | undefined {
        const templateEl = document.getElementById('anagram-input-overlay-element-template') as HTMLTemplateElement;
        return templateEl.content.cloneNode(true);
    }
}

customElements.define('anagram-input-overlay-element', AnagramInputOverlayElement);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input-overlay-element': AnagramInputOverlayElement
    }
}