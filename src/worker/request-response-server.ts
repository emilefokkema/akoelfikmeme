interface MethodAndPayload {
    method: string
    payload: unknown
}

function hasMethodAndPayload(request: unknown): request is MethodAndPayload {
    const cast = request as MethodAndPayload;
    return !!cast && typeof cast.method === 'string' && 'payload' in cast
}

export function createRequestResonseServer(handler: {}): (request: unknown) => unknown {
    return (request: unknown) => {
        if(!hasMethodAndPayload(request)){
            return;
        }
        if(typeof (handler as {[key: string]: unknown})[request.method] !== 'function'){
            return;
        }
        return ((handler as {[key: string]: unknown})[request.method] as (...args: unknown[]) => unknown)(request.payload);
    }
}