export interface AsyncFnCall<TArgs extends unknown[], TReturn> {
    args: TArgs
    resolve(value: TReturn): void
    reject(reason: unknown): void
}

export interface AsyncFn<TArgs extends unknown[], TReturn> {
    (...args: TArgs): Promise<TReturn>
    resolveCall(predicate: (...args: TArgs) => boolean, value: TReturn): Promise<void>
    resolveAllCalls(fn: (...args: TArgs) => TReturn | PromiseLike<TReturn>): void
}

interface CallExpectation<TArgs extends unknown[], TReturn> {
    predicate: (...args: TArgs) => boolean
    resolve(call: AsyncFnCall<TArgs, TReturn>): void
}

export function asyncFn<TArgs extends unknown[], TReturn>(): AsyncFn<TArgs, TReturn> {
    const calls: AsyncFnCall<TArgs, TReturn>[] = []
    const expectations: CallExpectation<TArgs, TReturn>[] = [];
    const result: AsyncFn<TArgs, TReturn> = ((...args: TArgs): Promise<TReturn> => {
        const { resolve, reject, promise } = Promise.withResolvers<TReturn>();
        handleCall({ args, resolve, reject });
        return promise;
    }) as AsyncFn<TArgs, TReturn>;
    let allCallsResolver: ((...args: TArgs) => TReturn | PromiseLike<TReturn>) | undefined;
    result.resolveCall = resolveCall;
    result.resolveAllCalls = resolveAllCalls;
    return result;

    function findCall(predicate: (...args: TArgs) => boolean): AsyncFnCall<TArgs, TReturn> | undefined {
        const index = calls.findIndex(c => predicate(...c.args));
        if(index === -1){
            return undefined;
        }
        const [result] = calls.splice(index, 1);
        return result;
    }

    function resolveAllCalls(fn?: (...args: TArgs) => TReturn | PromiseLike<TReturn>): void {
        allCallsResolver = fn;
    }

    function waitForCall(predicate: (...args: TArgs) => boolean): Promise<AsyncFnCall<TArgs, TReturn>> {
        const existingCall = findCall(predicate);
        if(existingCall){
            return Promise.resolve(existingCall);
        }
        const { resolve, promise } = Promise.withResolvers<AsyncFnCall<TArgs, TReturn>>();
        expectations.push({
            predicate,
            resolve
        })
        return promise;
    }

    async function resolveCall(predicate: (...args: TArgs) => boolean, value: TReturn): Promise<void> {
        const call = await waitForCall(predicate);
        call.resolve(value);
    }

    async function handleUnexpectedCall(call: AsyncFnCall<TArgs, TReturn>): Promise<void> {
        if(!allCallsResolver){
            calls.push(call);
            return;
        }
        call.resolve(await allCallsResolver(...call.args))
    }

    function handleCall(call: AsyncFnCall<TArgs, TReturn>): void {
        const expectationIndex = expectations.findIndex(e => e.predicate(...call.args));
        if(expectationIndex === -1){
            handleUnexpectedCall(call);
            return;
        }
        const [{ resolve }] = expectations.splice(expectationIndex, 1);
        resolve(call);
    }
}