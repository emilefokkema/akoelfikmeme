import { CustomElement, type ConnectedElement } from "./utils";

export interface AnagramInputOverlayEventMap extends HTMLElementEventMap {
    'elementdragenter': CustomEvent
    'elementdragenterinterstice': CustomEvent
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
        connectedElement.listeners.target(container).addEventListener('dragenter', (e) => this.handleDragEnter(e))
    }

    private handleDragEnter(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        e.stopPropagation();
        if(e.target === this.textContainer){
            this.connectedElement.dispatchEvent(new CustomEvent('elementdragenter', { composed: true, bubbles: true}));
            return;
        }
        if(e.target === this.interstice) {
            this.connectedElement.dispatchEvent(new CustomEvent('elementdragenterinterstice', { composed: true, bubbles: true}));
        }
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