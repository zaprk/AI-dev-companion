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
exports.testStructuredAI = exports.testAI = void 0;
var aiProviderFactory_js_1 = require("./common/ai/aiProviderFactory.js");
var testAI = function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Testing AI Integration...');
                provider = aiProviderFactory_js_1.aiProviderFactory.createProviderWithDefaults('openai', {
                    apiKey: 'your-api-key-here',
                    model: 'gpt-4',
                    maxTokens: 2048,
                    temperature: 0.7
                });
                console.log('Provider created successfully');
                return [4 /*yield*/, provider.complete({
                        messages: [
                            { role: 'user', content: 'Hello, can you help me code?' }
                        ]
                    })];
            case 1:
                response = _a.sent();
                console.log('AI Response:', response.content);
                console.log('Test completed successfully!');
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Test failed:', error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.testAI = testAI;
// Test the structured AI methods
var testStructuredAI = function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, projectContext, requirements, design, tasks, code, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                console.log('Testing Structured AI Methods...');
                provider = aiProviderFactory_js_1.aiProviderFactory.createProviderWithDefaults('openai', {
                    apiKey: 'your-api-key-here',
                    model: 'gpt-4',
                    maxTokens: 2048,
                    temperature: 0.7
                });
                projectContext = {
                    workspace: {
                        name: 'Test Project',
                        rootPath: '/test/project',
                        files: ['package.json', 'src/index.ts'],
                        gitBranch: 'main'
                    },
                    projectMemory: {
                        projectName: 'Test Project',
                        goals: ['Build a simple web app'],
                        stack: ['TypeScript', 'React'],
                        architecture: 'SPA',
                        features: [],
                        userPreferences: {},
                        conversations: [],
                        lastUpdated: Date.now()
                    },
                    currentMode: 'helper',
                    fileStructure: ['package.json', 'src/index.ts', 'src/components/'],
                    techStack: ['TypeScript', 'React'],
                    architecture: 'SPA',
                    goals: ['Build a simple web app']
                };
                console.log('Testing requirements generation...');
                return [4 /*yield*/, provider.generateRequirements('Build a todo app', JSON.stringify(projectContext))];
            case 1:
                requirements = _a.sent();
                console.log('Requirements:', requirements);
                console.log('Testing design generation...');
                return [4 /*yield*/, provider.generateDesign(requirements, JSON.stringify(projectContext))];
            case 2:
                design = _a.sent();
                console.log('Design:', design);
                console.log('Testing task generation...');
                return [4 /*yield*/, provider.generateTasks(requirements, design, JSON.stringify(projectContext))];
            case 3:
                tasks = _a.sent();
                console.log('Tasks:', tasks);
                console.log('Testing code generation...');
                return [4 /*yield*/, provider.generateCode(tasks, undefined, JSON.stringify(projectContext))];
            case 4:
                code = _a.sent();
                console.log('Generated files:', code.files.length);
                console.log('Structured AI test completed successfully!');
                return [3 /*break*/, 6];
            case 5:
                error_2 = _a.sent();
                console.error('Structured AI test failed:', error_2);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.testStructuredAI = testStructuredAI;
// Run tests if this file is executed directly
var runAllTests = function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, testAI()];
            case 1:
                _a.sent();
                console.log('Basic AI test completed');
                return [4 /*yield*/, testStructuredAI()];
            case 2:
                _a.sent();
                console.log('All tests completed');
                return [3 /*break*/, 4];
            case 3:
                error_3 = _a.sent();
                console.error('Test execution failed:', error_3);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
// Check if this is the main module
if (import.meta.url === "file://".concat(process.argv[1])) {
    runAllTests();
}
