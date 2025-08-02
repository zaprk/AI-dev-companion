import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';



export class AICompanionErrorHandler implements IErrorHandler {
	readonly _serviceBrand: undefined;

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService
	) {}

	handleError(error: Error, context: string, severity: 'info' | 'warning' | 'error' = 'error'): void {
		this.logService.error(`[AI Companion] ${context}: ${error.message}`, error);
		
		const message = this.getErrorMessage(error);
		switch (severity) {
			case 'error':
				this.notificationService.error(message);
				break;
			case 'warning':
				this.notificationService.warn(message);
				break;
			case 'info':
				this.notificationService.info(message);
				break;
		}
	}

	getErrorMessage(error: any): string {
		if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
			return 'Request timed out. The backend may be slow or unavailable.';
		}
		if (error?.message?.includes('fetch')) {
			return 'Failed to connect to AI backend. Please check if the backend is running on localhost:3000';
		}
		if (error?.message?.includes('500')) {
			return 'Backend server error. Please check the backend logs.';
		}
		if (error?.message?.includes('429')) {
			return 'Rate limit exceeded. Please wait a moment before trying again.';
		}
		if (error?.message?.includes('401')) {
			return 'Session expired. Please try again.';
		}
		if (error?.message?.includes('403')) {
			return 'Access denied. Please check your permissions.';
		}
		if (error?.message?.includes('404')) {
			return 'Resource not found. Please check the request.';
		}
		
		// Generic error handling
		if (typeof error === 'string') {
			return error;
		}
		if (error && typeof error === 'object') {
			const errorObj = error as any;
			return errorObj.message || errorObj.toString() || 'Unknown error occurred';
		}
		
		return 'An unexpected error occurred';
	}
}

 