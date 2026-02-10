import { RegisteredListeners } from "./utils";

export interface ConnectedElement {
    shadowRoot: ShadowRoot
    dispatchEvent(e: Event): void
    listeners: RegisteredListeners
    internals: ElementInternals
}

export class CustomElement<
    TConnected = {},
    TEventMap extends HTMLElementEventMap = HTMLElementEventMap
> extends HTMLElement {
    protected connected: TConnected | undefined
    private listeners: RegisteredListeners | undefined
    private internals: ElementInternals

    constructor(){
        super();
        this.internals = this.attachInternals();
    }
    protected createConnected(connected: ConnectedElement): TConnected {
        return {} as TConnected
    }
    protected createContent(): Node | undefined {
        return undefined;
    }
    protected connectedCallback() {
        let shadowRoot = this.shadowRoot;
        if(!shadowRoot) {
            shadowRoot = this.attachShadow({mode: 'open'});
            const content = this.createContent();
            if(content){
                shadowRoot.appendChild(content);
            }
        }
        const listeners = new RegisteredListeners();
        const connected = this.createConnected({
            dispatchEvent: (e) => this.dispatchEvent(e),
            shadowRoot,
            listeners,
            internals: this.internals
        });
        this.connected = connected;
        this.listeners = listeners;
    }

    protected disconnectedCallback() {
        if(this.listeners) {
            this.listeners.destroy();
            this.listeners = undefined;
        }
        this.connected = undefined;
    }

    addEventListener<K extends keyof TEventMap>(type: K, listener: (this: HTMLElement, ev: TEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.addEventListener(type as string, listener as (ev: Event) => void, options);
    }
    removeEventListener<K extends keyof TEventMap>(type: K, listener: (this: HTMLElement, ev: TEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void{
        super.removeEventListener(type as string, listener as (ev: Event) => void, options);
    }
}