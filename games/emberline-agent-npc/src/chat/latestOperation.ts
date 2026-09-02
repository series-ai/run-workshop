export interface LatestOperation<Retry> {
    begin(): number;
    beginTransition(): number;
    capture<Value>(operation: number, value: Promise<Value>): Promise<Value | undefined>;
    endTransition(operation: number): void;
    isCurrent(operation: number): boolean;
    isTransitioning(): boolean;
    retry(): Retry | null;
    settle(operation: number, retry: Retry | null): boolean;
}

export const createLatestOperation = <Retry>(): LatestOperation<Retry> => {
    let current = 0;
    let retry: Retry | null = null;
    const transitions = new Set<number>();

    const begin = (): number => {
        current += 1;
        retry = null;
        return current;
    };

    return {
        begin,
        beginTransition: () => {
            const operation = begin();
            transitions.add(operation);
            return operation;
        },
        capture: async (operation, value) => {
            const resolved = await value;
            return operation === current ? resolved : undefined;
        },
        endTransition: (operation) => {
            transitions.delete(operation);
        },
        isCurrent: (operation) => operation === current,
        isTransitioning: () => transitions.size > 0,
        retry: () => retry,
        settle: (operation, nextRetry) => {
            if (operation !== current) return false;
            retry = nextRetry;
            return true;
        },
    };
};
