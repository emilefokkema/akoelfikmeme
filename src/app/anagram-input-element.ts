import { CustomElement, type ConnectedElement } from "./html-utils";

export interface ElementDragStartEvent extends CustomEvent {

}

export interface ElementDragEndEvent extends CustomEvent {

}

export interface ElementDragOverEvent extends CustomEvent {

}

export interface ElementRemovedEvent extends CustomEvent {

}

export interface AnagramInputElementEventMap extends HTMLElementEventMap {
    'elementdragstart': ElementDragStartEvent
    'elementremoved': ElementRemovedEvent
    'elementdragend': ElementDragEndEvent
}
class ConnectedAnagramInputElement {
    constructor(
        private readonly container: HTMLElement,
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
        this.container.textContent = value;
        this.determineLongerValueState(value);
    }
    
    removeCharacter(): void {
        if(this.value.length === 1){
            this.connectedElement.dispatchEvent(new CustomEvent('elementremoved', { bubbles: true, composed: true}))
            return;
        }
        this.value = this.value.slice(0, this.value.length - 1);
    }
    displayAddedValuePreview(addedValue: string): void {
        const previewValue = `${this._value}${addedValue}`;
        this.container.textContent = previewValue;
        this.determineLongerValueState(previewValue);
    }
    hideAddedValuePreview(): void {
        this.value = this._value || '';
    }
    private determineLongerValueState(value: string | undefined): void {
        const length = value === undefined ? 0 : value.length;
        if(length > 1){
            this.connectedElement.internals.states.add('longer-value');
        }else{
            this.connectedElement.internals.states.delete('longer-value');
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
        const container = connected.shadowRoot.querySelector('div') as HTMLElement;
        return new ConnectedAnagramInputElement(
            container,
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
        if(!this.connected){
            this._value = value;
            return;
        }
        this.connected.value = value;
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
    removeCharacter(): void {
        if(!this.connected){
            return;
        }
        this.connected.removeCharacter();
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