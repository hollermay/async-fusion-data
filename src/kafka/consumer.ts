import { Kafka, Consumer as KafkaConsumer, EachMessagePayload } from 'kafkajs';
import { KafkaConfig, Message } from '../types';

export type MessageHandler<T> = (message: Message<T>) => Promise<void>;

export class Consumer<T = any> {
  private consumer: KafkaConsumer;
  private topic: string;
  private groupId: string;
  private handlers: MessageHandler<T>[] = [];
  private isRunning: boolean = false;
  private maxConcurrent: number = 10;
  private currentProcessing: number = 0;

  constructor(config: KafkaConfig, topic: string, groupId: string) {
    // Use type assertion to bypass strict type checking
    const kafkaConfig: any = {
      clientId: config.clientId,
      brokers: config.brokers,
    };
    
    if (config.ssl) kafkaConfig.ssl = config.ssl;
    if (config.sasl) kafkaConfig.sasl = config.sasl;
    
    const kafka = new Kafka(kafkaConfig);
    this.consumer = kafka.consumer({ groupId });
    this.topic = topic;
    this.groupId = groupId;
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
  }

  on(handler: MessageHandler<T>): this {
    this.handlers.push(handler);
    return this;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        if (!this.isRunning) return;
        
        // Backpressure control
        while (this.currentProcessing >= this.maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const message: Message<T> = {
          key: payload.message.key?.toString(),
          value: JSON.parse(payload.message.value?.toString() || '{}'),
          timestamp: new Date(payload.message.timestamp || Date.now()),
          partition: payload.partition,
          offset: Number(payload.message.offset),
        };
        
        this.currentProcessing++;
        
        try {
          await Promise.all(this.handlers.map(handler => handler(message)));
        } catch (error) {
          console.error('Error processing message:', error);
          throw error;
        } finally {
          this.currentProcessing--;
        }
      },
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.consumer.disconnect();
  }

  setMaxConcurrent(limit: number): this {
    this.maxConcurrent = limit;
    return this;
  }

  async seekToOffset(offset: number): Promise<void> {
    await this.consumer.seek({
      topic: this.topic,
      partition: 0,
      offset: offset.toString(),
    });
  }
}