export interface LatestOperation<Retry> {
    begin(): number;
    isCurrent(operation: number): boolean;
    retry(): Retry | null;
    settle(operation: number, retry: Retry | null): boolean;
}

export const createLatestOperation = <Retry>(): LatestOperation<Retry> => {
    let current = 0;
    let retry: Retry | null = null;

    return {
        begin: () => {
            current += 1;
            retry = null;
            return current;
        },
        isCurrent: (operation) => operation === current,
        retry: () => retry,
        settle: (operation, nextRetry) => {
            if (operation !== current) return false;
            retry = nextRetry;
            return true;
        },
    };
};
