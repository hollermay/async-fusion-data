import { Kafka, Producer as KafkaProducer, RecordMetadata } from 'kafkajs';
import { KafkaConfig, Message } from '../types';

export class Producer<T = any> {
  private producer: KafkaProducer;
  private topic: string;
  private batchSize: number = 100;
  private batchTimeout: number = 1000;
  private messageQueue: Message<T>[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: KafkaConfig, topic: string) {
    // Use type assertion to bypass strict type checking
    const kafkaConfig: any = {
      clientId: config.clientId,
      brokers: config.brokers,
    };
    
    if (config.ssl) kafkaConfig.ssl = config.ssl;
    if (config.sasl) kafkaConfig.sasl = config.sasl;
    
    const kafka = new Kafka(kafkaConfig);
    this.producer = kafka.producer();
    this.topic = topic;
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.startBatchProcessor();
  }

  async send(message: Message<T>): Promise<RecordMetadata[]> {
    return this.producer.send({
      topic: this.topic,
      messages: [{
        key: message.key,
        value: JSON.stringify(message.value),
        timestamp: message.timestamp.toISOString(),
      }],
    });
  }

  async sendBatch(messages: Message<T>[]): Promise<RecordMetadata[]> {
    return this.producer.send({
      topic: this.topic,
      messages: messages.map(msg => ({
        key: msg.key,
        value: JSON.stringify(msg.value),
        timestamp: msg.timestamp.toISOString(),
      })),
    });
  }

  async sendBuffered(message: Message<T>): Promise<void> {
    this.messageQueue.push(message);
    
    if (this.messageQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.messageQueue.length === 0) return;
    
    const batch = [...this.messageQueue];
    this.messageQueue = [];
    
    await this.sendBatch(batch);
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(async () => {
      await this.flush();
    }, this.batchTimeout);
  }

  async disconnect(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    await this.flush();
    await this.producer.disconnect();
  }

  setBatchSize(size: number): this {
    this.batchSize = size;
    return this;
  }

  setBatchTimeout(ms: number): this {
    this.batchTimeout = ms;
    return this;
  }
}