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