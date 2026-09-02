interface RuntimeCoordinatorOptions<Runtime> {
    create: () => Promise<Runtime>;
    close: (runtime: Runtime) => Promise<void>;
    remove: (runtime: Runtime) => Promise<void>;
}

export class RuntimeCoordinator<Runtime> {
    private current: Promise<Runtime> | null = null;
    private operationTail: Promise<void> = Promise.resolve();

    constructor(private readonly options: RuntimeCoordinatorOptions<Runtime>) {}

    get(): Promise<Runtime> {
        return this.enqueue(() => this.currentRuntime());
    }

    reopen(): Promise<Runtime> {
        return this.enqueue(async () => {
            const current = await this.takeCurrent();
            if (current !== null) await this.options.close(current);
            return this.start();
        });
    }

    reset(): Promise<Runtime> {
        return this.enqueue(async () => {
            const current = await this.currentRuntime();
            this.current = null;
            await this.options.close(current);
            await this.options.remove(current);
            return this.start();
        });
    }

    private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
        const result = this.operationTail.then(operation, operation);
        this.operationTail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    private currentRuntime(): Promise<Runtime> {
        return this.current ?? this.start();
    }

    private start(): Promise<Runtime> {
        const pending = this.options.create();
        this.current = pending;
        void pending.catch(() => {
            if (this.current === pending) this.current = null;
        });
        return pending;
    }

    private async takeCurrent(): Promise<Runtime | null> {
        const pending = this.current;
        this.current = null;
        return pending?.catch(() => null) ?? null;
    }
}
