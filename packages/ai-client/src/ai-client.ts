import { AIProvider } from './providers/base-provider';
import { ChromeAIProvider } from './providers/chrome-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { ServerProvider } from './providers/server-provider';
import { ReplicateProvider } from './providers/replicate-provider';
import { VeniceProvider } from './providers/venice-provider';

export default class AIClientManager {
  private provider: AIProvider;
  private replicateProvider: ReplicateProvider | null = null;
  private veniceProvider: VeniceProvider | null = null;

  constructor() {
    this.provider = this.detectBestProvider();
    this.replicateProvider = this.initReplicateProvider();
    this.veniceProvider = this.initVeniceProvider();
  }

  private detectBestProvider(): AIProvider {
    if (this.isChromeExtension() && typeof window !== 'undefined' && window.ai) {
      return new ChromeAIProvider();
    } else if (typeof window !== 'undefined') {
      // In browser environment, use server-side API
      return new ServerProvider();
    } else if (process.env.GEMINI_API_KEY) {
      return new GeminiProvider();
    } else if (process.env.OPENAI_API_KEY) {
      return new OpenAIProvider();
    }
    throw new Error('No AI provider available');
  }

  private initReplicateProvider(): ReplicateProvider | null {
    if (process.env.REPLICATE_API_TOKEN) {
      return new ReplicateProvider(process.env.REPLICATE_API_TOKEN);
    }
    return null;
  }

  private initVeniceProvider(): VeniceProvider | null {
    if (process.env.VENICE_API_KEY) {
      return new VeniceProvider(process.env.VENICE_API_KEY);
    }
    return null;
  }

  private isChromeExtension(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  }

  public getProvider(): AIProvider {
    return this.provider;
  }

  public getReplicateProvider(): ReplicateProvider | null {
    return this.replicateProvider;
  }

  public getVeniceProvider(): VeniceProvider | null {
    return this.veniceProvider;
  }
}