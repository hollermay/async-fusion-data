import axios, { AxiosInstance } from 'axios';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMProvider {
    generate(messages: LLMMessage[]): Promise<LLMResponse>;
    getProviderName(): string;
}
export class GeminiProvider implements LLMProvider {
    private client: GoogleGenerativeAI;
    private model: GenerativeModel;
    private modelName: string;
    private apiKey: string;

    constructor(config: { apiKey: string; model?: string }) {
        this.apiKey = config.apiKey;
        this.modelName = config.model || 'gemini-1.5-flash'; // or 'gemini-1.5-pro', 'gemini-2.0-flash'
        this.client = new GoogleGenerativeAI(config.apiKey);
        this.model = this.client.getGenerativeModel({ model: this.modelName });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        // Convert messages to Gemini format
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');
        
        // Build prompt
        let prompt = '';
        if (systemMessage) {
            prompt += `System: ${systemMessage.content}\n\n`;
        }
        for (const msg of userMessages) {
            prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        prompt += 'Assistant:';

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();

        // Gemini doesn't provide token counts in the same way, but we can estimate
        const estimatedTokens = Math.ceil(content.length / 4);
        
        return {
            content,
            model: this.modelName,
            usage: {
                promptTokens: 0, // Would need separate API call for token count
                completionTokens: estimatedTokens,
                totalTokens: estimatedTokens
            }
        };
    }

    getProviderName(): string {
        return `Google Gemini (${this.modelName})`;
    }
}
// OpenAI Provider
export class OpenAIProvider implements LLMProvider {
    private client: AxiosInstance;
    private model: string;
    private apiKey: string;

    constructor(config: { apiKey: string; model?: string; baseURL?: string }) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-3.5-turbo';
        this.client = axios.create({
            baseURL: config.baseURL || 'https://api.openai.com/v1',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages,
            temperature: 0.7
        });

        return {
            content: response.data.choices[0].message.content,
            model: response.data.model,
            usage: {
                promptTokens: response.data.usage.prompt_tokens,
                completionTokens: response.data.usage.completion_tokens,
                totalTokens: response.data.usage.total_tokens
            }
        };
    }

    getProviderName(): string {
        return `OpenAI (${this.model})`;
    }
}

// Anthropic Provider (Claude)
export class AnthropicProvider implements LLMProvider {
    private client: AxiosInstance;
    private model: string;
    private apiKey: string;

    constructor(config: { apiKey: string; model?: string }) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'claude-3-haiku-20240307';
        this.client = axios.create({
            baseURL: 'https://api.anthropic.com/v1',
            headers: {
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        // Convert messages to Anthropic format
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');

        const response = await this.client.post('/messages', {
            model: this.model,
            system: systemMessage?.content,
            messages: userMessages,
            max_tokens: 4096
        });

        return {
            content: response.data.content[0].text,
            model: response.data.model,
            usage: {
                promptTokens: response.data.usage.input_tokens,
                completionTokens: response.data.usage.output_tokens,
                totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
            }
        };
    }

    getProviderName(): string {
        return `Anthropic (${this.model})`;
    }
}

// Groq Provider (Fast inference)
export class GroqProvider implements LLMProvider {
    private client: AxiosInstance;
    private model: string;
    private apiKey: string;

    constructor(config: { apiKey: string; model?: string }) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'llama3-70b-8192';
        this.client = axios.create({
            baseURL: 'https://api.groq.com/openai/v1',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages,
            temperature: 0.7
        });

        return {
            content: response.data.choices[0].message.content,
            model: response.data.model,
            usage: {
                promptTokens: response.data.usage.prompt_tokens,
                completionTokens: response.data.usage.completion_tokens,
                totalTokens: response.data.usage.total_tokens
            }
        };
    }

    getProviderName(): string {
        return `Groq (${this.model})`;
    }
}

// OpenAI-Compatible Provider (For local LLMs like Ollama, LocalAI, etc.)
export class OpenRouterProvider implements LLMProvider {
    private client: AxiosInstance;
    private model: string;

    constructor(config: { apiKey?: string; model?: string; baseURL?: string }) {
        this.model = config.model || 'openai/gpt-3.5-turbo';
        this.client = axios.create({
            baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
            headers: {
                'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : '',
                'Content-Type': 'application/json'
            }
        });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages,
            temperature: 0.7
        });

        return {
            content: response.data.choices[0].message.content,
            model: response.data.model,
            usage: response.data.usage
        };
    }

    getProviderName(): string {
        return `OpenRouter (${this.model})`;
    }
}

// Local LLM Provider (Ollama, LocalAI, LM Studio)
export class LocalLLMProvider implements LLMProvider {
    private client: AxiosInstance;
    private model: string;
    private baseURL: string;

    constructor(config: { baseURL?: string; model?: string }) {
        this.baseURL = config.baseURL || 'http://localhost:11434'; // Ollama default
        this.model = config.model || 'llama2';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async generate(messages: LLMMessage[]): Promise<LLMResponse> {
        // Ollama API format
        const response = await this.client.post('/api/generate', {
            model: this.model,
            prompt: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
            stream: false
        });

        return {
            content: response.data.response,
            model: this.model,
            usage: {
                promptTokens: 0, // Ollama doesn't provide token counts
                completionTokens: 0,
                totalTokens: 0
            }
        };
    }

    getProviderName(): string {
        return `Local (${this.model} at ${this.baseURL})`;
    }
}

// Provider Factory
export class LLMProviderFactory {
    static createProvider(type: string, config: any): LLMProvider {
        switch (type) {
            case 'openai':
                return new OpenAIProvider(config);
            case 'anthropic':
                return new AnthropicProvider(config);
            case 'groq':
                return new GroqProvider(config);
            case 'openrouter':
                return new OpenRouterProvider(config);
            case 'gemini':
                return new GeminiProvider(config);
            case 'local':
                return new LocalLLMProvider(config);
            default:
                throw new Error(`Unknown provider type: ${type}. Supported: openai, anthropic, groq, openrouter, local, gemini`);
        }
    }
}