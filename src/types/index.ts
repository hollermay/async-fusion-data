// Simplified types to avoid KafkaJS complex types
export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

// Use 'any' for KafkaJS to bypass type checking
export type KafkaJSConfig = any;

export interface PipelineConfig {
  name: string;
  checkpointLocation?: string;
  parallelism?: number;
}

export interface Message<T = any> {
  key?: string;
  value: T;
  timestamp: Date;
  partition?: number;
  offset?: number;
}

export interface SparkConfig {
    master: string;
    appName?: string;
    sparkHome?: string;
    deployMode?: 'client' | 'cluster';
    executorMemory?: string;
    executorCores?: number;
    numExecutors?: number;
    driverMemory?: string;
    sparkConf?: Record<string, string>;
    environment?: Record<string, string>;
}

export interface SparkJob {
    id: string;
    status: 'pending' | 'submitted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
    progress: number;
    startTime: Date;
    endTime?: Date;
    result?: string;
    error?: string;
    stdout?: string;
    stderr?: string;
    applicationId?: string;
    trackingUrl?: string;
}

export interface SparkStage {
  id: number;
  name: string;
  completed: number;
  total: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export type PipelineSource = 'kafka' | 'file' | 'socket' | 'http';
export type PipelineSink = 'kafka' | 'console' | 'file' | 'database' | 'http';
