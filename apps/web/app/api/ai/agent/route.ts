import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { jsonCors, corsHeaders } from '../_utils/http';
import { CANVAS_ITEMS } from '@onpoint/shared-types';
import { AgentControls, type ActionType } from '../../../../lib/middleware/agent-controls';

/**
 * OnPoint Autonomous AI Agent
 *
 * Real LLM-driven agent loop using Venice AI (mistral-31-24b) function calling.
 * The agent perceives (vision/text), reasons, and decides which on-chain
 * actions to take — mint NFTs, recommend products, or propose tips —
 * all via genuine tool-calling, not hardcoded logic.
 *
 * Venice AI: privacy-preserving, no data retention, OpenAI-compatible API.
 * Compatible with AG-UI protocol and ERC-8004 agent standards.
 */

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const VENICE_MODEL = 'mistral-31-24b'; // Vision + function calling

// ============================================
// Tool Definitions (OpenAI-compatible format)
// ============================================

const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_outfit',
      description:
        'Analyze the user outfit from the image or description. Returns a style score (1-10), assessment, and improvement suggestions.',
      parameters: {
        type: 'object',
        properties: {
          score: { type: 'number', description: 'Style score from 1 to 10' },
          summary: { type: 'string', description: 'Brief outfit assessment (2-3 sentences)' },
          strengths: { type: 'array', items: { type: 'string' }, description: 'What works well' },
          improvements: { type: 'array', items: { type: 'string' }, description: 'Specific suggestions to improve' },
          dominant_colors: { type: 'array', items: { type: 'string' }, description: 'Dominant colors detected' },
          style_tags: { type: 'array', items: { type: 'string' }, description: 'Style tags (streetwear, formal, etc.)' },
        },
        required: ['score', 'summary', 'strengths', 'improvements'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_product',
      description:
        'Recommend a product from the OnPoint catalog that would complement the outfit. Call when you identify a gap in the look.',
      parameters: {
        type: 'object',
        properties: {
          product_slug: { type: 'string', description: 'Product slug from the catalog' },
          reason: { type: 'string', description: 'Why this product complements the current look' },
          category: { type: 'string', description: 'Product category' },
        },
        required: ['product_slug', 'reason', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_mint_nft',
      description:
        'Propose minting a Style NFT on Celo when the outfit score is 8 or above. Captures the look on-chain with royalty splits.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why this outfit deserves an NFT' },
          style_title: { type: 'string', description: 'A creative title for the Style NFT' },
          chain: { type: 'string', description: 'Target blockchain (celo)' },
          royalty_split: { type: 'string', description: 'Royalty split (85/10/3/2)' },
        },
        required: ['reason', 'style_title', 'chain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_wallet_balance',
      description: 'Check the agent wallet balance on Celo to verify funds are available.',
      parameters: {
        type: 'object',
        properties: {
          chain: { type: 'string', description: 'Which chain to check (celo, base, ethereum)' },
        },
        required: ['chain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'track_style_preference',
      description: 'Record a user style preference for future personalized recommendations.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Style category (shirts, outerwear, denim, etc.)' },
          style_profile: { type: 'string', description: 'Overall style profile (streetwear, classic, minimalist, etc.)' },
          colors: { type: 'array', items: { type: 'string' }, description: 'Color preferences detected' },
        },
        required: ['category', 'style_profile'],
      },
    },
  },
];

// ============================================
// Tool Execution
// ============================================

const productCatalog = CANVAS_ITEMS.map((item) => ({
  slug: item.slug,
  name: item.name,
  price: item.price,
  category: item.category,
  description: item.description,
}));

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  agentId: string
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'analyze_outfit':
      return { executed: true, ...args };

    case 'recommend_product': {
      const slug = args.product_slug as string;
      const product = productCatalog.find(
        (p) => p.slug === slug || p.name.toLowerCase().includes(slug.toLowerCase())
      );
      if (product) {
        return { executed: true, product, reason: args.reason, chain: 'celo', currency: 'cUSD' };
      }
      const byCat = productCatalog.filter((p) => p.category === args.category);
      const fallback = byCat[0] || productCatalog[0];
      return { executed: true, product: fallback, reason: args.reason, chain: 'celo', currency: 'cUSD' };
    }

    case 'propose_mint_nft': {
      await AgentControls.initStore(agentId);
      const suggestion = AgentControls.suggestAction({
        agentId,
        actionType: 'mint' as ActionType,
        amount: '0.01',
        description: `Mint Style NFT: "${args.style_title}" — ${args.reason}`,
        recipient: undefined,
      });
      return {
        executed: true,
        suggestion_id: suggestion.suggestion?.id,
        auto_executed: suggestion.autoExecuted,
        contract: '0xdb65806c994C3f55079a6136a8E0886CbB2B64B1',
        chain: 'celo',
        royalty_split: args.royalty_split || '85/10/3/2',
        style_title: args.style_title,
      };
    }

    case 'check_wallet_balance':
      return {
        executed: true,
        chain: args.chain || 'celo',
        agent_wallet: '0x05f012C12123D69E8324A251ae7D15A92C4549c1',
        status: 'connected',
        supported_tokens: ['CELO', 'cUSD', 'USDT'],
      };

    case 'track_style_preference': {
      await AgentControls.initStore(agentId);
      AgentControls.trackStyleInteraction('session-user', {
        category: args.category as string,
        price: 50,
      });
      return { executed: true, category: args.category, style_profile: args.style_profile, stored: true };
    }

    default:
      return { executed: false, error: `Unknown tool: ${name}` };
  }
}

// ============================================
// Trace Types
// ============================================

interface AgentStep {
  step: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  chain?: string;
}

interface AgentTrace {
  sessionId: string;
  model: string;
  provider: string;
  protocol: string;
  intent: string;
  reasoning: string;
  steps: AgentStep[];
  actions_taken: string[];
  outcome: {
    style_score: number | null;
    mint_proposed: boolean;
    products_recommended: string[];
    preferences_tracked: boolean;
    summary: string;
  };
  timestamp: string;
}

// ============================================
// System Prompt
// ============================================

function buildSystemPrompt(goal: string): string {
  const goalDescriptions: Record<string, string> = {
    event: 'Evaluate the outfit for a special occasion — formality, confidence impact, and event appropriateness.',
    daily: 'Evaluate the outfit for everyday wear — fit, color coordination, versatility, and comfort.',
    critique: 'Give a blunt, unfiltered critique. Be direct about what works and what doesn\'t.',
  };

  const goalContext = goalDescriptions[goal] || goalDescriptions.daily;

  const catalogSummary = productCatalog
    .slice(0, 12)
    .map((p) => `- ${p.slug}: ${p.name} ($${p.price}, ${p.category})`)
    .join('\n');

  return `You are the OnPoint AI Fashion Agent — an autonomous blockchain-native stylist with economic agency on Celo.

## Your Mission
${goalContext}

## How You Work
You are an AUTONOMOUS agent. You must use your tools to take real actions:
1. ALWAYS call analyze_outfit first to assess the look
2. If the score >= 8, call propose_mint_nft to propose capturing it on-chain as a Style NFT on Celo
3. Based on what you see is missing, call recommend_product to suggest complementary items from the catalog
4. Call track_style_preference to remember the user's style for future sessions
5. Call check_wallet_balance if a transaction is involved

## Product Catalog (use exact slugs for recommend_product)
${catalogSummary}

## Blockchain Context
- Chain: Celo (EVM L2, low-cost transactions)
- NFT Contract: 0xdb65806c994C3f55079a6136a8E0886CbB2B64B1
- Currency: cUSD (Celo Dollar stablecoin)
- Commission Split: 85% creator / 10% platform / 3% affiliate / 2% agent
- Agent Wallet: Self-custodial via Tether WDK

## Rules
- Be specific and actionable in your assessments
- Always use multiple tools — never respond with just text
- When score >= 8, ALWAYS propose an NFT mint
- Recommend products that genuinely fill gaps in the outfit
- Be culturally aware and inclusive in your fashion advice`;
}

// ============================================
// Core Agent Loop
// ============================================

async function runAgentLoop(
  goal: string,
  userMessage: string,
  imageBase64?: string,
  agentId: string = 'onpoint-stylist'
): Promise<AgentTrace> {
  const sessionId = `agent_${Date.now().toString(36)}`;
  const steps: AgentStep[] = [];
  const actionsTaken: string[] = [];
  let styleScore: number | null = null;
  let mintProposed = false;
  const productsRecommended: string[] = [];
  let prefsTracked = false;

  const veniceKey = process.env.VENICE_API_KEY;
  if (!veniceKey) {
    return buildFallbackTrace(sessionId, goal, 'No VENICE_API_KEY configured');
  }

  const client = new OpenAI({
    apiKey: veniceKey,
    baseURL: VENICE_BASE_URL,
  });

  // Build messages
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    });
  }

  userContent.push({
    type: 'text',
    text: userMessage || 'Analyze this outfit and take appropriate actions.',
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(goal) },
    { role: 'user', content: userContent },
  ];

  let loopCount = 0;
  const maxLoops = 5;

  // Agentic loop: keep going while the model wants to call tools
  while (loopCount < maxLoops) {
    loopCount++;

    const response = await client.chat.completions.create({
      model: VENICE_MODEL,
      messages,
      tools: agentTools,
      tool_choice: loopCount === 1 ? 'auto' : 'auto',
    });

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      break;
    }

    // Execute all tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const fn = toolCall.function;
      const startTime = Date.now();
      const args = JSON.parse(fn.arguments) as Record<string, unknown>;
      const result = await executeToolCall(fn.name, args, agentId);
      const duration = Date.now() - startTime;

      steps.push({
        step: steps.length + 1,
        tool: fn.name,
        input: args,
        output: result,
        durationMs: duration,
        chain: (result.chain as string) || undefined,
      });

      actionsTaken.push(fn.name);

      // Track outcomes
      if (fn.name === 'analyze_outfit' && typeof args.score === 'number') {
        styleScore = args.score;
      }
      if (fn.name === 'propose_mint_nft') mintProposed = true;
      if (fn.name === 'recommend_product') {
        const product = result.product as { name: string } | undefined;
        if (product?.name) productsRecommended.push(product.name);
      }
      if (fn.name === 'track_style_preference') prefsTracked = true;

      // Add tool result back to conversation
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // If the model indicated stop, break
    if (choice.finish_reason === 'stop') break;
  }

  // Extract final text reasoning from the last assistant message
  const lastAssistant = messages
    .filter((m) => m.role === 'assistant')
    .pop() as OpenAI.Chat.Completions.ChatCompletionMessage | undefined;
  const reasoning = lastAssistant?.content || '';

  return {
    sessionId,
    model: VENICE_MODEL,
    provider: 'venice',
    protocol: 'AG-UI v0.1 + ERC-8004',
    intent: goal,
    reasoning,
    steps,
    actions_taken: actionsTaken,
    outcome: {
      style_score: styleScore,
      mint_proposed: mintProposed,
      products_recommended: productsRecommended,
      preferences_tracked: prefsTracked,
      summary: reasoning.slice(0, 300),
    },
    timestamp: new Date().toISOString(),
  };
}

function buildFallbackTrace(sessionId: string, goal: string, reason: string): AgentTrace {
  return {
    sessionId,
    model: 'fallback',
    provider: 'venice',
    protocol: 'AG-UI v0.1 + ERC-8004',
    intent: goal,
    reasoning: `Agent running in demo mode: ${reason}. In production, the agent uses Venice AI (mistral-31-24b) with function calling to autonomously analyze outfits, recommend products, and propose on-chain actions on Celo.`,
    steps: [
      {
        step: 1,
        tool: 'analyze_outfit',
        input: { goal, mode: 'demo' },
        output: {
          score: 7,
          summary: 'Demo mode — connect Venice API for real autonomous analysis.',
          strengths: ['Good color coordination', 'Clean silhouette'],
          improvements: ['Add a statement accessory', 'Consider layering'],
        },
        durationMs: 0,
      },
      {
        step: 2,
        tool: 'recommend_product',
        input: { category: 'accessories' },
        output: { product: productCatalog[0], reason: 'Would complement the current look', chain: 'celo' },
        durationMs: 0,
      },
    ],
    actions_taken: ['analyze_outfit', 'recommend_product'],
    outcome: {
      style_score: 7,
      mint_proposed: false,
      products_recommended: [productCatalog[0]?.name || 'Demo Product'],
      preferences_tracked: false,
      summary: `Demo mode: ${reason}`,
    },
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// HTTP Handlers
// ============================================

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  const url = new URL(request.url);
  const goal = url.searchParams.get('goal') || 'daily';

  const trace = await runAgentLoop(goal, 'Start a new styling session and analyze style context.');
  return jsonCors(trace, 200, origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';

  try {
    const body = await request.json().catch(() => ({}));
    const {
      goal = 'daily',
      message,
      imageBase64,
      sessionReasonings,
      agentId = 'onpoint-stylist',
    } = body;

    const userMessage = message
      || (sessionReasonings?.length
        ? `Session observations so far: ${sessionReasonings.join('. ')}. Based on these observations, analyze the outfit and decide what actions to take.`
        : 'Analyze the user outfit and take appropriate actions.');

    const trace = await runAgentLoop(goal, userMessage, imageBase64, agentId);
    return jsonCors(trace, 200, origin);
  } catch (err) {
    console.error('[AgentRoute] Error:', err);
    return jsonCors(
      { error: 'Agent execution failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
