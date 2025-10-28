import { AIProvider } from './providers/base-provider';
import { ChromeAIProvider } from './providers/chrome-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenAIProvider } from './providers/openai-provider';

export default class AIClientManager {
  private provider: AIProvider;

  constructor() {
    this.provider = this.detectBestProvider();
  }

  private detectBestProvider(): AIProvider {
    if (this.isChromeExtension() && typeof window !== 'undefined' && window.ai) {
      return new ChromeAIProvider();
    } else if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return new GeminiProvider();
    } else if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return new OpenAIProvider();
    }
    throw new Error('No AI provider available');
  }

  private isChromeExtension(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  }

  public getProvider(): AIProvider {
    return this.provider;
  }
}