export function waitMs(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
}

export function debounceWithAbort(fn: (abortSignal: AbortSignal) => unknown, interval: number): () => void {
    let abortController: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return () => {
        if(timeout !== undefined){
            clearTimeout(timeout);
        }
        timeout = setTimeout(execute, interval);
    }
    function execute(): void {
        if(abortController){
            abortController.abort();
        }
        abortController = new AbortController();
        fn(abortController.signal);
    }
}

export function waitForAnimationFrameWhen<T>(
    calculate: () => T,
    predicate: (v: T) => boolean,
    maxRetries: number,
    abortSignal?: AbortSignal
): Promise<T> {
    return new Promise<T>((res) => {
        let triesLeft = maxRetries;
        let requestedAnimationFrame: number | undefined;
        abortSignal?.addEventListener('abort', () => {
            if(requestedAnimationFrame !== undefined){
                cancelAnimationFrame(requestedAnimationFrame);
            }
        })
        check();
        function check(): void {
            const value = calculate();
            if(predicate(value)){
                res(value);
                return;
            }
            triesLeft--;
            if(triesLeft === 0 || abortSignal?.aborted){
                res(value);
                return;
            }
            requestedAnimationFrame = requestAnimationFrame(check);
        }
    })
}

export function throttle(fn: (abortSignal?: AbortSignal) => Promise<void>, interval: number): (abortSignal?: AbortSignal) => void {
    let busy = false;
    let scheduled = false;
    let latestAbortSignal: AbortSignal | undefined
    return (abortSignal?: AbortSignal) => {
        latestAbortSignal = abortSignal;
        execute();
    };
    async function execute(): Promise<void> {
        if(busy){
            scheduled = true;
            return;
        }
        if(latestAbortSignal?.aborted){
            latestAbortSignal = undefined;
            return;
        }
        scheduled = false;
        busy = true;
        await Promise.all([
            fn(latestAbortSignal),
            waitMs(interval)
        ])
        busy = false;
        if(scheduled){
            execute();
        }
    }
}

export interface QueuedLock {
    release(): void
}
export interface QueuedLockManager {
    acquire(abortSignal?: AbortSignal): Promise<QueuedLock>
}

interface QueuedLockRequest {
    resolve(lock: QueuedLock): void
}
export function createQueuedLockManager(): QueuedLockManager {
    let acquired = false;
    const requests: QueuedLockRequest[] = [];
    return { acquire }
    function acquire(abortSignal?: AbortSignal): Promise<QueuedLock> {
        const { promise, resolve } = Promise.withResolvers<QueuedLock>();
        const request: QueuedLockRequest = { resolve };
        requests.unshift(request);
        abortSignal?.addEventListener('abort', () => abortRequest(request));
        release();
        return promise;
    }
    function abortRequest(request: QueuedLockRequest): void {
        const index = requests.indexOf(request);
        if(index === -1){
            return;
        }
        requests.splice(index, 1);
    }
    function release(): void {
        if(acquired){
            return;
        }
        const request = requests.pop();
        if(!request){
            return;
        }
        acquired = true;
        let released = false;
        request.resolve({ release: releaseAcquired })
        function releaseAcquired(): void {
            if(released){
                return;
            }
            acquired = false;
            released = true;
            release();
        }
    }
}

export interface EventTargetWithMap<TTarget, TMap> {
    addEventListener<TKey extends keyof TMap>(key: TKey, listener: (this: TTarget, e: TMap[TKey]) => void, options?: boolean | AddEventListenerOptions): void
    removeEventListener<TKey extends keyof TMap>(key: TKey, listener: (this: TTarget, e: TMap[TKey]) => void, options?: boolean | AddEventListenerOptions): void
}

type TargetType<TTarget extends EventTargetWithMap<TTarget, unknown>> = Pick<TTarget, 'addEventListener'>

class RegisteredListener<TKey extends keyof TMap, TTarget extends EventTargetWithMap<TTarget, TMap>, TMap> {
    constructor(
        private readonly target: TTarget,
        private readonly key: TKey,
        private readonly listener: (this: TTarget, e: TMap[TKey]) => void,
        private readonly options?: boolean | AddEventListenerOptions
    ){}
    static create<TKey extends keyof TMap, TTarget extends EventTargetWithMap<TTarget, TMap>, TMap>(
        target: TTarget,
        key: TKey,
        listener: (this: TTarget, e: TMap[TKey]) => void,
        options?: boolean | AddEventListenerOptions
    ): RegisteredListener<TKey, TTarget, TMap> {
        target.addEventListener(key, listener, options);
        return new RegisteredListener(target, key, listener, options)
    }

    destroy(): void {
        this.target.removeEventListener(this.key, this.listener, this.options);
    }
}

export class RegisteredListeners {
    private readonly listeners: {destroy(): void}[] = []

    target<TTarget extends EventTargetWithMap<TTarget, unknown>>(target: TTarget): TargetType<TTarget> {
        return {
            addEventListener: (key, listener, options) => {
                this.listeners.push(RegisteredListener.create(target, key, listener, options))
            }
        }
    }

    destroy(): void {
        for(const listener of this.listeners) {
            listener.destroy();
        }
        this.listeners.splice(0, this.listeners.length);
    }
}

export interface ConnectedElement {
    shadowRoot: ShadowRoot
    dispatchEvent(e: Event): void
    listeners: RegisteredListeners
}

export class CustomElement<
    TConnected = {},
    TEventMap extends HTMLElementEventMap = HTMLElementEventMap
> extends HTMLElement {
    protected connected: TConnected | undefined
    private listeners: RegisteredListeners | undefined

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
            listeners
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


