export interface LatestOperation<Retry> {
    begin(): number;
    beginTransition(): number | undefined;
    capture<Value>(operation: number, value: Promise<Value>): Promise<Value | undefined>;
    endTransition(): void;
    isCurrent(operation: number): boolean;
    isTransitioning(): boolean;
    retry(): Retry | null;
    settle(operation: number, retry: Retry | null): boolean;
}

export const createLatestOperation = <Retry>(): LatestOperation<Retry> => {
    let current = 0;
    let retry: Retry | null = null;
    let transitioning = false;

    const begin = (): number => {
        current += 1;
        retry = null;
        return current;
    };

    return {
        begin,
        beginTransition: () => {
            if (transitioning) return undefined;
            transitioning = true;
            return begin();
        },
        capture: async (operation, value) => {
            const resolved = await value;
            return operation === current ? resolved : undefined;
        },
        endTransition: () => {
            transitioning = false;
        },
        isCurrent: (operation) => operation === current,
        isTransitioning: () => transitioning,
        retry: () => retry,
        settle: (operation, nextRetry) => {
            if (operation !== current) return false;
            retry = nextRetry;
            return true;
        },
    };
};
