import { Kafka, Consumer as KafkaConsumer } from 'kafkajs';
import { Message } from '../types/index';

export type MessageHandler<T> = (message: Message<T>) => Promise<void>;

export class Consumer<T = any> {
    private consumer: KafkaConsumer;
    private topic: string;
    private handlers: MessageHandler<T>[] = [];
    private isRunning: boolean = false;

    constructor(config: any, topic: string, groupId: string) {
        const kafka = new Kafka({
            clientId: config.clientId || 'async-fusion-consumer',
            brokers: config.brokers
        });
        this.consumer = kafka.consumer({ 
            groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 3000
        });
        this.topic = topic;
    }

    async connect(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ 
            topic: this.topic, 
            fromBeginning: false 
        });
        console.log(`✅ Kafka consumer connected to topic: ${this.topic}`);
    }

    on(handler: MessageHandler<T>): this {
        this.handlers.push(handler);
        return this;
    }

    async start(): Promise<void> {
        this.isRunning = true;
        
        await this.consumer.run({
            autoCommit: true,
            eachMessage: async ({ message, partition }) => {
                if (!this.isRunning) return;
                
                try {
                    // Parse timestamp safely
                    let timestamp = new Date();
                    if (message.timestamp) {
                        const ts = typeof message.timestamp === 'string' 
                            ? parseInt(message.timestamp, 10) 
                            : Number(message.timestamp);
                        timestamp = new Date(ts);
                    }
                    
                    const parsedMessage: Message<T> = {
                        key: message.key?.toString(),
                        value: JSON.parse(message.value?.toString() || '{}'),
                        timestamp: timestamp,
                        partition: partition,
                        offset: Number(message.offset)
                    };
                    
                    for (const handler of this.handlers) {
                        await handler(parsedMessage);
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            }
        });
        console.log(`✅ Kafka consumer started`);
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        await this.consumer.disconnect();
        console.log(`🔌 Kafka consumer disconnected`);
    }
}