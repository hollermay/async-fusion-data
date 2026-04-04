
import { SparkConfig, SparkJob, SparkStage } from '../types';

export class SparkClient {
    private baseUrl: string;
    private headers: Record<string, string>;
    private retryConfig: { maxRetries: number; retryDelay: number };

    constructor(config: SparkConfig, retryConfig?: { maxRetries: number; retryDelay: number }) {
        this.baseUrl = `${config.master}/api/v1`;
        this.headers = {
            'Content-Type': 'application/json',
        };
        this.retryConfig = retryConfig || { maxRetries: 3, retryDelay: 1000 };
    }

    async submitJob(jobCode: string, jobName: string, options?: { timeout?: number; retries?: number }): Promise<SparkJob> {
        const maxRetries = options?.retries || this.retryConfig.maxRetries;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/submissions/create`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        action: 'CreateSubmissionRequest',
                        appResource: jobCode,
                        mainClass: 'org.apache.spark.deploy.SparkSubmit',
                        appArgs: [jobName],
                        sparkProperties: {
                            'spark.app.name': jobName,
                            'spark.master': this.baseUrl,
                        },
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                const job: SparkJob = {
                    id: data.submissionId,
                    status: 'pending',
                    progress: 0,
                    startTime: new Date(),
                    stages: [],
                };

                // Start monitoring if timeout specified
                if (options?.timeout) {
                    this.monitorJob(job.id, options.timeout).catch(console.error);
                }

                return job;
            } catch (error) {
                console.error(`Job submission attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) throw error;
                await this.sleep(this.retryConfig.retryDelay * attempt);
            }
        }
        throw new Error('Job submission failed after all retries');
    }

    async getJobStatus(jobId: string): Promise<SparkJob> {
        try {
            const response = await fetch(`${this.baseUrl}/submissions/status/${jobId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to get job status: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                id: jobId,
                status: data.driverState?.toLowerCase() || 'unknown',
                progress: data.progress || 0,
                startTime: new Date(data.submissionTime || Date.now()),
                endTime: data.completionTime ? new Date(data.completionTime) : undefined,
                stages: data.stages || [],
            };
        } catch (error) {
            console.error(`Error getting job status:`, error);
            throw error;
        }
    }

    async cancelJob(jobId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/submissions/kill/${jobId}`, {
                method: 'POST',
            });
            
            if (response.ok) {
                console.log(`✅ Job ${jobId} cancelled successfully`);
                return true;
            }
            
            console.error(`Failed to cancel job ${jobId}: ${response.status}`);
            return false;
        } catch (error) {
            console.error(`Error cancelling job:`, error);
            return false;
        }
    }

    async monitorJob(jobId: string, timeoutMs: number = 300000): Promise<SparkJob> {
        const startTime = Date.now();
        let lastProgress = -1;
        
        while (Date.now() - startTime < timeoutMs) {
            const job = await this.getJobStatus(jobId);
            
            // Log progress changes
            if (job.progress !== lastProgress) {
                console.log(`📊 Job ${jobId} progress: ${job.progress}%`);
                lastProgress = job.progress;
            }
            
            // Check completion
            if (job.status === 'completed' || job.status === 'failed') {
                console.log(`✅ Job ${jobId} ${job.status}`);
                return job;
            }
            
            // Wait before next poll
            await this.sleep(2000);
        }
        
        console.warn(`⚠️ Job ${jobId} monitoring timed out after ${timeoutMs}ms`);
        return this.getJobStatus(jobId);
    }

    async runPythonScript(scriptPath: string, args: string[] = [], options?: { timeout?: number }): Promise<SparkJob> {
        // Validate script exists
        const fs = require('fs');
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Python script not found: ${scriptPath}`);
        }
        
        const jobCode = `
from pyspark.sql import SparkSession
import sys
import json

spark = SparkSession.builder.getOrCreate()

try:
    with open('${scriptPath}', 'r') as f:
        code = f.read()
    exec(code)
    print("✅ Python script executed successfully")
except Exception as e:
    print(f"❌ Error executing script: {e}")
    sys.exit(1)
        `;
        
        return this.submitJob(jobCode, `python-${Date.now()}`, options);
    }

    async submitSQLQuery(sql: string, options?: { database?: string; timeout?: number }): Promise<any[]> {
        const queryJob = `
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

${options?.database ? `spark.sql("USE ${options.database}")` : ''}

result = spark.sql("""${sql.replace(/"/g, '\\"')}""")
result.show()
print(result.collect())
        `;
        
        const job = await this.submitJob(queryJob, `sql-${Date.now()}`, options);
        await this.monitorJob(job.id, options?.timeout);
        return [];
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/`);
            return response.ok;
        } catch {
            return false;
        }
    }
}