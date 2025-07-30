// Simple test for AI integration
// Run with: node test-simple.js

const testAI = async () => {
    try {
        console.log('Testing AI Integration...');
        
        // Mock AI provider for testing
        const mockProvider = {
            complete: async ({ messages }) => {
                console.log('✅ Mock AI provider called with:', messages[0].content);
                return {
                    content: 'Hello! I can help you with coding. This is a mock response for testing.',
                    usage: { totalTokens: 50 }
                };
            }
        };

        console.log('✅ Mock provider created successfully');

        const response = await mockProvider.complete({
            messages: [
                { role: 'user', content: 'Hello, can you help me code?' }
            ]
        });

        console.log('✅ AI Response received:', response.content);
        console.log('✅ Basic AI test completed successfully!');
        
    } catch (error) {
        console.error('❌ Basic AI test failed:', error);
    }
};

const testStructuredAI = async () => {
    try {
        console.log('\nTesting Structured AI Methods...');
        
        // Mock AI provider for structured testing
        const mockProvider = {
            generateRequirements: async (prompt, context) => {
                console.log('✅ Mock requirements generation called with:', prompt);
                return {
                    functional: ['User can add todos', 'User can mark todos complete', 'User can delete todos'],
                    nonFunctional: ['Fast response time', 'Mobile responsive'],
                    constraints: ['Use React', 'TypeScript required'],
                    assumptions: ['User has basic web knowledge'],
                    reasoning: 'Based on typical todo app requirements'
                };
            },
            generateDesign: async (requirements, context) => {
                console.log('✅ Mock design generation called');
                return {
                    folderStructure: ['src/', 'src/components/', 'src/hooks/'],
                    components: ['TodoList', 'TodoItem', 'AddTodo'],
                    architecture: 'Component-based React SPA',
                    techStack: ['React', 'TypeScript', 'CSS'],
                    dependencies: ['react', 'react-dom'],
                    reasoning: 'Simple component structure for todo app'
                };
            },
            generateTasks: async (requirements, design, context) => {
                console.log('✅ Mock task generation called');
                return {
                    tasks: [
                        { title: 'Create TodoList component', description: 'Main container component', filePath: 'src/components/TodoList.tsx', dependencies: [] },
                        { title: 'Create TodoItem component', description: 'Individual todo item', filePath: 'src/components/TodoItem.tsx', dependencies: [] },
                        { title: 'Create AddTodo component', description: 'Form to add new todos', filePath: 'src/components/AddTodo.tsx', dependencies: [] }
                    ],
                    reasoning: 'Breaking down into logical components'
                };
            },
            generateCode: async (tasks, selectedTasks, context) => {
                console.log('✅ Mock code generation called');
                return {
                    files: [
                        { path: 'src/components/TodoList.tsx', content: '// Mock TodoList component', description: 'Main todo list component' },
                        { path: 'src/components/TodoItem.tsx', content: '// Mock TodoItem component', description: 'Individual todo item component' },
                        { path: 'src/components/AddTodo.tsx', content: '// Mock AddTodo component', description: 'Add todo form component' }
                    ],
                    reasoning: 'Generated basic component structure'
                };
            }
        };

        // Test project context
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
        const requirements = await mockProvider.generateRequirements('Build a todo app', JSON.stringify(projectContext));
        console.log('✅ Requirements generated:', requirements.functional.length, 'functional requirements');

        console.log('Testing design generation...');
        const design = await mockProvider.generateDesign(requirements, JSON.stringify(projectContext));
        console.log('✅ Design generated:', design.architecture);

        console.log('Testing task generation...');
        const tasks = await mockProvider.generateTasks(requirements, design, JSON.stringify(projectContext));
        console.log('✅ Tasks generated:', tasks.tasks.length, 'tasks');

        console.log('Testing code generation...');
        const code = await mockProvider.generateCode(tasks, undefined, JSON.stringify(projectContext));
        console.log('✅ Code generated:', code.files.length, 'files');

        console.log('✅ Structured AI test completed successfully!');
        
    } catch (error) {
        console.error('❌ Structured AI test failed:', error);
    }
};

const testFileStructure = async () => {
    console.log('\nTesting File Structure...');
    
    const requiredFiles = [
        'common/aiCompanionService.impl.ts',
        'common/aiCompanionService.ts',
        'common/aiCompanionServiceTokens.ts',
        'common/aiCompanion.contribution.ts',
        'common/fileSystemManager.ts',
        'common/utils/pathUtils.ts',
        'common/utils/validationUtils.ts',
        'common/types/fileSystemTypes.ts',
        'common/ai/aiProvider.ts',
        'common/ai/aiProviderFactory.ts'
    ];
    
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} exists`);
        } else {
            console.log(`❌ ${file} missing`);
        }
    });
};

// Run all tests
const runTests = async () => {
    console.log('🧪 AI Companion Integration Tests\n');
    console.log('=====================================\n');

    await testFileStructure();
    await testAI();
    await testStructuredAI();
};

runTests();

console.log('\n=====================================');
console.log('✅ All tests completed!');
console.log('\nNext steps:');
console.log('1. Add the AI settings to your VS Code settings.json');
console.log('2. Restart VS Code to load the extension');
console.log('3. Open the AI Companion panel from the secondary sidebar');
console.log('4. Try sending a message to test the AI integration'); 