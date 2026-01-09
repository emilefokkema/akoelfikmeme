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