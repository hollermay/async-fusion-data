import { useRef, useEffect } from 'react';
import { useKafkaTopic } from './useKafkaTopic';
import { useSparkQuery } from './useSparkQuery';

interface UseRealtimeDataOptions {
  kafkaTopic: string;
  sparkQuery: string;
  refreshInterval?: number;
  transform?: (data: any) => any;
}

export function useRealtimeData<T = any>(options: UseRealtimeDataOptions) {
  const { kafkaTopic, sparkQuery, refreshInterval = 60000, transform = (d: any) => d } = options;
  
  const { data: realtimeData, isConnected } = useKafkaTopic(kafkaTopic, {
    deserialize: transform,
    maxMessages: 50,
  });
  
  const { data: aggregatedData, loading, refetch } = useSparkQuery(sparkQuery, {
    refreshInterval,
  });
  
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chartRef.current && aggregatedData.length > 0) {
      // This is where you'd initialize a chart library
      console.log('Chart data updated:', aggregatedData);
    }
  }, [aggregatedData]);
  
  return {
    realtimeData,
    aggregatedData,
    isConnected,
    loading,
    refetch,
    chartRef,
  };
}