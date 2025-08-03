// src/vs/workbench/contrib/aiCompanion/browser/services/connectionPoolService.ts

export class ConnectionPoolService {
	private connectionPool: Map<string, AbortController> = new Map();
	private readonly MAX_CONCURRENT_REQUESTS = 3;

	canMakeRequest(): boolean {
		return this.connectionPool.size < this.MAX_CONCURRENT_REQUESTS;
	}

	getConnectionId(type: string): string {
		return `${type}-${Date.now()}`;
	}

	createConnection(connectionId: string): AbortController {
		const controller = new AbortController();
		this.connectionPool.set(connectionId, controller);
		return controller;
	}

	removeConnection(connectionId: string): void {
		const controller = this.connectionPool.get(connectionId);
		if (controller) {
			controller.abort();
			this.connectionPool.delete(connectionId);
		}
	}

	cleanupConnectionPool(): void {
		this.connectionPool.forEach((controller) => {
			controller.abort();
		});
		this.connectionPool.clear();
	}

	getActiveConnectionCount(): number {
		return this.connectionPool.size;
	}

	getConnectionStats(): {
		active: number;
		max: number;
		available: number;
	} {
		return {
			active: this.connectionPool.size,
			max: this.MAX_CONCURRENT_REQUESTS,
			available: this.MAX_CONCURRENT_REQUESTS - this.connectionPool.size
		};
	}

	dispose(): void {
		this.cleanupConnectionPool();
	}
}