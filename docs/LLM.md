
# LLM Pipeline Generator

## Overview

The LLM Pipeline Generator in `@async-fusion/data` enables you to generate streaming pipeline code from natural language descriptions using Large Language Models (LLMs) such as Google Gemini, OpenAI, Anthropic, Groq, and more. This feature is designed for rapid prototyping, automation, and simplifying pipeline creation.

---

## Features
- Generate pipeline code from plain English descriptions
- Supports multiple LLM providers (Gemini, OpenAI, Anthropic, Groq, OpenRouter, Local)
- Returns code as a string and as a `PipelineBuilder` instance
- Supports custom models and provider configuration
- Integrates with the rest of the `@async-fusion/data` API

---

## Installation

```bash
npm install @async-fusion/data
```

---

## Usage

### 1. Import the Generator

```javascript
const { LLMPipelineGenerator } = require('@async-fusion/data');
```

### 2. Create a Generator Instance

Provide your LLM provider and API key:

```javascript
const generator = new LLMPipelineGenerator({
        provider: 'gemini', // or 'openai', 'anthropic', 'groq', 'openrouter', 'local'
        apiKey: 'YOUR_API_KEY',
        model: 'gemini-3-flash-preview' // (optional, provider-specific)
});
```

### 3. Generate a Pipeline from Description

```javascript
const description = "Create a pipeline that reads from Kafka topic 'user-clicks', filters clicks where amount > 50, groups by user_id every 5 minutes, and sends results to console.";
const result = await generator.generateFromDescription(description);
```

### 4. Use the Generated Pipeline

- **Access the generated code:**
    ```javascript
    console.log(result.code);
    ```
- **Access the pipeline name, provider, model, and transformations:**
    ```javascript
    console.log(result.name, result.provider, result.model, result.transformations);
    ```
- **Run the generated pipeline (if supported):**
    ```javascript
    if (result.pipeline) {
            await result.pipeline.run();
    }
    ```
- **Save the generated code to a file:**
    ```javascript
    await generator.saveToFile(result.code, 'my-pipeline.js');
    ```

---

## API Reference

### LLMPipelineGenerator

#### Constructor
```typescript
new LLMPipelineGenerator(config: GeneratorConfig, libraryVersion?: string)
```
- `config`: Provider configuration (provider, apiKey, model, baseURL)
- `libraryVersion`: (optional) Library version for compatibility

#### Methods
- `generateFromDescription(description: string): Promise<GeneratedPipeline>`
- `saveToFile(code: string, filename?: string): Promise<string>`
- `runGeneratedPipeline(pipeline: PipelineBuilder): Promise<void>`

#### GeneratedPipeline Object
- `name`: string
- `description`: string
- `code`: string (generated pipeline code)
- `pipeline`: PipelineBuilder (optional, parsed instance)
- `transformations`: string[]
- `provider`: string
- `model`: string
- `libraryVersion`: string
- `timestamp`: string

---

## Example: Minimal Integration

```javascript
const { LLMPipelineGenerator } = require('@async-fusion/data');

const generator = new LLMPipelineGenerator({
        provider: 'openai',
        apiKey: 'YOUR_OPENAI_API_KEY',
        model: 'gpt-3.5-turbo'
});

async function main() {
        const result = await generator.generateFromDescription(
                'Pipeline that reads from Kafka topic "orders", filters orders > $100, and writes to console.'
        );
        // Use result.code or result.pipeline as needed
}

main();
```

---

## Notes
- You must provide a valid API key for your chosen provider.
- Always review generated code before running in production.
- The generated pipeline may require additional configuration or dependencies depending on your use case.

---

## See Also
- [Main Documentation](./README.md)
- [Dashboard Feature](./DASHBOARD.md)

For questions or support, open an issue on the GitHub repository.
