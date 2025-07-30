"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProviderFactory = exports.AIProviderFactory = exports.DEFAULT_AI_CONFIGS = void 0;
var openaiProvider_js_1 = require("./providers/openaiProvider.js");
/**
 * Default AI Provider Configurations
 */
exports.DEFAULT_AI_CONFIGS = {
    openai: {
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.openai.com/v1/chat/completions'
    },
    'openai-3.5': {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.openai.com/v1/chat/completions'
    },
    claude: {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.anthropic.com/v1/messages'
    },
    azure: {
        provider: 'azure',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000
    },
    local: {
        provider: 'local',
        model: 'llama2',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000,
        baseUrl: 'http://localhost:11434/api/generate'
    }
};
/**
 * AI Provider Factory Implementation
 */
var AIProviderFactory = /** @class */ (function () {
    function AIProviderFactory() {
    }
    AIProviderFactory.prototype.createProvider = function (config) {
        switch (config.provider) {
            case 'openai':
                return new openaiProvider_js_1.OpenAIProvider(config);
            case 'claude':
                // TODO: Implement ClaudeProvider
                throw new Error('Claude provider not yet implemented');
            case 'azure':
                // TODO: Implement AzureProvider  
                throw new Error('Azure provider not yet implemented');
            case 'local':
                // TODO: Implement LocalProvider (Ollama, etc.)
                throw new Error('Local provider not yet implemented');
            default:
                throw new Error("Unsupported AI provider: ".concat(config.provider));
        }
    };
    AIProviderFactory.prototype.getSupportedProviders = function () {
        return ['openai']; // Add more as they're implemented
    };
    /**
     * Create provider with default configuration merged with user config
     */
    AIProviderFactory.prototype.createProviderWithDefaults = function (provider, userConfig) {
        if (userConfig === void 0) { userConfig = {}; }
        var defaultConfig = exports.DEFAULT_AI_CONFIGS[provider];
        if (!defaultConfig) {
            throw new Error("No default configuration found for provider: ".concat(provider));
        }
        var config = __assign(__assign({}, defaultConfig), userConfig);
        return this.createProvider(config);
    };
    /**
     * Validate provider configuration
     */
    AIProviderFactory.prototype.validateConfig = function (config) {
        var errors = [];
        if (!config.provider) {
            errors.push('Provider is required');
        }
        if (!config.model) {
            errors.push('Model is required');
        }
        if (config.maxTokens <= 0) {
            errors.push('Max tokens must be greater than 0');
        }
        if (config.temperature < 0 || config.temperature > 2) {
            errors.push('Temperature must be between 0 and 2');
        }
        // Provider-specific validation
        switch (config.provider) {
            case 'openai':
            case 'azure':
                if (!config.apiKey) {
                    errors.push('API key is required for OpenAI/Azure');
                }
                break;
            case 'claude':
                if (!config.apiKey) {
                    errors.push('API key is required for Claude');
                }
                break;
            case 'local':
                if (!config.baseUrl) {
                    errors.push('Base URL is required for local provider');
                }
                break;
        }
        return {
            valid: errors.length === 0,
            errors: errors
        };
    };
    /**
     * Test provider connectivity
     */
    AIProviderFactory.prototype.testProvider = function (provider) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, response, latency, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, provider.complete({
                                messages: [
                                    { role: 'user', content: 'Test connection. Reply with "OK".' }
                                ]
                            })];
                    case 2:
                        response = _a.sent();
                        latency = Date.now() - startTime;
                        if (response.content.toLowerCase().includes('ok')) {
                            return [2 /*return*/, { success: true, latency: latency }];
                        }
                        else {
                            return [2 /*return*/, { success: false, error: 'Unexpected response from provider' }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_1.message,
                                latency: Date.now() - startTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return AIProviderFactory;
}());
exports.AIProviderFactory = AIProviderFactory;
/**
 * Singleton factory instance
 */
exports.aiProviderFactory = new AIProviderFactory();
