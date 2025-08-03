// src/vs/workbench/contrib/aiCompanion/browser/services/performanceMonitoringService.ts

export class PerformanceMonitoringService {
	private static metrics = new Map<string, number[]>();

	static startTimer(operation: string): () => void {
		const start = Date.now();
		
		return () => {
			const duration = Date.now() - start;
			
			if (!this.metrics.has(operation)) {
				this.metrics.set(operation, []);
			}
			
			this.metrics.get(operation)!.push(duration);
			
			// Keep only last 20 measurements
			const measurements = this.metrics.get(operation)!;
			if (measurements.length > 20) {
				measurements.splice(0, measurements.length - 20);
			}
			
			const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
			console.log(`⏱️ ${operation}: ${duration}ms (avg: ${avg.toFixed(1)}ms)`);
		};
	}

	static getAverageTime(operation: string): number {
		const measurements = this.metrics.get(operation) || [];
		return measurements.reduce((a, b) => a + b, 0) / measurements.length || 0;
	}

	static getMetrics(): Map<string, number[]> {
		return new Map(this.metrics);
	}

	static clearMetrics(): void {
		this.metrics.clear();
	}

	static getPerformanceReport(): {
		operation: string;
		average: number;
		min: number;
		max: number;
		count: number;
	}[] {
		const report: {
			operation: string;
			average: number;
			min: number;
			max: number;
			count: number;
		}[] = [];

		for (const [operation, measurements] of this.metrics.entries()) {
			if (measurements.length > 0) {
				report.push({
					operation,
					average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
					min: Math.min(...measurements),
					max: Math.max(...measurements),
					count: measurements.length
				});
			}
		}

		return report;
	}
}