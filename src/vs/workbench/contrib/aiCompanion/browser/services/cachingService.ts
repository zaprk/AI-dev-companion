interface CachedResponse {
	data: any;
	timestamp: number;
	hitCount: number;
}

export class ResponseCachingService {
	private responseCache = new Map<string, CachedResponse>();
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	getCacheKey(type: string, prompt: string, context?: any): string {
		const contextHash = context ? this.hashObject(context) : '';
		return `${type}:${this.hashString(prompt)}:${contextHash}`.substring(0, 64);
	}

	async getFromCache(cacheKey: string): Promise<any | null> {
		const cached = this.responseCache.get(cacheKey);
		if (!cached) return null;

		// Check if cache is still valid
		if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
			this.responseCache.delete(cacheKey);
			return null;
		}

		// Update hit count and return
		cached.hitCount++;
		console.log(`💨 Cache HIT for ${cacheKey} (${cached.hitCount} hits)`);
		return cached.data;
	}

	setCache(cacheKey: string, data: any): void {
		this.responseCache.set(cacheKey, {
			data,
			timestamp: Date.now(),
			hitCount: 0
		});

		// Cleanup old cache entries (keep last 50)
		if (this.responseCache.size > 50) {
			const oldestKey = Array.from(this.responseCache.keys())[0];
			this.responseCache.delete(oldestKey);
		}

		console.log(`💾 Cached response for ${cacheKey}`);
	}

	clearCache(): void {
		this.responseCache.clear();
	}

	getCacheStats(): { size: number; entries: Array<{ key: string; timestamp: number; hitCount: number }> } {
		const entries = Array.from(this.responseCache.entries()).map(([key, value]) => ({
			key,
			timestamp: value.timestamp,
			hitCount: value.hitCount
		}));

		return {
			size: this.responseCache.size,
			entries
		};
	}

	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	private hashObject(obj: any): string {
		return this.hashString(JSON.stringify(obj));
	}
}