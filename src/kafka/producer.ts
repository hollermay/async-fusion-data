import { Kafka, Producer as KafkaProducer } from 'kafkajs';
import { Message } from '../types/index';

export class Producer<T = any> {
    private producer: KafkaProducer;
    private topic: string;

    constructor(config: any, topic: string) {
        const kafka = new Kafka({
            clientId: config.clientId || 'async-fusion-producer',
            brokers: config.brokers
        });
        this.producer = kafka.producer({
            allowAutoTopicCreation: true
        });
        this.topic = topic;
    }

    async connect(): Promise<void> {
        await this.producer.connect();
        console.log(`✅ Kafka producer connected to topic: ${this.topic}`);
    }

    async send(message: Message<T>): Promise<void> {
        // CRITICAL FIX: Convert timestamp to string number
        let timestamp = Date.now().toString();
        
        if (message.timestamp) {
            if (message.timestamp instanceof Date) {
                timestamp = message.timestamp.getTime().toString();
            } else if (typeof message.timestamp === 'number') {
                timestamp = String(message.timestamp);
            } else if (typeof message.timestamp === 'string') {
                timestamp = new Date(message.timestamp).getTime().toString();
            }
        }
        
        await this.producer.send({
            topic: this.topic,
            messages: [{
                key: message.key,
                value: JSON.stringify(message.value),
                timestamp: timestamp
            }]
        });
    }

    async sendBatch(messages: Message<T>[]): Promise<void> {
        const kafkaMessages = messages.map(msg => {
            let timestamp = Date.now().toString();
            if (msg.timestamp) {
                if (msg.timestamp instanceof Date) {
                    timestamp = msg.timestamp.getTime().toString();
                } else if (typeof msg.timestamp === 'number') {
                    timestamp = String(msg.timestamp);
                } else if (typeof msg.timestamp === 'string') {
                    timestamp = new Date(msg.timestamp).getTime().toString();
                }
            }
            
            return {
                key: msg.key,
                value: JSON.stringify(msg.value),
                timestamp: timestamp
            };
        });
        
        await this.producer.send({
            topic: this.topic,
            messages: kafkaMessages
        });
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
        console.log(`🔌 Kafka producer disconnected`);
    }
}
