import { PipelineConfig, PipelineSource, PipelineSink, Message } from '../types';

export interface RetryConfig {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
}

export interface PipelineOptions {
    retryConfig?: RetryConfig;
    errorHandler?: (error: Error, context: any) => void;
    maxConcurrent?: number;
}

export class PipelineBuilder {
    private config: PipelineConfig;
    private sources: Array<{ type: PipelineSource; config: any }> = [];
    private transforms: Array<(data: any) => any> = [];
    private sinks: Array<{ type: PipelineSink; config: any }> = [];
    private options: PipelineOptions;
    private metrics: {
        processed: number;
        errors: number;
        retries: number;
        startTime: Date | null;
        endTime: Date | null;
    };

    constructor(config: PipelineConfig, options?: PipelineOptions) {
        this.config = config;
        this.options = options || {
            retryConfig: {
                maxAttempts: 3,
                delayMs: 1000,
                backoffMultiplier: 2
            },
            maxConcurrent: 10
        };
        this.metrics = {
            processed: 0,
            errors: 0,
            retries: 0,
            startTime: null,
            endTime: null
        };
    }

    source(type: PipelineSource, config: any): this {
        this.sources.push({ type, config });
        return this;
    }

    transform(transformFn: (data: any) => any): this {
        this.transforms.push(transformFn);
        return this;
    }

    sink(type: PipelineSink, config: any): this {
        this.sinks.push({ type, config });
        return this;
    }

    async run(): Promise<void> {
        this.metrics.startTime = new Date();
        console.log(`🚀 Starting pipeline: ${this.config.name}`);
        console.log(`   Sources: ${this.sources.map(s => s.type).join(', ')}`);
        console.log(`   Transforms: ${this.transforms.length}`);
        console.log(`   Sinks: ${this.sinks.map(s => s.type).join(', ')}`);
        
        try {
            for (const source of this.sources) {
                await this.processSource(source);
            }
            
            this.metrics.endTime = new Date();
            this.printSummary();
        } catch (error) {
            console.error(`❌ Pipeline failed:`, error);
            if (this.options.errorHandler) {
                this.options.errorHandler(error as Error, { pipeline: this.config.name });
            }
            throw error;
        }
    }

    private async processSource(source: { type: PipelineSource; config: any }): Promise<void> {
        console.log(`📡 Processing source: ${source.type}`);
        
        // Simulate data processing with retry logic
        const mockData = [
            { id: 1, name: 'Record 1', value: 100 },
            { id: 2, name: 'Record 2', value: 200 },
            { id: 3, name: 'Record 3', value: 300 }
        ];
        
        for (const record of mockData) {
            await this.processRecord(record);
        }
    }

    private async processRecord(record: any, attempt: number = 1): Promise<void> {
        try {
            // Apply transformations with error handling
            let result = record;
            for (const transform of this.transforms) {
                try {
                    result = transform(result);
                } catch (transformError) {
                    console.error(`Transform error:`, transformError);
                    throw transformError;
                }
            }
            
            // Send to sinks
            for (const sink of this.sinks) {
                await this.writeToSink(sink, result);
            }
            
            this.metrics.processed++;
            
        } catch (error) {
            const maxAttempts = this.options.retryConfig?.maxAttempts || 3;
            
            if (attempt < maxAttempts) {
                const delay = (this.options.retryConfig?.delayMs || 1000) * 
                             Math.pow(this.options.retryConfig?.backoffMultiplier || 2, attempt - 1);
                
                console.warn(`⚠️ Retry ${attempt}/${maxAttempts} after ${delay}ms`);
                this.metrics.retries++;
                
                await this.sleep(delay);
                await this.processRecord(record, attempt + 1);
            } else {
                console.error(`❌ Failed to process record after ${maxAttempts} attempts:`, record);
                this.metrics.errors++;
                
                if (this.options.errorHandler) {
                    this.options.errorHandler(error as Error, { record, attempt });
                }
            }
        }
    }

    private async writeToSink(sink: { type: PipelineSink; config: any }, data: any): Promise<void> {
        switch (sink.type) {
            case 'console':
                console.log(`[${sink.type}]`, JSON.stringify(data, null, 2));
                break;
            case 'file':
                // Simulate file write
                console.log(`📁 Writing to file: ${sink.config.filePath}`);
                break;
            case 'kafka':
                console.log(`📤 Sending to Kafka topic: ${sink.config.topic}`);
                break;
            case 'database':
                console.log(`💾 Writing to database: ${sink.config.table}`);
                break;
            default:
                console.log(`📤 Sending to ${sink.type}`);
        }
        
        // Simulate async operation
        await this.sleep(10);
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private printSummary(): void {
        const duration = this.metrics.startTime && this.metrics.endTime 
            ? this.metrics.endTime.getTime() - this.metrics.startTime.getTime()
            : 0;
        
        console.log('');
        console.log('='.repeat(50));
        console.log('📊 Pipeline Summary');
        console.log('='.repeat(50));
        console.log(`   Name: ${this.config.name}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Records processed: ${this.metrics.processed}`);
        console.log(`   Errors: ${this.metrics.errors}`);
        console.log(`   Retries: ${this.metrics.retries}`);
        console.log(`   Success rate: ${((this.metrics.processed / (this.metrics.processed + this.metrics.errors)) * 100).toFixed(2)}%`);
        console.log('='.repeat(50));
    }

    lineage(): any {
        return {
            name: this.config.name,
            sources: this.sources.map(s => s.type),
            transforms: this.transforms.length,
            sinks: this.sinks.map(s => s.type),
            timestamp: new Date().toISOString()
        };
    }

    getMetrics(): any {
        return {
            ...this.metrics,
            duration: this.metrics.startTime && this.metrics.endTime 
                ? this.metrics.endTime.getTime() - this.metrics.startTime.getTime()
                : null
        };
    }
}