// Direct AI test - bypasses compilation issues
// Run with: node test-direct-ai.js

const testDirectAI = async () => {
    try {
        console.log('🧪 Testing Direct AI Integration...\n');
        
        // Test 1: Check if we can import the AI provider files
        console.log('1. Testing imports...');
        
        let aiProviderFactory;
        try {
            const module = await import('./common/ai/aiProviderFactory.js');
            aiProviderFactory = module.aiProviderFactory;
            console.log('✅ Successfully imported aiProviderFactory');
        } catch (error) {
            console.log('❌ Failed to import aiProviderFactory:', error.message);
            console.log('   This suggests the TypeScript files need to be compiled first');
            return;
        }
        
        // Test 2: Create provider
        console.log('\n2. Creating AI provider...');
        
        const provider = aiProviderFactory.createProviderWithDefaults('openai', {
            apiKey: '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',
            model: 'gpt-4',
            maxTokens: 2048,
            temperature: 0.7
        });
        
        console.log('✅ Provider created successfully');
        
        // Test 3: Basic completion
        console.log('\n3. Testing basic completion...');
        
        const response = await provider.complete({
            messages: [
                { role: 'user', content: 'Hello, can you help me code?' }
            ]
        });
        
        console.log('✅ AI Response received:');
        console.log('   Content:', response.content.substring(0, 100) + '...');
        console.log('   Usage:', response.usage);
        
        // Test 4: Structured generation
        console.log('\n4. Testing structured generation...');
        
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
        
        console.log('   Testing requirements generation...');
        const requirements = await provider.generateRequirements('Build a todo app', JSON.stringify(projectContext));
        console.log('   ✅ Requirements:', requirements.functional.length, 'functional requirements');
        
        console.log('   Testing design generation...');
        const design = await provider.generateDesign(requirements, JSON.stringify(projectContext));
        console.log('   ✅ Design:', design.architecture);
        
        console.log('   Testing task generation...');
        const tasks = await provider.generateTasks(requirements, design, JSON.stringify(projectContext));
        console.log('   ✅ Tasks:', tasks.tasks.length, 'tasks');
        
        console.log('   Testing code generation...');
        const code = await provider.generateCode(tasks, undefined, JSON.stringify(projectContext));
        console.log('   ✅ Code:', code.files.length, 'files generated');
        
        console.log('\n🎉 All AI tests completed successfully!');
        console.log('\nThe AI integration is working properly.');
        console.log('You can now use it in VS Code by:');
        console.log('1. Adding the AI settings to your VS Code settings.json');
        console.log('2. Restarting VS Code');
        console.log('3. Opening the AI Companion panel');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error('\nError details:', error.message);
        
        if (error.message.includes('MODULE_NOT_FOUND')) {
            console.log('\n💡 This suggests the TypeScript files need to be compiled first.');
            console.log('   Try running: npm run compile (from the vscode directory)');
        }
    }
};

// Run the test
testDirectAI(); 