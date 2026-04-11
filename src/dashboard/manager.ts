// src/dashboard/manager.ts - Fixed Singleton
import { LiveDashboard } from './server';

class DashboardManager {
    private static instance: DashboardManager;
    private dashboard: LiveDashboard | null = null;
    private port: number | null = null;
    private isStarting: boolean = false;

    private constructor() {}

    static getInstance(): DashboardManager {
        if (!DashboardManager.instance) {
            DashboardManager.instance = new DashboardManager();
        }
        return DashboardManager.instance;
    }

    start(port: number): void {
        // If already running on this port, do nothing
        if (this.dashboard && this.port === port) {
            console.log(`📊 Dashboard already running on port ${port}`);
            return;
        }
        
        // If already running on different port, log warning
        if (this.dashboard && this.port !== port) {
            console.warn(`⚠️ Dashboard already running on port ${this.port}. Ignoring request for port ${port}`);
            return;
        }
        
        // Prevent multiple simultaneous start attempts
        if (this.isStarting) {
            console.log(`📊 Dashboard start already in progress...`);
            return;
        }
        
        this.isStarting = true;
        this.port = port;
        this.dashboard = new LiveDashboard({ port });
        this.dashboard.start();
        this.isStarting = false;
        console.log(`✅ Dashboard started on port ${port}`);
    }

    getDashboard(): LiveDashboard | null {
        return this.dashboard;
    }

    registerPipeline(name: string): void {
        console.log(`📊 Pipeline "${name}" registered to dashboard`);
    }

    recordMetric(pipelineName: string, records: number, errors: number): void {
        if (this.dashboard) {
            this.dashboard.recordMetric(pipelineName, records, errors);
        }
    }

    stop(): void {
        if (this.dashboard) {
            this.dashboard.stop();
            this.dashboard = null;
            this.port = null;
        }
    }
}

export const dashboardManager = DashboardManager.getInstance();