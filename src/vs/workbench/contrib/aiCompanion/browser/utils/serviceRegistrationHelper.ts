import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';

/**
 * Helper function to register multiple services with consistent configuration
 */
export function registerServices(services: Array<[any, any]>) {
    services.forEach(([serviceInterface, implementation]) => {
        registerSingleton(serviceInterface, implementation, InstantiationType.Delayed);
    });
}

/**
 * Helper function to register a single service with consistent configuration
 */
export function registerService(serviceInterface: any, implementation: any) {
    registerSingleton(serviceInterface, implementation, InstantiationType.Delayed);
} 