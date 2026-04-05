### A Unified Data Streaming Library for Kafka, Spark, and Modern Data Pipelines

Built with lots of bugs :P and love <3 by Udayan Sharma

**NPM Link**: [Click here](https://www.npmjs.com/package/@async-fusion/data)

[![npm version](https://img.shields.io/npm/v/@async-fusion/data.svg?style=flat-square)](https://www.npmjs.com/package/@async-fusion/data)
[![npm downloads](https://img.shields.io/npm/dm/@async-fusion/data.svg?style=flat-square)](https://www.npmjs.com/package/@async-fusion/data)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

[Documentation](https://github.com/hollermay/async-fusion-data) • 
[Report Bug](https://github.com/hollermay/async-fusion-data/issues) • 
[Request Feature](https://github.com/hollermay/async-fusion-data/issues) 

---

## Index

- [Why This Library?](#why-this-library)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Documentation](#api-documentation)
- [Real-World Examples](#real-world-examples)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

---

## Why This Library?

### The Problem

Building real-time data pipelines today requires juggling multiple technologies:

- Kafka for message streaming
- Spark for big data processing
- Custom code for error handling
- Manual monitoring for pipeline health
- Different APIs for each technology

### The Solution

@async-fusion/data provides a unified API that brings Kafka streaming, Spark processing, and production-grade error handling into a single, easy-to-use library.

```javascript
// One library use all
const { PipelineBuilder, KafkaStream, SparkClient } = require('@async-fusion/data');

// Build complex pipelines with simple code
const pipeline = new PipelineBuilder({ name: 'analytics' })
    .source('kafka', { topic: 'clickstream' })
    .transform(data => enrichData(data))
    .sink('spark', { job: 'analytics-job' });
```
## Architecture

<img width="6278" height="1557" alt="mermaid-diagram (3)" src="https://github.com/user-attachments/assets/b5f4bb4e-6a3a-4acd-8e24-f88c4db51830" />

## Features

| Category | Feature | Description | Status |
|----------|---------|-------------|--------|
| Streaming | Kafka Producer/Consumer | Full Kafka support with backpressure | ✅ |
| Streaming | Stream Windowing | Time-based windows (tumbling, sliding) | ✅ |
| Streaming | Stream Joins | Join multiple streams in real-time | ✅ |
| Streaming | Stateful Processing | Maintain state across stream events | ✅ |
| Processing | Spark Integration | Submit and monitor Spark jobs | ✅ |
| Processing | Spark SQL | Execute SQL queries on Spark | ✅ |
| Processing | Python Scripts | Run PySpark scripts from Node.js | ✅ |
| Pipeline | Fluent Builder | Chain operations naturally | ✅ |
| Pipeline | Multiple Sources/Sinks | Combine data from anywhere | ✅ |
| Pipeline | Transformation Pipeline | Apply transformations sequentially | ✅ |
| Reliability | Automatic Retries | Exponential backoff for failures | ✅ |
| Reliability | Circuit Breaker | Prevent cascading failures | ✅ |
| Reliability | Checkpointing | Resume from where you left off | ✅ |
| Reliability | Dead Letter Queue | Handle failed messages gracefully | ✅ |
| Monitoring | Built-in Metrics | Track pipeline performance | ✅ |
| Monitoring | Pipeline Lineage | Visualize data flow | ✅ |
| Monitoring | Health Checks | Monitor component status | ✅ |
| React | useKafkaTopic | Real-time Kafka data in React | 🚧 |
| React | useSparkQuery | Query Spark from React | 🚧 |
| React | useRealtimeData | Combined real-time data hook | 🚧 |

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn or pnpm

### Install from npm

```bash
# Using npm
npm install @async-fusion/data

# Using yarn
yarn add @async-fusion/data

# Using pnpm
pnpm add @async-fusion/data
```

### Optional Dependencies (for specific features)

```bash
# For Kafka features
npm install kafkajs

# For Spark features (requires Spark cluster)
# No additional Node packages needed

# For React hooks
npm install react react-dom
```

## Quick Start

### Example 1: Basic Pipeline

```javascript
const { PipelineBuilder } = require('@async-fusion/data');

// Create a pipeline that reads from Kafka, transforms data, and logs to console
const pipeline = new PipelineBuilder({ 
    name: 'user-activity-pipeline',
    checkpointLocation: './checkpoints'
});

pipeline
    .source('kafka', { 
        topic: 'user-activity', 
        brokers: ['localhost:9092'] 
    })
    .transform(data => {
        // Enrich data with processing timestamp
        return {
            ...data,
            processedAt: new Date().toISOString(),
            processedBy: 'async-fusion'
        };
    })
    .transform(data => {
        // Filter only high-value events
        return data.value > 100 ? data : null;
    })
    .sink('console', { format: 'pretty' });

// Run the pipeline
await pipeline.run();
```

### Example 2: Stream Processing with Windowing

```javascript
const { KafkaStream } = require('@async-fusion/data');

// Create a stream that calculates average order value per minute
const orderStream = new KafkaStream('orders', {
    windowSize: 60000,      // 1 minute windows
    slideInterval: 30000,   // Slide every 30 seconds
    watermarkDelay: 5000    // Allow 5 seconds for late data
});

const averageOrderValue = orderStream
    .filter(order => order.status === 'completed')
    .window(60000)  // Group into 1-minute windows
    .groupBy(order => order.productCategory)
    .avg(order => order.amount);

// Process the stream
for await (const avg of averageOrderValue) {
    console.log(`Average order value: $${avg}`);
}
```

### Example 3: Resilient Pipeline with Retries

```javascript
const { PipelineBuilder } = require('@async-fusion/data');

const robustPipeline = new PipelineBuilder(
    { name: 'robust-etl' },
    {
        retryConfig: {
            maxAttempts: 5,           // Try up to 5 times
            delayMs: 1000,            // Start with 1 second delay
            backoffMultiplier: 2      // Double delay each retry (1s, 2s, 4s, 8s)
        },
        errorHandler: (error, context) => {
            // Log errors to your monitoring system
            console.error(`Pipeline error in ${context.pipelineName}:`, error);
            
            // Send alert to Slack/PagerDuty
            sendAlert({
                severity: 'high',
                message: error.message,
                context
            });
        }
    }
);

robustPipeline
    .source('kafka', { topic: 'critical-data' })
    .transform(validateData)
    .transform(enrichWithDatabase)
    .sink('database', { table: 'processed_records' })
    .sink('kafka', { topic: 'enriched-data' });

await robustPipeline.run();
```

## Core Concepts

### 1. Pipeline Builder Pattern

The PipelineBuilder provides a fluent interface for constructing data pipelines:

```javascript
const pipeline = new PipelineBuilder({ name: 'my-pipeline' })
    .source('kafka', config)      // Add a source
    .transform(fn1)                // Add transformation
    .transform(fn2)                // Chain transformations
    .sink('console', config)       // Add a sink
    .sink('file', config);         // Add multiple sinks
```

### 2. Stream Processing Model

Streams are processed in micro-batches with configurable windows:

```
Time → [Window 1] [Window 2] [Window 3] →
Data →   └─┬─┘     └─┬─┘     └─┬─┘
         Process  Process  Process
           ↓         ↓         ↓
        Output    Output    Output
```

### 3. State Management

The library maintains state for:

- Windowing: Aggregates within time windows
- GroupBy: Tracks groups and their aggregates
- Checkpointing: Saves progress for recovery

### 4. Error Recovery Hierarchy

```
Application Error
    ↓
Local Retry (3-5 attempts with backoff)
    ↓
Circuit Breaker (if continues failing)
    ↓
Dead Letter Queue (store failed messages)
    ↓
Alert & Manual Intervention
```

## API Documentation

### PipelineBuilder

#### Constructor

```typescript
new PipelineBuilder(config: PipelineConfig, options?: PipelineOptions)
```

**PipelineConfig:**

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| name | string | Pipeline identifier | Required |
| checkpointLocation | string | Directory for checkpoints | './checkpoints' |
| parallelism | number | Concurrent processing | 1 |

**PipelineOptions:**

| Property | Type | Description |
|----------|------|-------------|
| retryConfig | RetryConfig | Retry configuration |
| errorHandler | Function | Custom error handler |
| maxConcurrent | number | Max concurrent operations |

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| source(type, config) | Add a data source | this |
| transform(fn) | Add a transformation function | this |
| sink(type, config) | Add a data sink | this |
| run() | Execute the pipeline | Promise<void> |
| lineage() | Get pipeline execution graph | Lineage |
| getMetrics() | Get pipeline performance metrics | Metrics |

### KafkaStream

```typescript
new KafkaStream<T>(topic: string, options?: StreamOptions)
```

**StreamOptions:**

| Property | Type | Description |
|----------|------|-------------|
| windowSize | number | Window duration in ms |
| slideInterval | number | Slide interval for windows |
| watermarkDelay | number | Late data tolerance |

#### Methods

| Method | Description |
|--------|-------------|
| filter(predicate) | Keep only matching records |
| map(transform) | Transform each record |
| flatMap(transform) | One-to-many transformation |
| window(ms, slide?) | Add time-based window |
| groupBy(keyExtractor) | Group records by key |
| count() | Count per group |
| sum(extractor) | Sum values per group |
| avg(extractor) | Average per group |
| reduce(reducer, initial) | Custom reduction |
| join(other, keyExtractor) | Join with another stream |

### SparkClient

```typescript
new SparkClient(config: SparkConfig, retryConfig?: RetryConfig)
```

**SparkConfig:**

| Property | Type | Description |
|----------|------|-------------|
| master | string | Spark master URL |
| appName | string | Application name |
| sparkConf | object | Spark configuration |

#### Methods

| Method | Description |
|--------|-------------|
| submitJob(code, name, options) | Submit Spark job |
| runPythonScript(path, args, options) | Run Python script |
| submitSQLQuery(sql, options) | Execute SQL query |
| monitorJob(id, timeout) | Monitor job progress |
| cancelJob(id) | Cancel running job |
| healthCheck() | Check cluster health |

### Error Handling Utilities

```typescript
// Retry failed operations
function withRetry<T>(
    fn: () => Promise<T>,
    options?: {
        maxRetries?: number;
        delayMs?: number;
        backoffMultiplier?: number;
        shouldRetry?: (error: Error) => boolean;
    }
): Promise<T>;

// Circuit breaker pattern
class CircuitBreaker {
    constructor(failureThreshold: number, timeoutMs: number);
    call<T>(fn: () => Promise<T>): Promise<T>;
    getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    reset(): void;
}

// Custom errors
class RetryableError extends Error {}  // Will trigger retry
class FatalError extends Error {}      // Will NOT retry
```

## Real-World Examples

### Example: Real-time E-commerce Analytics

```javascript
const { PipelineBuilder, KafkaStream } = require('@async-fusion/data');

// Stream 1: Calculate real-time revenue
const revenueStream = new KafkaStream('orders')
    .filter(order => order.status === 'completed')
    .window(60000)  // 1-minute windows
    .groupBy(order => order.productId)
    .sum(order => order.amount)
    .map(result => ({
        productId: result.key,
        revenue: result.sum,
        timestamp: new Date()
    }));

// Stream 2: Detect fraudulent transactions
const fraudStream = new KafkaStream('payments')
    .filter(payment => payment.amount > 1000)
    .window(300000)  // 5-minute windows
    .groupBy(payment => payment.userId)
    .count()
    .filter(result => result.count > 3)  // >3 high-value payments in 5 min
    .map(result => ({
        userId: result.key,
        alert: 'POTENTIAL_FRAUD',
        timestamp: new Date()
    }));

// Pipeline to combine and output
const analyticsPipeline = new PipelineBuilder({ name: 'ecommerce-analytics' })
    .source('stream', { stream: revenueStream })
    .source('stream', { stream: fraudStream })
    .transform(data => enrichWithUserData(data))
    .sink('database', { table: 'realtime_metrics' })
    .sink('websocket', { port: 8080 });  // Push to dashboard

await analyticsPipeline.run();
```

### Example: Data Lake Ingestion with Spark

```javascript
const { SparkClient, PipelineBuilder } = require('@async-fusion/data');

const spark = new SparkClient({
    master: 'spark://prod-cluster:7077',
    appName: 'data-lake-ingestion',
    sparkConf: {
        'spark.sql.shuffle.partitions': '200',
        'spark.sql.adaptive.enabled': 'true'
    }
});

// Submit data transformation job
const transformJob = await spark.runPythonScript('./transform.py', [
    '--input', 's3://raw-bucket/logs/',
    '--output', 's3://processed-bucket/'
], { timeout: 3600000 });

// Monitor progress
await spark.monitorJob(transformJob.id, 3600000);

// Run SQL analysis
const results = await spark.submitSQLQuery(`
    SELECT 
        DATE(timestamp) as day,
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users
    FROM processed_events
    WHERE timestamp >= CURRENT_DATE - INTERVAL 7 DAY
    GROUP BY DATE(timestamp)
`);

console.log('Weekly stats:', results);
```

## Error Handling Deep Dive

### The Retry Mechanism

```javascript
const { withRetry, RetryableError } = require('@async-fusion/data');

// Automatic retry with exponential backoff
const data = await withRetry(
    async () => {
        const response = await fetch('https://api.example.com/data');
        
        if (response.status === 429) {
            // Rate limited - retryable
            throw new RetryableError('Rate limited');
        }
        
        if (response.status === 500) {
            // Server error - retryable
            throw new RetryableError('Server error');
        }
        
        if (response.status === 404) {
            // Not found - NOT retryable
            throw new Error('Resource not found');
        }
        
        return response.json();
    },
    {
        maxRetries: 5,
        delayMs: 1000,
        backoffMultiplier: 2,
        shouldRetry: (error) => error instanceof RetryableError
    }
);
```

### Circuit Breaker in Action

```javascript
const { CircuitBreaker } = require('@async-fusion/data');

// Create circuit breaker for external API
const apiBreaker = new CircuitBreaker(5, 60000);

async function callExternalAPI() {
    return apiBreaker.call(async () => {
        const response = await axios.get('https://unreliable-api.com/data');
        return response.data;
    });
}

// Circuit states:
// CLOSED - Normal operation, requests pass through
// OPEN - Too many failures, requests blocked
// HALF_OPEN - Testing if service recovered

setInterval(async () => {
    try {
        const data = await callExternalAPI();
        console.log('API call succeeded');
        console.log('Circuit state:', apiBreaker.getState());
    } catch (error) {
        console.error('API call failed');
        console.log('Circuit state:', apiBreaker.getState());
    }
}, 5000);
```

## Performance Characteristics

### Benchmarks

| Operation | Latency (p99) | Throughput | Memory Usage |
|-----------|---------------|------------|--------------|
| Simple filter | 0.5ms | 200K ops/sec | ~50MB |
| Map transformation | 0.8ms | 180K ops/sec | ~50MB |
| Window (1 min) | 5ms | 100K ops/sec | ~200MB |
| Group by count | 10ms | 80K ops/sec | ~300MB |
| Join (2 streams) | 15ms | 50K ops/sec | ~500MB |

### Optimization Tips

- Increase batch size for higher throughput

```javascript
pipeline.options.batchSize = 1000;
```

- Use partitioning for parallel processing

```javascript
pipeline.options.parallelism = 4;
```

- Enable compression for large payloads

```javascript
kafkaConfig.compression = 'snappy';
```

- Tune window size based on latency requirements

```javascript
// Lower latency: smaller windows
stream.window(1000);  // 1 second windows

// Higher throughput: larger windows
stream.window(60000); // 1 minute windows
```

## Configuration Reference

### Full Configuration Example

```javascript
const config = {
    // Pipeline configuration
    pipeline: {
        name: 'production-pipeline',
        checkpointLocation: '/data/checkpoints',
        parallelism: 4,
        batchSize: 1000
    },
    
    // Retry configuration
    retry: {
        maxAttempts: 5,
        delayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 30000
    },
    
    // Kafka configuration
    kafka: {
        brokers: ['kafka1:9092', 'kafka2:9092'],
        clientId: 'async-fusion-app',
        ssl: true,
        sasl: {
            mechanism: 'scram-sha-256',
            username: process.env.KAFKA_USERNAME,
            password: process.env.KAFKA_PASSWORD
        },
        compression: 'snappy',
        retry: {
            maxRetries: 3,
            initialRetryTime: 100
        }
    },
    
    // Spark configuration
    spark: {
        master: 'spark://cluster:7077',
        appName: 'async-fusion-job',
        sparkConf: {
            'spark.executor.memory': '4g',
            'spark.executor.cores': '2',
            'spark.sql.adaptive.enabled': 'true'
        }
    },
    
    // Monitoring
    monitoring: {
        metricsInterval: 10000,  // 10 seconds
        exporters: ['console', 'prometheus']
    }
};
```

## Contributing

We welcome contributions! Please see our Contributing Guide.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/hollermay/async-fusion-data.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

### Project Structure

```
async-fusion-data/
├── src/
│   ├── kafka/          # Kafka integration
│   ├── spark/          # Spark integration
│   ├── pipeline/       # Pipeline builder
│   ├── react/          # React hooks
│   ├── utils/          # Utilities
│   └── types/          # TypeScript types
├── dist/               # Built files
├── __tests__/          # Unit tests
├── examples/           # Example applications
├── docs/               # Documentation
└── package.json
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Apache Kafka - Distributed streaming platform
- Apache Spark - Unified analytics engine
- Node.js community - JavaScript runtime
- TypeScript team - Type safety

## Contact & Support

- GitHub Issues: Report bugs
- Discussions: Ask questions


"Please do run this and let me know what I can do better for this"

[Back to Top](#async-fusiondata)
```
