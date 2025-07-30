"use strict";
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
exports.OpenAIProvider = void 0;
/**
 * OpenAI Provider Implementation
 */
var OpenAIProvider = /** @class */ (function () {
    function OpenAIProvider(config) {
        this.config = config;
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }
    OpenAIProvider.prototype.complete = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var url, body, response, errorBody, data, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
                        body = {
                            model: this.config.model,
                            messages: request.messages,
                            max_tokens: request.maxTokens || this.config.maxTokens,
                            temperature: (_a = request.temperature) !== null && _a !== void 0 ? _a : this.config.temperature,
                            stream: false
                        };
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(this.config.apiKey)
                                },
                                body: JSON.stringify(body)
                            })];
                    case 2:
                        response = _e.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        errorBody = _e.sent();
                        throw new Error("OpenAI API error: ".concat(response.status, " ").concat(errorBody));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        data = _e.sent();
                        return [2 /*return*/, {
                                content: ((_c = (_b = data.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '',
                                usage: {
                                    promptTokens: data.usage.prompt_tokens,
                                    completionTokens: data.usage.completion_tokens,
                                    totalTokens: data.usage.total_tokens
                                },
                                model: data.model,
                                finishReason: this.mapFinishReason((_d = data.choices[0]) === null || _d === void 0 ? void 0 : _d.finish_reason)
                            }];
                    case 6:
                        error_1 = _e.sent();
                        throw new Error("OpenAI request failed: ".concat(error_1.message));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    OpenAIProvider.prototype.generateRequirements = function (prompt, context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, userPrompt, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an expert software architect. Generate detailed, actionable requirements for the following request.\n\nReturn your response as a JSON object with this exact structure:\n{\n    \"functional\": [\"requirement 1\", \"requirement 2\", ...],\n    \"nonFunctional\": [\"performance requirement\", \"security requirement\", ...],\n    \"constraints\": [\"technical constraint\", \"business constraint\", ...],\n    \"assumptions\": [\"assumption 1\", \"assumption 2\", ...],\n    \"reasoning\": \"explanation of your analysis and decisions\"\n}\n\nBe specific and actionable. Each requirement should be implementable.";
                        userPrompt = "".concat(context ? "Project Context: ".concat(context, "\n\n") : '', "Request: ").concat(prompt);
                        return [4 /*yield*/, this.complete({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt }
                                ]
                            })];
                    case 1:
                        response = _a.sent();
                        try {
                            return [2 /*return*/, JSON.parse(response.content)];
                        }
                        catch (error) {
                            throw new Error('Failed to parse requirements response as JSON');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    OpenAIProvider.prototype.generateDesign = function (requirements, context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, userPrompt, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an expert software architect. Based on the provided requirements, create a detailed technical design.\n\nReturn your response as a JSON object with this exact structure:\n{\n    \"folderStructure\": {\n        \"src/\": {\n            \"components/\": {},\n            \"services/\": {},\n            \"utils/\": {}\n        }\n    },\n    \"components\": [\"Component1\", \"Component2\", ...],\n    \"architecture\": \"description of overall architecture pattern\",\n    \"techStack\": [\"technology1\", \"technology2\", ...],\n    \"dependencies\": [\"package1\", \"package2\", ...],\n    \"reasoning\": \"explanation of design decisions\"\n}\n\nFocus on practical, implementable design decisions.";
                        userPrompt = "".concat(context ? "Project Context: ".concat(context, "\n\n") : '', "Requirements to implement:\n\nFunctional Requirements:\n").concat(requirements.functional.map(function (req) { return "- ".concat(req); }).join('\n'), "\n\nNon-Functional Requirements:\n").concat(requirements.nonFunctional.map(function (req) { return "- ".concat(req); }).join('\n'), "\n\nConstraints:\n").concat(requirements.constraints.map(function (constraint) { return "- ".concat(constraint); }).join('\n'));
                        return [4 /*yield*/, this.complete({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt }
                                ]
                            })];
                    case 1:
                        response = _a.sent();
                        try {
                            return [2 /*return*/, JSON.parse(response.content)];
                        }
                        catch (error) {
                            throw new Error('Failed to parse design response as JSON');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    OpenAIProvider.prototype.generateTasks = function (requirements, design, context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, userPrompt, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an expert project manager and developer. Break down the requirements and design into specific, actionable development tasks.\n\nReturn your response as a JSON object with this exact structure:\n{\n    \"tasks\": [\n        {\n            \"title\": \"Task title\",\n            \"description\": \"Detailed description of what to implement\",\n            \"filePath\": \"relative/path/to/file.ts\",\n            \"dependencies\": [\"task1\", \"task2\"],\n            \"estimatedTime\": \"2 hours\",\n            \"complexity\": \"low|medium|high\"\n        }\n    ],\n    \"reasoning\": \"explanation of task breakdown strategy\"\n}\n\nOrder tasks by dependency and logical implementation sequence.";
                        userPrompt = "".concat(context ? "Project Context: ".concat(context, "\n\n") : '', "Create tasks for:\n\nREQUIREMENTS:\n").concat(requirements.functional.map(function (req) { return "- ".concat(req); }).join('\n'), "\n\nDESIGN:\nArchitecture: ").concat(design.architecture, "\nTech Stack: ").concat(design.techStack.join(', '), "\nComponents: ").concat(design.components.join(', '), "\n\nFolder Structure:\n").concat(JSON.stringify(design.folderStructure, null, 2));
                        return [4 /*yield*/, this.complete({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt }
                                ]
                            })];
                    case 1:
                        response = _a.sent();
                        try {
                            return [2 /*return*/, JSON.parse(response.content)];
                        }
                        catch (error) {
                            throw new Error('Failed to parse tasks response as JSON');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    OpenAIProvider.prototype.generateCode = function (tasks, selectedTasks, context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, tasksToImplement, userPrompt, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an expert developer. Generate production-ready code for the specified tasks.\n\nReturn your response as a JSON object with this exact structure:\n{\n    \"files\": [\n        {\n            \"path\": \"relative/path/to/file.ts\",\n            \"content\": \"complete file content\",\n            \"description\": \"what this file does\"\n        }\n    ],\n    \"reasoning\": \"explanation of implementation approach\"\n}\n\nGenerate complete, working code with proper error handling, typing, and documentation.";
                        tasksToImplement = selectedTasks
                            ? tasks.tasks.filter(function (task) { return selectedTasks.includes(task.title); })
                            : tasks.tasks;
                        userPrompt = "".concat(context ? "Project Context: ".concat(context, "\n\n") : '', "Generate code for these tasks:\n\n").concat(tasksToImplement.map(function (task) { return "\nTASK: ".concat(task.title, "\nDescription: ").concat(task.description, "\nFile: ").concat(task.filePath, "\nComplexity: ").concat(task.complexity, "\n"); }).join('\n'));
                        return [4 /*yield*/, this.complete({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt }
                                ]
                            })];
                    case 1:
                        response = _a.sent();
                        try {
                            return [2 /*return*/, JSON.parse(response.content)];
                        }
                        catch (error) {
                            throw new Error('Failed to parse code response as JSON');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    OpenAIProvider.prototype.validateResponse = function (response) {
        return response.content.length > 0 &&
            response.finishReason === 'stop' &&
            response.usage.totalTokens > 0;
    };
    OpenAIProvider.prototype.estimateTokens = function (text) {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    };
    OpenAIProvider.prototype.isConfigured = function () {
        return !!this.config.apiKey && !!this.config.model;
    };
    OpenAIProvider.prototype.mapFinishReason = function (reason) {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
            default: return 'error';
        }
    };
    return OpenAIProvider;
}());
exports.OpenAIProvider = OpenAIProvider;
