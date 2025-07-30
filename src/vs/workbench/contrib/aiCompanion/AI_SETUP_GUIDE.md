# AI Integration Setup Guide

## Quick Setup

### 1. Configure VS Code Settings

Add the following to your VS Code `settings.json`:

```json
{
    "aiCompanion.ai": {
        "provider": "openai",
        "apiKey": "your-openai-api-key-here",
        "model": "gpt-4",
        "maxTokens": 2048,
        "temperature": 0.7
    },
    "aiCompanion.enabled": true,
    "aiCompanion.defaultMode": "helper"
}
```

### 2. Get Your API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and replace `your-openai-api-key-here` in settings

### 3. Test the Integration

Run the test file to verify everything works:

```bash
# From the aiCompanion directory
node test-ai-integration.ts
```

Or import and run in your code:

```typescript
import { testAI, testStructuredAI } from './test-ai-integration.js';

// Test basic AI functionality
await testAI();

// Test structured AI methods
await testStructuredAI();
```

## Configuration Options

### AI Provider Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `provider` | AI provider to use (`openai`, `anthropic`, etc.) | `openai` |
| `apiKey` | Your API key for the provider | Required |
| `model` | Model to use (e.g., `gpt-4`, `gpt-3.5-turbo`) | `gpt-4` |
| `maxTokens` | Maximum tokens in response | `2048` |
| `temperature` | Creativity level (0.0-1.0) | `0.7` |
| `baseUrl` | Custom API endpoint | Provider default |
| `timeout` | Request timeout in ms | `30000` |

### Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aiCompanion.enabled` | Enable/disable the extension | `true` |
| `aiCompanion.defaultMode` | Default AI mode (`helper`/`builder`) | `helper` |
| `aiCompanion.autoSaveGeneratedFiles` | Auto-save generated files | `true` |
| `aiCompanion.memoryRetentionDays` | How long to keep project memory | `30` |
| `aiCompanion.maxConversationHistory` | Max messages per conversation | `100` |

## Usage Examples

### Basic Chat
```typescript
const aiService = instantiationService.get(IAICompanionService);
await aiService.startNewConversation(AICompanionMode.Helper);
await aiService.sendMessage("Help me create a React component");
```

### Structured Development
```typescript
// Generate requirements
const requirements = await aiService.generateRequirements("Build a todo app");

// Generate design
const design = await aiService.generateDesign(requirements);

// Generate tasks
const tasks = await aiService.generateTasks(requirements, design);

// Generate code
await aiService.generateCode(tasks);
```

## Troubleshooting

### Common Issues

1. **"AI provider not configured"**
   - Check your `apiKey` in settings
   - Verify the `provider` setting is correct

2. **"API key invalid"**
   - Ensure your API key is correct
   - Check if you have sufficient credits

3. **"Request timeout"**
   - Increase `timeout` setting
   - Check your internet connection

4. **"Model not found"**
   - Verify the `model` name is correct
   - Check if you have access to the model

### Debug Mode

Enable debug logging in VS Code settings:

```json
{
    "aiCompanion.debug": true,
    "aiCompanion.logLevel": "debug"
}
```

## Security Notes

- Never commit your API key to version control
- Use environment variables for production
- Consider using VS Code's secret storage for API keys
- Monitor your API usage to avoid unexpected charges

## Next Steps

1. Test the basic integration
2. Try the structured development flow
3. Customize settings for your workflow
4. Explore the secondary panel UI
5. Integrate with your existing projects 