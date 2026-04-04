import { useState, useEffect, useCallback } from 'react';
import { SparkSQL } from '../spark/sql';

interface UseSparkQueryOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

export function useSparkQuery(
  sqlQuery: string,
  options: UseSparkQueryOptions = {}
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { refreshInterval = 0, enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const spark = new SparkSQL({ master: 'spark://localhost:7077', appName: 'react-query' });
      const result = await spark.query(sqlQuery);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [sqlQuery, enabled]);

  useEffect(() => {
    fetchData();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}