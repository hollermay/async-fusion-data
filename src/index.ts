// Built by Udayan Sharma

export const version = '1.0.0';

export const library = {
    name: '@async-fusion/data',
    version,
    author: 'Udayan Sharma',
    license: 'MIT',
    repository: 'https://github.com/hollermay/async-fusion-data'
};

export function getLibraryInfo() {
    return {
        name: library.name,
        version: library.version,
        author: library.author,
        description: 'Unified data streaming library for Kafka and Spark',
        features: [
            'Kafka Producer/Consumer with backpressure',
            'Spark job submission and monitoring',
            'Unified pipeline builder',
            'React hooks for real-time data',
            'TypeScript first',
            'Built-in monitoring and metrics',
            'Stream processing with windowing',
            'Error handling and retries',
            'Circuit breaker pattern'
        ],
        license: library.license,
        repository: library.repository
    };
}

export function hello(): string {
    return `Hello from @async-fusion/data! Built with lots of Love! (errors and fixes :P) by ${library.author}`;
}

// Kafka exports
export { Producer } from './kafka/producer';
export { Consumer } from './kafka/consumer';
export { KafkaStream, GroupedStream } from './kafka/stream';

// Spark exports
export { SparkClient } from './spark/client';
export { SparkStreaming } from './spark/streaming';
export { SparkSQL } from './spark/sql';

// Pipeline exports
export { PipelineBuilder } from './pipeline/builder';
export { PipelineMonitor } from './pipeline/monitoring';

// Utils
export { withRetry, sleep, CircuitBreaker, RetryableError, FatalError } from './utils/error-handling';

// Types
export * from './types';