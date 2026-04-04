export class PipelineMonitor {
  private metrics: Map<string, any> = new Map();
  private startTime: Date = new Date();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push({
      value,
      timestamp: new Date(),
    });
  }

  getMetrics(): { uptime: number; metrics: Record<string, { count: number; recent: any[]; average: number; max: number; min: number }> } {
    const result: { uptime: number; metrics: Record<string, { count: number; recent: any[]; average: number; max: number; min: number }> } = {
      uptime: Date.now() - this.startTime.getTime(),
      metrics: {} as Record<string, { count: number; recent: any[]; average: number; max: number; min: number }>,
    };
    
    for (const [name, values] of this.metrics) {
      const recentValues = values.slice(-100);
      result.metrics[name] = {
        count: values.length,
        recent: recentValues,
        average: recentValues.reduce((a: number, b: any) => a + b.value, 0) / recentValues.length,
        max: Math.max(...recentValues.map((v: any) => v.value)),
        min: Math.min(...recentValues.map((v: any) => v.value)),
      };
    }
    
    return result;
  }

  async exportToPrometheus(): Promise<string> {
    const metrics = this.getMetrics();
    let output = '';
    
    for (const [name, data] of Object.entries(metrics.metrics)) {
      output += `# HELP ${name} Pipeline metric\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${data.average}\n`;
    }
    
    return output;
  }
}