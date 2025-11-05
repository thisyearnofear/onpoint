import OpenAI from "openai";

export class VeniceProvider {
    private client: OpenAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.venice.ai/api/v1",
        });
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Test the connection with a simple chat completion
            await this.client.chat.completions.create({
                model: "venice-lite",
                messages: [{ role: "user", content: "test" }],
                max_tokens: 1,
            });
            return true;
        } catch {
            return false;
        }
    }

    async generateOutfitImage(prompt: string): Promise<string> {
        try {
            const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "venice-sd35",
                    prompt: prompt,
                    width: 512,
                    height: 768, // Portrait aspect for fashion
                    format: "webp",
                    cfg_scale: 7,
                    steps: 20,
                }),
            });

            if (!response.ok) {
                throw new Error(`Venice API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.images || data.images.length === 0) {
                throw new Error("No image generated");
            }

            // Return the base64 encoded image
            return data.images[0];
        } catch (error) {
            console.error("Venice outfit generation error:", error);
            throw error;
        }
    }

    async analyzeFashionImage(imageBase64: string, prompt?: string): Promise<any> {
        try {
            const messages: any[] = [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt || `You are a fashion expert AI assistant. Analyze this image and provide a detailed fashion critique.

Please provide:
1. Description of the outfit (clothing items, style)
2. Color palette analysis
3. Fit assessment
4. Style coherence evaluation
5. Strengths of the look
6. Areas for improvement
7. Overall rating (1-10)

Be specific, honest, and provide actionable feedback.`,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ];

            const response = await this.client.chat.completions.create({
                model: "mistral-31-24b", // Vision-capable model
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
            });

            return {
                analysis: response.choices[0]?.message?.content || "Analysis unavailable",
            };
        } catch (error) {
            console.error("Venice fashion analysis error:", error);
            throw error;
        }
    }
}
