export class RetryableError extends Error {
    constructor(message: string, public readonly retryable: boolean = true) {
        super(message);
        this.name = 'RetryableError';
    }
}

export class FatalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FatalError';
    }
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        delayMs?: number;
        backoffMultiplier?: number;
        shouldRetry?: (error: Error) => boolean;
    } = {}
): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const delayMs = options.delayMs || 1000;
    const backoffMultiplier = options.backoffMultiplier || 2;
    const shouldRetry = options.shouldRetry || ((error) => error instanceof RetryableError);
    
    let lastError: Error;
    let currentDelay = delayMs;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (!shouldRetry(error as Error) || attempt === maxRetries) {
                throw error;
            }
            
            console.warn(`Retry attempt ${attempt}/${maxRetries} after ${currentDelay}ms`);
            await sleep(currentDelay);
            currentDelay *= backoffMultiplier;
        }
    }
    
    throw lastError!;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private readonly failureThreshold: number = 5,
        private readonly timeoutMs: number = 60000
    ) {}
    
    async call<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime >= this.timeoutMs) {
                this.state = 'HALF_OPEN';
                console.log('🔌 Circuit breaker half-open, testing...');
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess(): void {
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.failures = 0;
            console.log('✅ Circuit breaker closed');
        }
        this.failures = 0;
    }
    
    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            console.error(`🔴 Circuit breaker opened after ${this.failures} failures`);
        }
    }
    
    getState(): string {
        return this.state;
    }
}
