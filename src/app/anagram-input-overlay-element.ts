import { CustomElement, type ConnectedElement } from "./utils";

export interface ElementDragEnterEvent extends CustomEvent {

}

export interface AnagramInputOverlayEventMap extends HTMLElementEventMap {
    'elementdragenter': ElementDragEnterEvent
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
        private readonly textContainer: HTMLElement,
        private readonly connectedElement: ConnectedElement
    ){
        connectedElement.listeners.target(textContainer).addEventListener('dragenter', (e) => this.handleDragEnter(e))
    }

    private handleDragEnter(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        this.connectedElement.dispatchEvent(new CustomEvent('elementdragenter', { composed: true, bubbles: true}))
    }

    static create(
        connectedElement: ConnectedElement
    ): ConnectedAnagramInputOverlayElement {
        const textContainer = connectedElement.shadowRoot.querySelector('span') as HTMLElement;
        return new ConnectedAnagramInputOverlayElement(
            textContainer,
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