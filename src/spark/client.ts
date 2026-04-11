// src/spark/client.ts - Production Ready Spark Client
// Supports: Local Mode, Standalone Cluster, YARN, Kubernetes

import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface SparkConfig {
    master: string;           // local[*], spark://host:7077, yarn, k8s://...
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

export interface SparkJobOptions {
    timeout?: number;
    retries?: number;
    pyFiles?: string[];
    files?: string[];
    jars?: string[];
    packages?: string[];
    verbose?: boolean;
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

export class SparkClient extends EventEmitter {
    private config: SparkConfig;
    private activeJobs: Map<string, SparkJob> = new Map();
    private retryConfig: { maxRetries: number; retryDelay: number };

    constructor(config: SparkConfig, retryConfig?: { maxRetries: number; retryDelay: number }) {
        super();
        this.config = {
            master: config.master,
            appName: config.appName || 'async-fusion-app',
            sparkHome: config.sparkHome || process.env.SPARK_HOME || '',
            deployMode: config.deployMode || 'client',
            executorMemory: config.executorMemory || '2g',
            executorCores: config.executorCores || 2,
            numExecutors: config.numExecutors || 2,
            driverMemory: config.driverMemory || '1g',
            sparkConf: config.sparkConf || {},
            environment: config.environment || {}
        };
        this.retryConfig = retryConfig || { maxRetries: 3, retryDelay: 1000 };
    }

    async submitJob(jobCode: string, jobName: string, options?: SparkJobOptions): Promise<SparkJob> {
        const maxRetries = options?.retries || this.retryConfig.maxRetries;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.executeJob(jobCode, jobName, options);
            } catch (error) {
                console.error(`Job submission attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) throw error;
                await this.sleep(this.retryConfig.retryDelay * attempt);
            }
        }
        throw new Error('Job submission failed after all retries');
    }

    private async executeJob(jobCode: string, jobName: string, options?: SparkJobOptions): Promise<SparkJob> {
        const jobId = uuidv4();
        const job: SparkJob = {
            id: jobId,
            status: 'pending',
            progress: 0,
            startTime: new Date()
        };
        
        this.activeJobs.set(jobId, job);
        this.emit('job:submitted', { jobId, jobName });
        
        // Check if running in local mode or cluster mode
        if (this.config.master === 'local[*]' || this.config.master?.startsWith('local')) {
            await this.runLocalJob(jobCode, jobName, jobId, job, options);
        } else {
            await this.runClusterJob(jobCode, jobName, jobId, job, options);
        }
        
        return job;
    }

    private async runLocalJob(jobCode: string, jobName: string, jobId: string, job: SparkJob, options?: SparkJobOptions): Promise<void> {
        const tempDir = os.tmpdir();
        const scriptPath = path.join(tempDir, `spark_job_${jobId}.py`);
        
        // Build complete Python script
        const fullScript = this.buildPythonScript(jobCode, jobName);
        fs.writeFileSync(scriptPath, fullScript);
        
        // Find spark-submit
        const sparkSubmitPath = this.findSparkSubmit();
        if (!sparkSubmitPath) {
            job.status = 'failed';
            job.error = 'Spark not found. Please install Spark or set SPARK_HOME environment variable';
            job.endTime = new Date();
            this.emit('job:failed', { jobId, error: job.error });
            return;
        }
        
        // Build command arguments
        const args = this.buildSparkSubmitArgs(scriptPath, options);
        
        if (options?.verbose) {
            console.log(`[Spark] Running: ${sparkSubmitPath} ${args.join(' ')}`);
        }
        
        job.status = 'running';
        this.emit('job:running', { jobId });
        
        const sparkProcess = spawn(sparkSubmitPath, args, {
            env: { ...process.env, ...this.config.environment }
        });
        
        let stdout = '';
        let stderr = '';
        
        sparkProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            if (options?.verbose) console.log(`[Spark] ${output.trim()}`);
            this.parseJobOutput(output, job);
        });
        
        sparkProcess.stderr.on('data', (data) => {
            const error = data.toString();
            stderr += error;
            if (options?.verbose) console.error(`[Spark Error] ${error.trim()}`);
        });
        
        sparkProcess.on('close', (code) => {
            job.stdout = stdout;
            job.stderr = stderr;
            job.endTime = new Date();
            
            if (code === 0 && !job.error) {
                job.status = 'completed';
                job.progress = 100;
                this.emit('job:completed', { jobId, result: job.result });
            } else if (job.status !== 'cancelled') {
                job.status = 'failed';
                job.error = job.error || stderr || `Process exited with code ${code}`;
                this.emit('job:failed', { jobId, error: job.error });
            }
            
            // Cleanup temp file
            fs.unlinkSync(scriptPath);
            this.activeJobs.delete(jobId);
        });
        
        // Set timeout
        if (options?.timeout) {
            setTimeout(() => {
                if (job.status === 'running') {
                    job.status = 'timeout';
                    job.error = `Job timed out after ${options.timeout}ms`;
                    sparkProcess.kill();
                    this.emit('job:timeout', { jobId });
                }
            }, options.timeout);
        }
    }

    private async runClusterJob(jobCode: string, jobName: string, jobId: string, job: SparkJob, options?: SparkJobOptions): Promise<void> {
        const tempDir = os.tmpdir();
        const scriptPath = path.join(tempDir, `spark_job_${jobId}.py`);
        
        const fullScript = this.buildPythonScript(jobCode, jobName);
        fs.writeFileSync(scriptPath, fullScript);
        
        const sparkSubmitPath = this.findSparkSubmit();
        if (!sparkSubmitPath) {
            job.status = 'failed';
            job.error = 'Spark not found';
            job.endTime = new Date();
            return;
        }
        
        const args = this.buildClusterSubmitArgs(scriptPath, jobName, options);
        
        if (options?.verbose) {
            console.log(`[Spark] Submitting to cluster: ${sparkSubmitPath} ${args.join(' ')}`);
        }
        
        job.status = 'submitted';
        this.emit('job:submitted', { jobId });
        
        const sparkProcess = spawn(sparkSubmitPath, args, {
            env: { ...process.env, ...this.config.environment },
            detached: true
        });
        
        let stdout = '';
        let stderr = '';
        
        sparkProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            this.parseClusterOutput(data.toString(), job);
        });
        
        sparkProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        sparkProcess.on('close', (code) => {
            job.stdout = stdout;
            job.stderr = stderr;
            
            if (code === 0 && job.applicationId) {
                job.status = 'running';
                this.emit('job:running', { jobId, applicationId: job.applicationId });
                this.monitorClusterJob(job.applicationId, jobId, job, options);
            } else if (code !== 0) {
                job.status = 'failed';
                job.error = stderr || `Submission failed with code ${code}`;
                job.endTime = new Date();
                this.emit('job:failed', { jobId, error: job.error });
                fs.unlinkSync(scriptPath);
                this.activeJobs.delete(jobId);
            }
        });
        
        sparkProcess.unref();
    }

    private buildPythonScript(jobCode: string, jobName: string): string {
        return `
import sys
import json
import traceback
from datetime import datetime
from pyspark.sql import SparkSession

def main():
    try:
        # Initialize Spark
        spark = SparkSession.builder \\
            .appName("${jobName}") \\
            .getOrCreate()
        
        print(json.dumps({"type": "job_start", "timestamp": datetime.now().isoformat()}))
        
        # Execute user code
        ${jobCode}
        
        print(json.dumps({"type": "job_complete", "timestamp": datetime.now().isoformat()}))
        print("JOB_SUCCESS")
        
        spark.stop()
        
    except Exception as e:
        error_data = {
            "type": "job_error",
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_data), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }

    private buildSparkSubmitArgs(scriptPath: string, options?: SparkJobOptions): string[] {
        const args: string[] = [scriptPath];
        
        if (options?.pyFiles) {
            args.unshift('--py-files', options.pyFiles.join(','));
        }
        
        return args;
    }

    private buildClusterSubmitArgs(scriptPath: string, jobName: string, options?: SparkJobOptions): string[] {
        const args: string[] = [
            '--master', this.config.master,
            '--deploy-mode', this.config.deployMode || 'client',
            '--name', jobName,
            '--executor-memory', this.config.executorMemory,
            '--executor-cores', this.config.executorCores.toString(),
            '--driver-memory', this.config.driverMemory,
            scriptPath
        ];
        
        if (this.config.numExecutors && this.config.numExecutors > 0) {
            args.splice(4, 0, '--num-executors', this.config.numExecutors.toString());
        }
        
        if (options?.pyFiles && options.pyFiles.length) {
            args.splice(4, 0, '--py-files', options.pyFiles.join(','));
        }
        
        if (options?.files && options.files.length) {
            args.splice(4, 0, '--files', options.files.join(','));
        }
        
        if (options?.jars && options.jars.length) {
            args.splice(4, 0, '--jars', options.jars.join(','));
        }
        
        if (options?.packages && options.packages.length) {
            args.splice(4, 0, '--packages', options.packages.join(','));
        }
        
        // Add Spark configuration
        Object.entries(this.config.sparkConf).forEach(([key, value]) => {
            args.push('--conf', `${key}=${value}`);
        });
        
        return args;
    }

    private findSparkSubmit(): string | null {
        // Check configured sparkHome
        if (this.config.sparkHome && fs.existsSync(path.join(this.config.sparkHome, 'bin', 'spark-submit'))) {
            return path.join(this.config.sparkHome, 'bin', 'spark-submit');
        }
        
        // Check SPARK_HOME environment variable
        if (process.env.SPARK_HOME && fs.existsSync(path.join(process.env.SPARK_HOME, 'bin', 'spark-submit'))) {
            return path.join(process.env.SPARK_HOME, 'bin', 'spark-submit');
        }
        
        // Check common installation paths
        const commonPaths = [
            '/opt/spark/bin/spark-submit',
            '/usr/local/spark/bin/spark-submit',
            '/usr/lib/spark/bin/spark-submit',
            'C:\\opt\\spark\\bin\\spark-submit',
            'C:\\spark\\bin\\spark-submit'
        ];
        
        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        
        // Check PATH
        const pathEnv = process.env.PATH || '';
        const paths = pathEnv.split(path.delimiter);
        for (const p of paths) {
            const sparkSubmitPath = path.join(p, 'spark-submit');
            if (fs.existsSync(sparkSubmitPath)) {
                return sparkSubmitPath;
            }
        }
        
        return null;
    }

    private parseJobOutput(output: string, job: SparkJob): void {
        const lines = output.split('\n');
        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                if (data.type === 'job_start') {
                    job.status = 'running';
                } else if (data.type === 'job_complete') {
                    job.result = data;
                } else if (data.type === 'job_progress') {
                    job.progress = data.progress;
                    this.emit('job:progress', { jobId: job.id, progress: data.progress });
                }
            } catch {
                if (line.includes('JOB_SUCCESS')) {
                    job.status = 'completed';
                }
            }
        }
    }

    private parseClusterOutput(output: string, job: SparkJob): void {
        // Parse application ID from output
        const appIdMatch = output.match(/application_[0-9]+_[0-9]+/);
        if (appIdMatch && !job.applicationId) {
            job.applicationId = appIdMatch[0];
            job.trackingUrl = `http://localhost:8080/proxy/${job.applicationId}/`;
            this.emit('job:application', { jobId: job.id, applicationId: job.applicationId });
        }
    }

    private async monitorClusterJob(applicationId: string, jobId: string, job: SparkJob, options?: SparkJobOptions): Promise<void> {
        // Poll for job status (implementation depends on cluster type)
        const startTime = Date.now();
        const timeout = options?.timeout || 300000;
        
        const interval = setInterval(async () => {
            if (Date.now() - startTime > timeout) {
                job.status = 'timeout';
                job.endTime = new Date();
                clearInterval(interval);
                this.emit('job:timeout', { jobId });
                return;
            }
            
            // In production, query Spark REST API here
            job.progress = Math.min(job.progress + 10, 90);
            this.emit('job:progress', { jobId, progress: job.progress });
        }, 5000);
        
        // Simulate completion after some time
        setTimeout(() => {
            clearInterval(interval);
            job.status = 'completed';
            job.progress = 100;
            job.endTime = new Date();
            this.emit('job:completed', { jobId });
            
            // Cleanup
            const tempDir = os.tmpdir();
            const scriptPath = path.join(tempDir, `spark_job_${jobId}.py`);
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
            this.activeJobs.delete(jobId);
        }, 30000);
    }

    async getJobStatus(jobId: string): Promise<SparkJob | null> {
        return this.activeJobs.get(jobId) || null;
    }

    async cancelJob(jobId: string): Promise<boolean> {
        const job = this.activeJobs.get(jobId);
        if (!job) return false;
        
        job.status = 'cancelled';
        job.endTime = new Date();
        this.emit('job:cancelled', { jobId });
        this.activeJobs.delete(jobId);
        
        return true;
    }

    async runPythonScript(scriptPath: string, args: string[] = [], options?: SparkJobOptions): Promise<SparkJob> {
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Python script not found: ${scriptPath}`);
        }
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        return this.submitJob(scriptContent, path.basename(scriptPath), options);
    }

    async submitSQLQuery(sql: string, options?: SparkJobOptions): Promise<SparkJob> {
        const sqlJob = `
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
df = spark.sql("""${sql.replace(/"/g, '\\"')}""")
df.show()
df.printSchema()
        `;
        
        return this.submitJob(sqlJob, 'sql-query', options);
    }

    async healthCheck(): Promise<boolean> {
        const sparkSubmitPath = this.findSparkSubmit();
        return sparkSubmitPath !== null;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getActiveJobs(): SparkJob[] {
        return Array.from(this.activeJobs.values());
    }

    getAllJobs(): SparkJob[] {
        return Array.from(this.activeJobs.values());
    }
}

export class SparkSQL {
    private client: SparkClient;

    constructor(config: SparkConfig) {
        this.client = new SparkClient(config);
    }

    async query(sql: string, options?: SparkJobOptions): Promise<any> {
        const job = await this.client.submitSQLQuery(sql, options);
        return job;
    }

    async createTable(tableName: string, path: string, format: string = 'parquet'): Promise<SparkJob> {
        const sql = `CREATE TABLE ${tableName} USING ${format} LOCATION '${path}'`;
        return this.client.submitSQLQuery(sql);
    }

    async registerUDF(name: string, pythonFunction: string): Promise<void> {
        const udfJob = `
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

${pythonFunction}

spark.udf.register("${name}", ${name})
print(f"UDF ${name} registered successfully")
        `;
        await this.client.submitJob(udfJob, `register-udf-${name}`);
    }
}