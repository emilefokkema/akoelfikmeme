import { RegisteredListeners } from "./utils";

class ConnectedAnagramInputDropLocation {
    draggedValue: string | undefined
    constructor(
        private readonly container: HTMLElement,
        private readonly dispatchEvent: (ev: Event) => void,
        listeners: RegisteredListeners
    ){
        listeners.target(container).addEventListener('dragenter', (e) => this.handleDragEnterContainer(e));
        listeners.target(container).addEventListener('dragleave', (e) => this.handleDragLeaveContainer(e))
    }

    private handleDragEnterContainer(e: DragEvent): void {
        //e.stopPropagation();
        const dataTransfer = e.dataTransfer;
        if(!dataTransfer || !dataTransfer.types.includes('anagram/element')) {
            return;
        }
        dataTransfer.dropEffect = 'move';
        this.dispatchEvent(new CustomEvent('elementdragenter', { bubbles: true, composed: true }));
        if(this.draggedValue !== undefined) {
            this.container.textContent = this.draggedValue;
            this.container.style.width = 'unset'
        }
    }

    hideDraggedValue(): void {
        this.container.textContent = '';
        this.container.style.width = '.2em'
    }

    private handleDragLeaveContainer(e: DragEvent): void {
        if(e.target !== this.container){
            return;
        }
        this.hideDraggedValue();
    }

    static create(
        shadowRoot: ShadowRoot,
        dispatchEvent: (ev: Event) => void,
        listeners: RegisteredListeners
    ): ConnectedAnagramInputDropLocation {
        const container = shadowRoot.querySelector('div') as HTMLElement;
        return new ConnectedAnagramInputDropLocation(
            container,
            dispatchEvent,
            listeners
        )
    }
}

export class AnagramInputDropLocation extends HTMLElement {
    private connected: ConnectedAnagramInputDropLocation | undefined;
    private listeners: RegisteredListeners | undefined;
    private _draggedValue: string | undefined

    public get draggedValue(): string | undefined {
        if(this.connected){
            return this.connected.draggedValue;
        }
        return this._draggedValue;
    }
    public set draggedValue(value: string | undefined){
        if(this.connected){
            this.connected.draggedValue = value;
            return;
        }
        this._draggedValue = value;
    }

    hideDraggedValue(): void {
        if(!this.connected){
            return;
        }
        this.connected.hideDraggedValue();
    }

    protected connectedCallback(): void {
        let shadowRoot = this.shadowRoot;
        if(!shadowRoot){
            const templateEl = document.getElementById('anagram-input-drop-location-template') as HTMLTemplateElement;
            const content = templateEl.content.cloneNode(true);
            shadowRoot = this.attachShadow({mode: 'open'});
            shadowRoot.appendChild(content);
        }
        const listeners = new RegisteredListeners();
        this.connected = ConnectedAnagramInputDropLocation.create(
            shadowRoot,
            (e) => this.dispatchEvent(e),
            listeners
        );
        this.connected.draggedValue = this._draggedValue;
        this.listeners = listeners;
    }

    protected disconnectedCallback(): void {
        if(this.listeners){
            this.listeners.destroy();
            this.listeners = undefined;
        }
        this.connected = undefined;
    }
}

customElements.define('anagram-input-drop-location', AnagramInputDropLocation);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input-drop-location': AnagramInputDropLocation
    }
}