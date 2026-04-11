// src/dashboard/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface DashboardMetrics {
    totalRecords: number;
    recordsPerSecond: number;
    activePipelines: number;
    totalErrors: number;
    uptime: number;
    pipelines: Map<string, PipelineMetrics>;
}

export interface PipelineMetrics {
    name: string;
    status: 'running' | 'completed' | 'failed' | 'idle';
    recordsProcessed: number;
    errors: number;
    startTime: Date;
    lastActivity: Date;
    throughput: number;
}

export class LiveDashboard extends EventEmitter {
    private wss: WebSocketServer;
    private expressApp: express.Application;
    private server: Server;
    private port: number;
    private clients: Set<WebSocket> = new Set();
    private metrics: DashboardMetrics;
    private metricsInterval: NodeJS.Timeout | null = null;
    private startTime: Date;

    constructor(options: { port?: number } = {}) {
        super();
        this.port = options.port || 3000;
        this.expressApp = express();
        this.startTime = new Date();
        
        this.metrics = {
            totalRecords: 0,
            recordsPerSecond: 0,
            activePipelines: 0,
            totalErrors: 0,
            uptime: 0,
            pipelines: new Map()
        };
    }

    start(): void {
        // Setup Express for serving HTML
        this.setupExpress();
        
        // Create HTTP server
        this.server = this.expressApp.listen(this.port, () => {
            console.log(`📊 Live Dashboard running at http://localhost:${this.port}`);
        });
        
        // Setup WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        
        this.wss.on('connection', (ws: WebSocket) => {
            console.log(`📡 New dashboard client connected`);
            this.clients.add(ws);
            
            // Send initial metrics
            this.sendMetrics(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`📡 Dashboard client disconnected`);
            });
            
            ws.on('error', (error) => {
                console.error(`WebSocket error:`, error);
            });
        });
        
        // Start metrics collection
        this.startMetricsCollection();
        
        console.log(`✅ Dashboard started successfully`);
    }

    private setupExpress(): void {
        // Serve static files
        this.expressApp.get('/', (req, res) => {
            res.send(this.getHTML());
        });
        
        this.expressApp.get('/api/metrics', (req, res) => {
            res.json(this.getCurrentMetrics());
        });
        
        this.expressApp.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date() });
        });
    }

    private getHTML(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Async Fusion Data - Live Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .subtitle {
            color: #a0aec0;
            margin-bottom: 30px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
        }
        
        .stat-label {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #a0aec0;
            margin-bottom: 10px;
        }
        
        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #fff;
        }
        
        .stat-unit {
            font-size: 0.9rem;
            color: #a0aec0;
            margin-left: 5px;
        }
        
        .pipelines-section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .pipelines-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .pipeline-card {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .pipeline-name {
            font-weight: bold;
        }
        
        .pipeline-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: bold;
        }
        
        .status-running { background: #48bb78; color: #fff; }
        .status-completed { background: #4299e1; color: #fff; }
        .status-failed { background: #f56565; color: #fff; }
        .status-idle { background: #a0aec0; color: #fff; }
        
        .connection-status {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 0.8rem;
            background: rgba(0, 0, 0, 0.8);
        }
        
        .connected { color: #48bb78; }
        .disconnected { color: #f56565; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .live-badge {
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ @async-fusion/data</h1>
        <div class="subtitle">Live Pipeline Monitoring Dashboard</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Records Processed</div>
                <div class="stat-value" id="totalRecords">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Throughput</div>
                <div class="stat-value" id="throughput">0<span class="stat-unit">/sec</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Pipelines</div>
                <div class="stat-value" id="activePipelines">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Errors</div>
                <div class="stat-value" id="totalErrors">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value" id="uptime">0<span class="stat-unit">s</span></div>
            </div>
        </div>
        
        <div class="pipelines-section">
            <div class="pipelines-header">
                <h3>Active Pipelines</h3>
                <span class="live-badge">● LIVE</span>
            </div>
            <div id="pipelinesList">
                <p style="color: #a0aec0; text-align: center;">No active pipelines</p>
            </div>
        </div>
    </div>
    
    <div class="connection-status">
        Status: <span id="connectionStatus" class="connected">● Connected</span>
    </div>
    
    <script>
        let ws = null;
        
        function connect() {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${location.host}\`);
            
            ws.onopen = () => {
                document.getElementById('connectionStatus').className = 'connected';
                document.getElementById('connectionStatus').innerHTML = '● Connected';
            };
            
            ws.onclose = () => {
                document.getElementById('connectionStatus').className = 'disconnected';
                document.getElementById('connectionStatus').innerHTML = '● Disconnected';
                setTimeout(connect, 3000);
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                updateDashboard(data);
            };
        }
        
        function updateDashboard(data) {
            if (data.type === 'metrics') {
                document.getElementById('totalRecords').textContent = data.data.totalRecords.toLocaleString();
                document.getElementById('throughput').innerHTML = data.data.recordsPerSecond + '<span class="stat-unit">/sec</span>';
                document.getElementById('activePipelines').textContent = data.data.activePipelines;
                document.getElementById('totalErrors').textContent = data.data.totalErrors.toLocaleString();
                document.getElementById('uptime').innerHTML = Math.floor(data.data.uptime) + '<span class="stat-unit">s</span>';
                
                // Update pipelines list
                const pipelinesList = document.getElementById('pipelinesList');
                if (data.data.pipelines && data.data.pipelines.length > 0) {
                    pipelinesList.innerHTML = data.data.pipelines.map(p => \`
                        <div class="pipeline-card">
                            <div>
                                <div class="pipeline-name">\${p.name}</div>
                                <div style="font-size: 0.8rem; color: #a0aec0;">
                                    Records: \${p.recordsProcessed.toLocaleString()} | 
                                    Errors: \${p.errors}
                                </div>
                            </div>
                            <div>
                                <span class="pipeline-status status-\${p.status.toLowerCase()}">\${p.status}</span>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    pipelinesList.innerHTML = '<p style="color: #a0aec0; text-align: center;">No active pipelines</p>';
                }
            }
        }
        
        connect();
    </script>
</body>
</html>
        `;
    }

    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(() => {
            this.updateMetrics();
            this.broadcastMetrics();
        }, 1000);
    }

    private updateMetrics(): void {
        this.metrics.uptime = (Date.now() - this.startTime.getTime()) / 1000;
        this.metrics.activePipelines = this.metrics.pipelines.size;
    }

    private broadcastMetrics(): void {
        const data = this.getCurrentMetrics();
        const message = JSON.stringify({ type: 'metrics', data, timestamp: new Date() });
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    private sendMetrics(client: WebSocket): void {
        const data = this.getCurrentMetrics();
        const message = JSON.stringify({ type: 'metrics', data, timestamp: new Date() });
        client.send(message);
    }

    private getCurrentMetrics(): any {
        const pipelinesArray = Array.from(this.metrics.pipelines.values()).map(p => ({
            name: p.name,
            status: p.status,
            recordsProcessed: p.recordsProcessed,
            errors: p.errors,
            throughput: p.throughput
        }));
        
        return {
            totalRecords: this.metrics.totalRecords,
            recordsPerSecond: this.metrics.recordsPerSecond,
            activePipelines: this.metrics.activePipelines,
            totalErrors: this.metrics.totalErrors,
            uptime: this.metrics.uptime,
            pipelines: pipelinesArray
        };
    }

    recordMetric(pipelineName: string, records: number = 1, errors: number = 0): void {
        this.metrics.totalRecords += records;
        this.metrics.totalErrors += errors;
        
        if (!this.metrics.pipelines.has(pipelineName)) {
            this.metrics.pipelines.set(pipelineName, {
                name: pipelineName,
                status: 'running',
                recordsProcessed: 0,
                errors: 0,
                startTime: new Date(),
                lastActivity: new Date(),
                throughput: 0
            });
        }
        
        const pipeline = this.metrics.pipelines.get(pipelineName)!;
        pipeline.recordsProcessed += records;
        pipeline.errors += errors;
        pipeline.lastActivity = new Date();
        
        // Calculate throughput
        const runtime = (Date.now() - pipeline.startTime.getTime()) / 1000;
        pipeline.throughput = runtime > 0 ? pipeline.recordsProcessed / runtime : 0;
        
        // Update global throughput
        const totalRuntime = (Date.now() - this.startTime.getTime()) / 1000;
        this.metrics.recordsPerSecond = totalRuntime > 0 ? this.metrics.totalRecords / totalRuntime : 0;
    }

    updatePipelineStatus(pipelineName: string, status: PipelineMetrics['status']): void {
        const pipeline = this.metrics.pipelines.get(pipelineName);
        if (pipeline) {
            pipeline.status = status;
        }
    }

    stop(): void {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        this.wss.close();
        this.server.close();
        console.log(`📊 Dashboard stopped`);
    }
}