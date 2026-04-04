import { SparkConfig } from '../types/index';

export class SparkSQL {
  private config: SparkConfig;

  constructor(config: SparkConfig) {
    this.config = config;
  }

  async query(sql: string): Promise<any[]> {
    const response = await fetch(`${this.config.master}/api/v1/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    
    const data = await response.json();
    return data.rows || [];
  }

  async createTemporaryView(tableName: string, kafkaTopic: string): Promise<void> {
    const createViewSQL = `
      CREATE TEMPORARY VIEW ${tableName}
      USING kafka
      OPTIONS (
        kafka.bootstrap.servers = "localhost:9092",
        subscribe = "${kafkaTopic}",
        startingOffsets = "latest"
      )
    `;
    
    await this.query(createViewSQL);
  }

  async registerUDF(name: string, pythonFunction: string): Promise<void> {
    const registerSQL = `
      CREATE OR REPLACE FUNCTION ${name}
      USING PYTHON
      AS '${pythonFunction}'
    `;
    
    await this.query(registerSQL);
  }
}