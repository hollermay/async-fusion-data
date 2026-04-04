import { useState, useEffect, useCallback, useRef } from 'react';
import { Consumer } from '../kafka/consumer';
import { Message } from '../types/index';

interface UseKafkaTopicOptions {
  deserialize?: (data: any) => any;
  maxMessages?: number;
  reconnectOnError?: boolean;
}

export function useKafkaTopic<T = any>(
  topic: string,
  options: UseKafkaTopicOptions = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const consumerRef = useRef<Consumer | null>(null);
  const { deserialize = (d: any) => d, maxMessages = 100, reconnectOnError = true } = options;

  useEffect(() => {
    const consumer = new Consumer(
      { brokers: ['localhost:9092'], clientId: 'react-app' },
      topic,
      `react-group-${topic}`
    );
    consumerRef.current = consumer;

    const connect = async () => {
      try {
        await consumer.connect();
        setIsConnected(true);
        
        consumer.on(async (message: Message) => {
          const value = deserialize(message.value);
          setData((prev: T[]) => {
            const newData = [value, ...prev].slice(0, maxMessages);
            return newData;
          });
        });
        
        await consumer.start();
      } catch (err) {
        setError(err as Error);
        setIsConnected(false);
        
        if (reconnectOnError) {
          setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      if (consumerRef.current) {
        consumerRef.current.stop();
      }
    };
  }, [topic]);

  const clearData = useCallback(() => {
    setData([]);
  }, []);

  return { data, isConnected, error, clearData };
}