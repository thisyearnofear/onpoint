# OnPoint Web App AI Migration Plan

## 🎯 Goal: Make Web App Fully Functional with Real AI APIs

**Current Status**: Web app components use Chrome AI client hooks but can't access Chrome APIs directly  
**Target**: Migrate to cloud-based AI APIs (Gemini, OpenAI, etc.) for full functionality

---

## 🏗 **Architecture Strategy**

### **Hybrid Approach: Extension + Web App**

1. **Chrome Extension**: Uses Chrome Built-in AI APIs (hackathon submission)
2. **Web Application**: Uses cloud AI APIs (broader accessibility)
3. **Shared Logic**: Common AI client interface for both platforms

```
┌─────────────────────────────────┐
│        OnPoint Platform         │
├─────────────────────────────────┤
│  Chrome Extension (Chrome AI)   │
│  Web Application (Cloud AI)     │
├─────────────────────────────────┤
│     Shared AI Client Interface  │
│  • Fashion Analysis             │
│  • Design Generation            │
│  • Styling Chat                 │
│  • Virtual Try-On               │
└─────────────────────────────────┘
```

---

## 🔧 **Implementation Plan**

### **Phase 1: API Provider Abstraction** (2 hours)

#### 1.1 Create AI Provider Interface
Create `packages/ai-client/src/providers/base-provider.ts`:

```typescript
export interface AIProvider {
  name: string;
  analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse>;
  generateDesign(prompt: string): Promise<DesignGeneration>;
  chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse>;
  analyzePhoto(file: File): Promise<VirtualTryOnAnalysis>;
}

export interface AnalysisInput {
  description?: string;
  image?: File;
  context?: any;
}
```

#### 1.2 Update AI Client to Support Multiple Providers
Modify `packages/ai-client/src/chrome-ai-client.ts` → `ai-client.ts`:

```typescript
import { ChromeAIProvider } from './providers/chrome-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenAIProvider } from './providers/openai-provider';

class AIClientManager {
  private provider: AIProvider;
  
  constructor() {
    this.provider = this.detectBestProvider();
  }
  
  private detectBestProvider(): AIProvider {
    if (this.isChromeExtension() && window.ai) {
      return new ChromeAIProvider();
    } else if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return new GeminiProvider();
    } else if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return new OpenAIProvider();
    }
    throw new Error('No AI provider available');
  }
}
```

### **Phase 2: Gemini API Integration** (4 hours)

#### 2.1 Install Gemini SDK
```bash
pnpm add @google/generative-ai --filter apps/web
```

#### 2.2 Create Gemini Provider
Create `packages/ai-client/src/providers/gemini-provider.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const prompt = this.buildFashionAnalysisPrompt(input);
    const result = await this.model.generateContent(prompt);
    return this.parseCritiqueResponse(result.response.text());
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    const designPrompt = this.buildDesignPrompt(prompt);
    const result = await this.model.generateContent(designPrompt);
    return this.parseDesignResponse(result.response.text(), prompt);
  }

  async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
    const stylistPrompt = this.buildStylistPrompt(message, persona);
    const result = await this.model.generateContent(stylistPrompt);
    return this.parseStylistResponse(result.response.text());
  }

  private buildFashionAnalysisPrompt(input: AnalysisInput): string {
    return `You are a professional fashion critic. Analyze this outfit and provide:
    1. Overall rating (1-10) with explanation
    2. 3-4 specific strengths
    3. 2-3 areas for improvement
    4. Style notes
    5. Confidence level
    
    ${input.description ? `Description: ${input.description}` : ''}
    
    Format as JSON with fields: rating, strengths[], improvements[], styleNotes, confidence`;
  }
}
```

#### 2.3 Add Environment Variables
Update `apps/web/.env.example`:
```bash
# AI API Keys
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Optional: Anthropic Claude
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### **Phase 3: Image Analysis Integration** (3 hours)

#### 3.1 Gemini Vision for Virtual Try-On
```typescript
async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
  const imageData = await this.fileToGenerativePart(file);
  const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-vision" });
  
  const prompt = `Analyze this fashion photo:
  1. Identify body type and proportions
  2. Suggest measurements (general terms)
  3. Provide 5 fit recommendations
  4. Give 3 style improvement suggestions
  
  Be body-positive and constructive.`;
  
  const result = await model.generateContent([prompt, imageData]);
  return this.parseVirtualTryOnResponse(result.response.text());
}

private async fileToGenerativePart(file: File) {
  return {
    inlineData: {
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type,
    },
  };
}
```

### **Phase 4: OpenAI Fallback Integration** (2 hours)

#### 4.1 Install OpenAI SDK
```bash
pnpm add openai --filter apps/web
```

#### 4.2 Create OpenAI Provider
```typescript
import OpenAI from 'openai';

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
      dangerouslyAllowBrowser: true // Only for client-side usage
    });
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const messages = [
      {
        role: "system",
        content: "You are a professional fashion stylist providing constructive outfit analysis."
      },
      {
        role: "user", 
        content: this.buildAnalysisPrompt(input)
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content!);
  }
}
```

### **Phase 5: Web App Hook Updates** (2 hours)

#### 5.1 Update React Hooks
Modify the existing hooks to use the new provider system:

```typescript
// packages/ai-client/src/hooks/useDesignStudio.ts
export function useDesignStudio() {
  const [designs, setDesigns] = useState<DesignGeneration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const aiClient = useAIClient(); // New hook to get current provider

  const generateDesign = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const design = await aiClient.generateDesign(prompt);
      setDesigns(prev => [design, ...prev]);
      return design;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aiClient]);

  return { designs, loading, error, generateDesign, /* ... */ };
}
```

#### 5.2 Create Provider Context
```typescript
// packages/ai-client/src/context/AIContext.tsx
const AIContext = createContext<AIProvider | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    const initProvider = async () => {
      try {
        const aiClient = new AIClientManager();
        setProvider(await aiClient.getProvider());
      } catch (error) {
        console.error('Failed to initialize AI provider:', error);
      }
    };
    initProvider();
  }, []);

  return (
    <AIContext.Provider value={provider}>
      {children}
    </AIContext.Provider>
  );
}

export const useAIClient = () => {
  const provider = useContext(AIContext);
  if (!provider) throw new Error('AI provider not initialized');
  return provider;
};
```

### **Phase 6: Advanced Features** (3 hours)

#### 6.1 Streaming Responses
```typescript
async *chatWithStylistStream(message: string, persona: StylistPersona): AsyncGenerator<string> {
  const stream = await this.openai.chat.completions.create({
    model: "gpt-4",
    messages: this.buildChatMessages(message, persona),
    stream: true
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
```

#### 6.2 Caching & Rate Limiting
```typescript
// packages/ai-client/src/utils/cache.ts
export class AICache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  
  get(key: string, ttlMs: number = 300000): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data;
    }
    return null;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
```

---

## 📦 **Package Dependencies**

### **New Dependencies to Add**:
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.15.0",
    "openai": "^4.52.0",
    "@anthropic-ai/sdk": "^0.24.0",
    "zod": "^3.23.0",
    "react-query": "^3.39.0"
  }
}
```

### **Environment Setup**:
```bash
# .env.local
NEXT_PUBLIC_GEMINI_API_KEY=your_key
NEXT_PUBLIC_OPENAI_API_KEY=your_key
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_key

# Feature flags
NEXT_PUBLIC_ENABLE_AI_PROVIDERS=gemini,openai
NEXT_PUBLIC_DEFAULT_AI_PROVIDER=gemini
```

---

## 🚀 **Deployment Strategy**

### **Development Setup**:
1. **API Keys**: Set up development API keys for testing
2. **Rate Limits**: Implement request throttling for development
3. **Fallbacks**: Ensure graceful degradation when APIs are unavailable

### **Production Considerations**:
1. **API Key Security**: Use server-side proxy for sensitive operations
2. **Cost Management**: Implement usage tracking and limits
3. **Performance**: Add caching and request deduplication
4. **Monitoring**: Track API usage, costs, and performance

---

## 🧪 **Testing Strategy**

### **Unit Tests**:
```typescript
// __tests__/providers/gemini-provider.test.ts
describe('GeminiProvider', () => {
  it('should analyze outfit correctly', async () => {
    const provider = new GeminiProvider();
    const result = await provider.analyzeOutfit({
      description: 'black jeans and white t-shirt'
    });
    
    expect(result.rating).toBeGreaterThan(0);
    expect(result.strengths).toHaveLength.greaterThan(0);
  });
});
```

### **Integration Tests**:
- Test provider switching
- Test fallback mechanisms
- Test error handling
- Test rate limiting

---

## ⏱ **Implementation Timeline**

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| 1. Provider Abstraction | 2 hours | High | None |
| 2. Gemini Integration | 4 hours | High | API key |
| 3. Image Analysis | 3 hours | Medium | Gemini Vision API |
| 4. OpenAI Fallback | 2 hours | Medium | OpenAI API key |
| 5. Hook Updates | 2 hours | High | Phases 1-2 |
| 6. Advanced Features | 3 hours | Low | Phases 1-5 |
| **Total** | **16 hours** | | |

---

## 💡 **Alternative: Nano Banana Integration**

### **If using Google's new "nano banana" model**:

```typescript
// For when nano banana becomes available
export class NanoBananaProvider implements AIProvider {
  private client: NanoBananaClient;
  
  constructor() {
    this.client = new NanoBananaClient({
      apiKey: process.env.NEXT_PUBLIC_NANO_BANANA_KEY
    });
  }
  
  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const response = await this.client.analyze({
      type: 'fashion_critique',
      input: input.description,
      image: input.image ? await this.encodeImage(input.image) : undefined
    });
    
    return this.parseResponse(response);
  }
}
```

---

## 🔄 **Migration Execution Steps**

### **Day 1: Foundation** (6 hours)
1. ✅ Create provider abstraction layer
2. ✅ Set up Gemini API integration  
3. ✅ Test basic functionality with existing components

### **Day 2: Integration** (5 hours)
1. ✅ Update React hooks to use new providers
2. ✅ Add image analysis capabilities
3. ✅ Implement error handling and fallbacks

### **Day 3: Polish** (5 hours)
1. ✅ Add OpenAI fallback provider
2. ✅ Implement caching and rate limiting
3. ✅ Add comprehensive testing
4. ✅ Deploy and validate

---

## 🎯 **Success Criteria**

### **Functional Requirements**:
- ✅ All web app components work with real AI
- ✅ Graceful fallbacks when APIs unavailable  
- ✅ Image analysis working for virtual try-on
- ✅ Multi-persona chat working with context
- ✅ Design generation producing quality results

### **Non-Functional Requirements**:
- ✅ Response times < 5 seconds
- ✅ 99% API success rate
- ✅ Cost < $10/day for normal usage
- ✅ Mobile-responsive and accessible
- ✅ Error messages are user-friendly

---

## 📊 **Expected Outcomes**

### **User Experience**:
- **Web App**: Fully functional fashion AI platform accessible to everyone
- **Chrome Extension**: Premium experience with local AI processing
- **Hybrid Value**: Best of both worlds - privacy + accessibility

### **Technical Benefits**:
- **Scalability**: Cloud APIs handle unlimited users
- **Reliability**: Multiple provider fallbacks
- **Innovation**: Latest AI capabilities available
- **Maintainability**: Clean abstraction layer

### **Business Benefits**:
- **Market Reach**: Web app accessible to all browsers/devices
- **Differentiation**: Chrome extension offers unique Chrome AI features
- **Revenue Options**: Freemium model with usage tiers
- **Partnership Potential**: API integration showcases technical capabilities

This migration plan transforms the OnPoint platform from a Chrome-only hackathon project into a comprehensive, production-ready fashion AI platform that works everywhere! 🚀