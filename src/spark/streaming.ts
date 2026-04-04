import { SparkConfig } from '../types/index';

export class SparkStreaming {
  private config: SparkConfig;

  constructor(config: SparkConfig) {
    this.config = config;
  }

  async createStreamingQuery(
    sourceTopic: string,
    sinkTopic: string,
    transformation: string
  ): Promise<string> {
    const sparkCode = `
      from pyspark.sql import SparkSession
      from pyspark.sql.functions import *
      
      spark = SparkSession.builder \\
          .appName("${this.config.appName}") \\
          .config("spark.sql.streaming.checkpointLocation", "/checkpoint") \\
          .getOrCreate()
      
      # Read from Kafka
      df = spark.readStream.format("kafka") \\
          .option("kafka.bootstrap.servers", "localhost:9092") \\
          .option("subscribe", "${sourceTopic}") \\
          .load()
      
      # Parse JSON
      parsed = df.select(from_json(col("value").cast("string"), 
          "schema").alias("data")).select("data.*")
      
      # Apply transformation
      result = ${transformation}
      
      # Write to Kafka
      query = result.select(to_json(struct("*")).alias("value")) \\
          .writeStream.format("kafka") \\
          .option("kafka.bootstrap.servers", "localhost:9092") \\
          .option("topic", "${sinkTopic}") \\
          .outputMode("append") \\
          .start()
      
      query.awaitTermination()
    `;
    
    // Submit to Spark cluster
    const response = await fetch(`${this.config.master}/api/v1/submissions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CreateSubmissionRequest',
        appResource: sparkCode,
      }),
    });
    
    const data = await response.json();
    return data.submissionId;
  }

  async stopStreamingQuery(queryId: string): Promise<void> {
    await fetch(`${this.config.master}/api/v1/streaming/queries/${queryId}/stop`, {
      method: 'POST',
    });
  }
}