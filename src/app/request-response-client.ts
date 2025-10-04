import type { WorkerRequests } from "./worker-requests";

type Promised<T> = T extends PromiseLike<unknown> ? T : Promise<T>

type MethodType<TClientProperty> = (
    request: TClientProperty extends (r: infer R, ...args: infer _) => unknown ? R : never,
    abortSignal: AbortSignal
) => TClientProperty extends (...args: infer _) => infer R ? Promised<R> : never

type RequestResponseClient<TClient> = {
    [type in keyof TClient]: MethodType<TClient[type]>
}

type MapKeys<TMap> = {
    [key in keyof TMap]: {}
}

export function createRequestResponseClient<TClient>(requests: WorkerRequests, keys: MapKeys<TClient>): RequestResponseClient<TClient> {
    const result: Partial<RequestResponseClient<TClient>> = {};
    for(const methodName in keys){
        // @ts-ignore
        result[methodName] = (req, abortSignal) => requests.send({method: methodName, payload: req}, abortSignal)
    }
    return result as RequestResponseClient<TClient>;
}