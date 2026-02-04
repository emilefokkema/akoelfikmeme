import { RegisteredListeners } from "./utils";

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
    private listeners: RegisteredListeners = new RegisteredListeners();
    constructor(
        private readonly container: HTMLElement,
        private readonly dispatchEvent: (e: Event) => void
    ){
        this.listeners.target(container).addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.listeners.target(container).addEventListener('dragend', (e) => this.handleDragEnd(e));
    }
    private _value: string | undefined;
    public get value(): string {
        return this._value || ''
    }
    public set value(value: string) {
        this._value = value;
        this.container.textContent = value;
    }
    public removeCharacter(): void {
        if(this.value.length === 1){
            this.dispatchEvent(new CustomEvent('elementremoved', { bubbles: true, composed: true}))
            return;
        }
        this.value = this.value.slice(0, this.value.length - 1)
    }
    private handleDragStart(e: DragEvent): void {
        e.stopPropagation();
        const dataTransfer = e.dataTransfer;
        if(!dataTransfer) {
            return;
        }
        dataTransfer.items.add('', 'anagram/element');
        this.dispatchEvent(new CustomEvent('elementdragstart', { bubbles: true, composed: true }))
    }
    private handleDragEnd(e: DragEvent): void {
        this.dispatchEvent(new CustomEvent('elementdragend', { bubbles: true, composed: true }))
    }
    destroy(): void {
        this.listeners.destroy();
    }
    static create(
        shadow: ShadowRoot,
        dispatchEvent: (e: Event) => void
    ): ConnectedAnagramInputElement {
        const container = shadow.querySelector('div') as HTMLElement;
        return new ConnectedAnagramInputElement(
            container,
            dispatchEvent
        );
    }
}

export class AnagramInputElement extends HTMLElement {
    private connected: ConnectedAnagramInputElement | undefined
    private _value: string | undefined

    public get value(): string {
        if(!this.connected){
            return this._value || '';
        }
        return this.connected.value;
    }
    public set value(value: string) {
        if(!this.connected){
            this._value = value;
            return;
        }
        this.connected.value = value;
    }
    public removeCharacter(): void {
        if(!this.connected){
            return;
        }
        this.connected.removeCharacter();
    }
    addEventListener<K extends keyof AnagramInputElementEventMap>(type: K, listener: (this: HTMLElement, ev: AnagramInputElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.addEventListener(type, listener as (ev: Event) => void, options);
    }
    removeEventListener<K extends keyof AnagramInputElementEventMap>(type: K, listener: (this: HTMLElement, ev: AnagramInputElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.removeEventListener(type, listener as (ev: Event) => void, options);
    }
    protected connectedCallback(){
        const templateEl = document.getElementById('anagram-input-element-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);

        const connected = ConnectedAnagramInputElement.create(
            shadow,
            (e) => this.dispatchEvent(e)
        );
        this.connected = connected;
        if(this._value) {
            connected.value = this._value;
        }
    }

    protected disconnectedCallback() {
        if(this.connected){
            this.connected.destroy();
            this.connected = undefined;
        }
    }
}

customElements.define('anagram-input-element', AnagramInputElement);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input-element': AnagramInputElement
    }
}