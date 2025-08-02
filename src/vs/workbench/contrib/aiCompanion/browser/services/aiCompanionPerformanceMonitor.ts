import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';



export class AICompanionPerformanceMonitor implements IPerformanceMonitor {
	readonly _serviceBrand: undefined;

	private static metrics = new Map<string, number[]>();

	startTimer(operation: string): () => void {
		const start = Date.now();
		
		return () => {
			const duration = Date.now() - start;
			
			if (!AICompanionPerformanceMonitor.metrics.has(operation)) {
				AICompanionPerformanceMonitor.metrics.set(operation, []);
			}
			
			AICompanionPerformanceMonitor.metrics.get(operation)!.push(duration);
			
			// Keep only last 20 measurements
			const measurements = AICompanionPerformanceMonitor.metrics.get(operation)!;
			if (measurements.length > 20) {
				measurements.splice(0, measurements.length - 20);
			}
			
			const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
			console.log(`⏱️ ${operation}: ${duration}ms (avg: ${avg.toFixed(1)}ms)`);
		};
	}

	getAverageTime(operation: string): number {
		const measurements = AICompanionPerformanceMonitor.metrics.get(operation) || [];
		return measurements.reduce((a, b) => a + b, 0) / measurements.length || 0;
	}

	// Additional utility methods
	getMetrics(operation: string): number[] {
		return AICompanionPerformanceMonitor.metrics.get(operation) || [];
	}

	clearMetrics(operation?: string): void {
		if (operation) {
			AICompanionPerformanceMonitor.metrics.delete(operation);
		} else {
			AICompanionPerformanceMonitor.metrics.clear();
		}
	}

	getAllMetrics(): Map<string, number[]> {
		return new Map(AICompanionPerformanceMonitor.metrics);
	}
}

 