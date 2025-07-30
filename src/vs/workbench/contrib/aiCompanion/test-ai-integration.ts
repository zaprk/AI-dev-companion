import { aiProviderFactory } from './common/ai/aiProviderFactory.js';

const testAI = async () => {
    try {
        console.log('Testing AI Integration...');
        
        const provider = aiProviderFactory.createProviderWithDefaults('openai', {
            apiKey: 'your-api-key-here',
            model: 'gpt-4',
            maxTokens: 2048,
            temperature: 0.7
        });

        console.log('Provider created successfully');

        const response = await provider.complete({
            messages: [
                { role: 'user', content: 'Hello, can you help me code?' }
            ]
        });

        console.log('AI Response:', response.content);
        console.log('Test completed successfully!');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
};

// Test the structured AI methods
const testStructuredAI = async () => {
    try {
        console.log('Testing Structured AI Methods...');
        
        const provider = aiProviderFactory.createProviderWithDefaults('openai', {
            apiKey: 'your-api-key-here',
            model: 'gpt-4',
            maxTokens: 2048,
            temperature: 0.7
        });

        // Test requirements generation
        const projectContext = {
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
        const requirements = await provider.generateRequirements('Build a todo app', JSON.stringify(projectContext));
        console.log('Requirements:', requirements);

        console.log('Testing design generation...');
        const design = await provider.generateDesign(requirements, JSON.stringify(projectContext));
        console.log('Design:', design);

        console.log('Testing task generation...');
        const tasks = await provider.generateTasks(requirements, design, JSON.stringify(projectContext));
        console.log('Tasks:', tasks);

        console.log('Testing code generation...');
        const code = await provider.generateCode(tasks, undefined, JSON.stringify(projectContext));
        console.log('Generated files:', code.files.length);

        console.log('Structured AI test completed successfully!');
        
    } catch (error) {
        console.error('Structured AI test failed:', error);
    }
};

// Export for use in other files
export { testAI, testStructuredAI };

// Run tests if this file is executed directly
const runAllTests = async () => {
    try {
        await testAI();
        console.log('Basic AI test completed');
        await testStructuredAI();
        console.log('All tests completed');
    } catch (error) {
        console.error('Test execution failed:', error);
    }
};

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
} 