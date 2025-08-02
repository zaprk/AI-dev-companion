import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IAICompanionConfigurationService } from '../../common/aiCompanionServiceTokens.js';



type IAICompanionConfigurationServiceType = typeof IAICompanionConfigurationService extends { type: infer T } ? T : never;

export class AICompanionConfigurationService implements IAICompanionConfigurationServiceType {
	readonly _serviceBrand: undefined;

	constructor(@IConfigurationService private readonly configService: IConfigurationService) {}

	get backendUrl(): string {
		return this.configService.getValue<string>('aiCompanion.backend.url') || 'http://localhost:3000/api/v1';
	}

	get streamingEnabled(): boolean {
		return this.configService.getValue<boolean>('aiCompanion.backend.streaming') ?? true;
	}

	get cacheDuration(): number {
		return this.configService.getValue<number>('aiCompanion.cache.duration') || 5 * 60 * 1000; // 5 minutes
	}

	get maxConcurrentRequests(): number {
		return this.configService.getValue<number>('aiCompanion.backend.maxConcurrentRequests') || 3;
	}

	get timeout(): number {
		return this.configService.getValue<number>('aiCompanion.backend.timeout') || 30000; // 30 seconds
	}
}

 