import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type ProviderChoice = 'auto' | 'gemini' | 'openai';

const geminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  ? process.env.GEMINI_API_KEY
  : null;
const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
  ? process.env.OPENAI_API_KEY
  : null;

const geminiClient = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

export function geminiAvailable(): boolean {
  return !!geminiClient;
}

export function openaiAvailable(): boolean {
  return !!openaiClient;
}

interface GenerateTextOptions {
  prompt: string;
  provider: ProviderChoice;
  preferGemini?: boolean;
  preferOpenAI?: boolean;
  geminiModel?: string; // default: 'gemini-1.5-flash'
  openaiModel?: string; // default: 'gpt-3.5-turbo'
  openaiOptions?: {
    max_tokens?: number;
    temperature?: number;
  };
}

export async function generateText({
  prompt,
  provider,
  preferGemini = false,
  preferOpenAI = false,
  geminiModel = 'gemini-2.5-flash',
  openaiModel = 'gpt-3.5-turbo',
  openaiOptions = {},
}: GenerateTextOptions): Promise<{ text: string; usedProvider: 'gemini' | 'openai' }> {
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  // Determine provider
  let selected: 'gemini' | 'openai' | null = null;
  if (provider === 'gemini') {
    selected = hasGemini ? 'gemini' : null;
  } else if (provider === 'openai') {
    selected = hasOpenAI ? 'openai' : null;
  } else {
    // auto
    if (preferGemini && hasGemini) {
      selected = 'gemini';
    } else if (preferOpenAI && hasOpenAI) {
      selected = 'openai';
    } else if (hasGemini) {
      selected = 'gemini';
    } else if (hasOpenAI) {
      selected = 'openai';
    } else {
      selected = null;
    }
  }

  if (!selected) {
    throw new Error('No AI provider available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in environment variables.');
  }

  if (selected === 'gemini') {
    const model = geminiClient!.getGenerativeModel({ model: geminiModel });
    const response = await model.generateContent(prompt);
    const textResult = response.response.text();
    return { text: textResult ?? '', usedProvider: 'gemini' };
  }

  // OpenAI
  const response = await openaiClient!.chat.completions.create({
    model: openaiModel,
    messages: [{ role: 'user', content: prompt }],
    ...openaiOptions,
  });
  const openaiResult = response.choices[0]?.message?.content ?? '';
  return { text: openaiResult, usedProvider: 'openai' };
}

// Helpers to resolve model choices per provider
export type ModelChoice = 'pro' | 'flash' | 'flash-lite' | undefined;

export function resolveGeminiModel(choice: ModelChoice): string {
  switch (choice) {
    case 'pro':
      return 'gemini-2.5-pro';
    case 'flash-lite':
      return 'gemini-2.5-flash-lite';
    case 'flash':
    default:
      return 'gemini-2.5-flash';
  }
}

export function resolveOpenAIModel(choice: ModelChoice): string {
  // Map 'pro' to a stronger reasoning model, else default
  switch (choice) {
    case 'pro':
      return 'gpt-4o';
    case 'flash-lite':
    case 'flash':
    default:
      return 'gpt-3.5-turbo';
  }
}

// Minimal Gemini Vision wrapper (image + prompt)
export async function generateVision({
  prompt,
  imageBase64,
  provider = 'auto',
  modelChoice,
}: {
  prompt: string;
  imageBase64: string;
  provider?: ProviderChoice;
  modelChoice?: ModelChoice;
}): Promise<{ text: string; usedProvider: 'gemini' | 'openai' }> {
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  // Prefer Gemini for vision; OpenAI vision not implemented in this wrapper
  let selected: 'gemini' | 'openai' | null = null;
  if (provider === 'gemini' && hasGemini) selected = 'gemini';
  else if (provider === 'openai' && hasOpenAI) selected = 'openai';
  else if (hasGemini) selected = 'gemini';
  else if (hasOpenAI) selected = 'openai';

  if (selected !== 'gemini') {
    throw new Error('Vision analysis currently requires Gemini. Configure GEMINI_API_KEY.');
  }

  const modelId = resolveGeminiModel(modelChoice);
  const model = geminiClient!.getGenerativeModel({ model: modelId });
  const response = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/png',
      },
    },
  ]);
  const textResult = response.response.text();
  return { text: textResult ?? '', usedProvider: 'gemini' };
}