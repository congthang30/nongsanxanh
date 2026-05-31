import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Wrapper goi Gemini REST API (embedding + generate).
 * Dung global fetch (Node 18+). Key tu GEMINI_API_KEY.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly chatModel: string;
  private readonly embedModel: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    this.chatModel = this.config.get<string>('GEMINI_CHAT_MODEL', 'gemini-2.0-flash');
    this.embedModel = this.config.get<string>('GEMINI_EMBED_MODEL', 'text-embedding-004');
  }

  get enabled(): boolean {
    return !!this.apiKey;
  }

  /** Tao embedding cho 1 doan text. Tra ve [] neu chua cau hinh key. */
  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) return [];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embedModel}:embedContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.embedModel}`,
          content: { parts: [{ text }] },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Embed failed: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      return data.embedding?.values ?? [];
    } catch (e) {
      this.logger.warn(`Embed error: ${(e as Error).message}`);
      return [];
    }
  }

  /** Sinh cau tra loi tu prompt + context. */
  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    if (!this.apiKey) {
      return 'Tro ly AI chua duoc cau hinh (thieu GEMINI_API_KEY). Vui long lien he ho tro.';
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Generate failed: ${res.status}`);
        return 'Xin loi, hien tai toi chua the tra loi. Vui long thu lai sau.';
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        'Xin loi, toi chua co cau tra loi phu hop.'
      );
    } catch (e) {
      this.logger.warn(`Generate error: ${(e as Error).message}`);
      return 'Da co loi khi goi tro ly AI. Vui long thu lai sau.';
    }
  }
}

/** Cosine similarity giua 2 vector. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
