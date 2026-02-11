import { CustomElement, type ConnectedElement } from "./html-utils";

export interface AnagramInputElementEventMap extends HTMLElementEventMap {
    'elementdragstart': CustomEvent
    'elementremoved': CustomEvent
    'elementdragend': CustomEvent
    'elementvaluechanged': CustomEvent
}
class ConnectedAnagramInputElement {
    constructor(
        private readonly container: HTMLElement,
        private readonly textContainer: HTMLElement,
        private readonly connectedElement: ConnectedElement
    ){
        connectedElement.listeners.target(container).addEventListener('dragstart', (e) => this.handleDragStart(e));
        connectedElement.listeners.target(container).addEventListener('dragend', (e) => this.handleDragEnd(e));
    }
    private _value: string | undefined;
    get value(): string {
        return this._value || ''
    }
    set value(value: string) {
        this._value = value;
        this.textContainer.textContent = value;
        this.determineLongerValueState(value);
    }
    
    displayAddedValuePreview(addedValue: string): void {
        const previewValue = `${this._value}${addedValue}`;
        this.textContainer.textContent = previewValue;
        this.determineLongerValueState(previewValue);
    }
    hideAddedValuePreview(): void {
        this.value = this._value || '';
    }
    private determineLongerValueState(value: string | undefined): void {
        const length = value === undefined ? 0 : value.length;
        if(length > 1){
            this.container.classList.add('longer-value')
        }else{
            this.container.classList.remove('longer-value')
        }
    }
    private handleDragStart(e: DragEvent): void {
        e.stopPropagation();
        const dataTransfer = e.dataTransfer;
        if(!dataTransfer) {
            return;
        }
        dataTransfer.items.add('', 'anagram/element');
        dataTransfer.setDragImage(this.createDragImage(25), 0, 10)
        this.container.classList.add('dragged')
        this.connectedElement.dispatchEvent(new CustomEvent('elementdragstart', { bubbles: true, composed: true }))
    }
    private handleDragEnd(e: DragEvent): void {
        this.container.classList.remove('dragged')
        this.connectedElement.dispatchEvent(new CustomEvent('elementdragend', { bubbles: true, composed: true }))
    }
    private createDragImage(fontSize: number): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        const text = this._value;
        if(!text){
            return canvas;
        }
        const size = fontSize * devicePixelRatio;
        canvas.height = size;
        canvas.width = size * text.length;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.font = `${size}px "Courier New", Courier, monospace`
        ctx.fillText(text, 0, size * 0.9)
        return canvas;
    }

    static create(
        connected: ConnectedElement
    ): ConnectedAnagramInputElement {
        const container = connected.shadowRoot.getElementById('container') as HTMLElement;
        const textContainer = connected.shadowRoot.getElementById('text-container') as HTMLElement;
        return new ConnectedAnagramInputElement(
            container,
            textContainer,
            connected
        );
    }
}

export class AnagramInputElement extends CustomElement<ConnectedAnagramInputElement, AnagramInputElementEventMap> {
    private _value: string | undefined

    get value(): string {
        if(!this.connected){
            return this._value || '';
        }
        return this.connected.value;
    }
    set value(value: string) {
        if(this.connected){
            this.connected.value = value;
        }
        this._value = value;
    }

    protected createConnected(connected: ConnectedElement): ConnectedAnagramInputElement {
        const result = ConnectedAnagramInputElement.create(connected);
        if(this._value) {
            result.value = this._value;
        }
        return result;
    }

    protected createContent(): Node | undefined {
        const templateEl = document.getElementById('anagram-input-element-template') as HTMLTemplateElement;
        return templateEl.content.cloneNode(true);
    }

    displayAddedValuePreview(addedValue: string): void {
        if(!this.connected){
            return;
        }
        this.connected.displayAddedValuePreview(addedValue);
    }
    hideAddedValuePreview(): void {
        if(!this.connected){
            return;
        }
        this.connected.hideAddedValuePreview();
    }
}

customElements.define('anagram-input-element', AnagramInputElement);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input-element': AnagramInputElement
    }
}