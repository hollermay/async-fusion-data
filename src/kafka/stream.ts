import { Message } from '../types';

export interface StreamOptions {
    windowSize?: number;      // Window size in milliseconds
    slideInterval?: number;   // Slide interval for windowed operations
    watermarkDelay?: number;  // Watermark delay for late data
}

export class KafkaStream<T = any> {
    private operations: Array<(data: any) => any> = [];
    private windowDuration: number = 0;
    private slideInterval: number = 0;
    private watermarkDelay: number = 0;
    private windowData: Map<string, { data: any[], timestamp: number }> = new Map();
    private aggregates: Map<string, any> = new Map();
    private stateStore: Map<string, any> = new Map();

    constructor(private sourceTopic: string, options?: StreamOptions) {
        if (options) {
            this.windowDuration = options.windowSize || 0;
            this.slideInterval = options.slideInterval || 0;
            this.watermarkDelay = options.watermarkDelay || 0;
        }
    }

    // Filter records
    filter(predicate: (data: T) => boolean): this {
        this.operations.push((data: T) => predicate(data) ? data : null);
        return this;
    }

    // Map transformation
    map<U>(transform: (data: T) => U): KafkaStream<U> {
        const newStream = new KafkaStream<U>(this.sourceTopic);
        newStream.operations = [...this.operations, (data: T) => transform(data)];
        newStream.windowDuration = this.windowDuration;
        newStream.slideInterval = this.slideInterval;
        newStream.watermarkDelay = this.watermarkDelay;
        return newStream;
    }

    // FlatMap - one to many
    flatMap<U>(transform: (data: T) => U[]): KafkaStream<U> {
        const newStream = new KafkaStream<U>(this.sourceTopic);
        newStream.operations = [...this.operations, (data: T) => transform(data)];
        return newStream;
    }

    // Windowed operations
    window(sizeMs: number, slideMs?: number): this {
        this.windowDuration = sizeMs;
        this.slideInterval = slideMs || sizeMs;
        return this;
    }

    // Group by key
    groupBy(keyExtractor: (data: T) => string): GroupedStream<T> {
        return new GroupedStream<T>(this, keyExtractor);
    }

    // Aggregate with state
    aggregate<U>(
        aggregator: (acc: U | undefined, curr: T) => U,
        initialValue?: U
    ): KafkaStream<U> {
        const newStream = new KafkaStream<U>(this.sourceTopic);
        
        const aggregateOperation = (data: T) => {
            const key = JSON.stringify(data);
            let current = this.aggregates.get(key);
            
            if (current === undefined && initialValue !== undefined) {
                current = initialValue;
            }
            
            const result = aggregator(current, data);
            this.aggregates.set(key, result);
            return result;
        };
        
        newStream.operations = [...this.operations, aggregateOperation];
        return newStream;
    }

    // Join two streams
    join<U>(otherStream: KafkaStream<U>, joinKey: (data: T) => string): KafkaStream<{ left: T, right: U }> {
        const joinedStream = new KafkaStream<{ left: T, right: U }>(this.sourceTopic);
        
        const joinOperation = (data: T) => {
            const key = joinKey(data);
            // This would need actual stream joining logic
            return { left: data, right: null as any };
        };
        
        joinedStream.operations = [...this.operations, joinOperation];
        return joinedStream;
    }

    // Process each record with side effects
    foreach(callback: (data: T) => void): this {
        this.operations.push((data: T) => {
            callback(data);
            return data;
        });
        return this;
    }

    // Error handling for stream
    onError(errorHandler: (error: Error, data: any) => void): this {
        const errorOp = (data: any) => {
            try {
                return data;
            } catch (error) {
                errorHandler(error as Error, data);
                return null;
            }
        };
        this.operations.push(errorOp);
        return this;
    }

    // Process message through the stream pipeline
    async process(message: Message<T>): Promise<any> {
        let result: any = message.value;
        
        for (const op of this.operations) {
            if (result === null || result === undefined) break;
            
            try {
                if (Array.isArray(result)) {
                    result = result.flatMap(item => op(item)).filter(Boolean);
                } else {
                    result = op(result);
                }
            } catch (error) {
                console.error(`Stream processing error:`, error);
                result = null;
            }
        }
        
        return result;
    }

    // Get current state
    getState(): Map<string, any> {
        return new Map(this.stateStore);
    }

    // Reset stream state
    reset(): void {
        this.aggregates.clear();
        this.windowData.clear();
        this.stateStore.clear();
    }
}

export class GroupedStream<T> {
    private groups: Map<string, any[]> = new Map();

    constructor(
        private stream: KafkaStream<T>,
        private keyExtractor: (data: T) => string
    ) {}

    // Reduce within groups
    reduce<U>(
        reducer: (acc: U, curr: T) => U,
        initialValue: U
    ): KafkaStream<U> {
        const newStream = new KafkaStream<U>(this.stream['sourceTopic']);
        
        const reduceOperation = async (data: T) => {
            const key = this.keyExtractor(data);
            let group = this.groups.get(key);
            
            if (!group) {
                group = [initialValue];
                this.groups.set(key, group);
            }
            
            group[0] = reducer(group[0] as U, data);
            return group[0];
        };
        
        newStream['operations'] = [...this.stream['operations'], reduceOperation];
        return newStream;
    }

    // Count within groups
    count(): KafkaStream<{ key: string, count: number }> {
        const newStream = new KafkaStream<{ key: string, count: number }>(this.stream['sourceTopic']);
        
        const countOperation = (data: T) => {
            const key = this.keyExtractor(data);
            let count = this.groups.get(key)?.length || 0;
            this.groups.set(key, [...(this.groups.get(key) || []), data]);
            return { key, count: count + 1 };
        };
        
        newStream['operations'] = [...this.stream['operations'], countOperation];
        return newStream;
    }

    // Sum within groups
    sum(valueExtractor: (data: T) => number): KafkaStream<{ key: string, sum: number }> {
        const newStream = new KafkaStream<{ key: string, sum: number }>(this.stream['sourceTopic']);
        
        const sumOperation = (data: T) => {
            const key = this.keyExtractor(data);
            const value = valueExtractor(data);
            let current = this.groups.get(key)?.[0] as number || 0;
            this.groups.set(key, [current + value]);
            return { key, sum: current + value };
        };
        
        newStream['operations'] = [...this.stream['operations'], sumOperation];
        return newStream;
    }

    // Average within groups
    avg(valueExtractor: (data: T) => number): KafkaStream<{ key: string, avg: number }> {
        const newStream = new KafkaStream<{ key: string, avg: number }>(this.stream['sourceTopic']);
        
        const avgOperation = (data: T) => {
            const key = this.keyExtractor(data);
            const value = valueExtractor(data);
            let group = this.groups.get(key) || [];
            group.push(value);
            this.groups.set(key, group);
            const sum = group.reduce((a, b) => a + b, 0);
            return { key, avg: sum / group.length };
        };
        
        newStream['operations'] = [...this.stream['operations'], avgOperation];
        return newStream;
    }
}
