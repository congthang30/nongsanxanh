import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { GeminiService, cosineSimilarity } from './gemini.service';

const SYSTEM_PROMPT = `Ban la tro ly ban hang cua "NongSan Xanh" - san TMDT nong san tuoi sach.
Nhiem vu: tu van san pham, gia, ton kho, chinh sach, huong dan dat hang, tra cuu don hang.
QUY TAC:
- LUON uu tien dung DU LIEU SAN PHAM / DON HANG duoc cung cap trong NGU CANH. Neu ngu canh co du lieu, PHAI tra loi cu the (ten, gia, don vi, ton kho), KHONG duoc tra loi chung chung kieu "ban vao website xem".
- Neu that su khong co du lieu, hay noi khong co thong tin va goi y lien he ho tro, KHONG bia dat.
- Tra loi ngan gon, than thien, bang tieng Viet, dinh dang ro rang (gach dau dong neu liet ke).
- Khong tra loi ngoai pham vi nong san/don hang.`;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  /** Nap 1 tai lieu kien thuc: chia chunk + tao embedding. */
  async ingestDocument(title: string, sourceType: string, content: string, sourceRef?: string) {
    const doc = await this.prisma.aiDocument.create({
      data: { title, sourceType, sourceRef, content },
    });
    const chunks = this.chunkText(content, 600);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.gemini.embed(chunks[i]);
      await this.prisma.aiDocumentChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: i,
          content: chunks[i],
          embedding: embedding.length ? embedding : undefined,
        },
      });
    }
    return { documentId: doc.id, chunks: chunks.length };
  }

  /** Tra loi 1 cau hoi: tool san pham/don hang -> retrieval -> generate. */
  async chat(params: {
    message: string;
    userId?: string;
    sessionId?: string;
    conversationId?: string;
  }) {
    const conversation = await this.getOrCreateConversation(
      params.conversationId,
      params.userId,
      params.sessionId,
    );

    await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: params.message },
    });

    // 0) TOOL san pham: tra loi deterministic tu DB (uu tien, khong phu thuoc quota LLM)
    const productAnswer = await this.answerProductQuery(params.message);

    // 1) Retrieval tu knowledge base
    const context = await this.retrieve(params.message);

    // 2) Tra cuu don hang neu user dang nhap + hoi ve don
    let orderContext = '';
    if (params.userId && /don|order|giao|ship|huy|trang thai/i.test(params.message)) {
      orderContext = await this.getOrderContext(params.userId);
    }

    // 3) Ngu canh san pham (de LLM tra loi cu the thay vi chung chung)
    const catalogContext = await this.getCatalogContext(params.message);

    const fullContext = [catalogContext, context, orderContext]
      .filter(Boolean)
      .join('\n\n');
    const userPrompt = fullContext
      ? `NGU CANH:\n${fullContext}\n\nCAU HOI: ${params.message}`
      : `CAU HOI: ${params.message}`;

    let answer = await this.gemini.generate(SYSTEM_PROMPT, userPrompt);

    // Neu LLM khong kha dung (chua cau hinh/loi/quota) nhung ta co cau tra loi
    // deterministic tu DB -> dung no de khong tra loi chung chung.
    if (productAnswer && this.isLlmFallback(answer)) {
      answer = productAnswer;
    }

    await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: answer },
    });

    return { conversationId: conversation.id, answer };
  }

  async history(conversationId: string) {
    return this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---- Product tools ----

  /** Nhan dien cau hoi san pham va tra loi truc tiep tu DB. Tra null neu khong khop. */
  private async answerProductQuery(message: string): Promise<string | null> {
    const norm = this.normalize(message);

    const listIntent =
      /(liet ke|danh sach|nhung san pham|cac san pham|san pham (nao|gi|dang co)|co (nhung )?san pham|ban (nhung )?gi|co gi|menu|catalog)/.test(
        norm,
      );
    const priceIntent = /\bgia\b|bao nhieu tien|gia bao nhieu|gia ca/.test(norm);
    const stockIntent =
      /con hang|con bao nhieu|ton kho|het hang|so luong|con khong/.test(norm);
    const shopIntent =
      /shop (nao|gi)|gian hang (nao|gi)|cua hang (nao|gi)|nha vuon (nao|gi)|ai ban|ban tu shop/.test(
        norm,
      );

    if (!listIntent && !priceIntent && !stockIntent && !shopIntent) return null;

    const products = await this.loadActiveProducts();
    if (products.length === 0) return null;

    // Liet ke san pham
    if (listIntent && !priceIntent && !stockIntent) {
      const lines = products.map(
        (p) =>
          `- ${p.name}: ${this.vnd(p.price)}${p.unit ? '/' + p.unit : ''}` +
          (p.shopName ? ` | shop ${p.shopName}` : '') +
          (p.available != null ? ` (con ${p.available})` : ''),
      );
      return `Hien tai NongSan Xanh dang co ${products.length} san pham:\n${lines.join('\n')}`;
    }

    // Tim san pham duoc nhac den (price/stock cu the)
    const matched = this.matchProduct(message, products);

    if (priceIntent) {
      if (matched) {
        return `Gia ${matched.name} la ${this.vnd(matched.price)}${matched.unit ? '/' + matched.unit : ''}.`;
      }
      // Hoi gia chung chung -> liet ke bang gia
      const lines = products.map(
        (p) => `- ${p.name}: ${this.vnd(p.price)}${p.unit ? '/' + p.unit : ''}`,
      );
      return `Bang gia cac san pham hien co:\n${lines.join('\n')}`;
    }

    if (stockIntent) {
      if (matched) {
        const avail = matched.available ?? 0;
        const shopText = matched.shopName ? ` tai shop ${matched.shopName}` : '';
        return avail > 0
          ? `${matched.name} dang con ${avail}${matched.unit ? ' ' + matched.unit : ''}${shopText}.`
          : `${matched.name} hien da het hang. Ban co the chon san pham khac nhe.`;
      }
      const inStock = products.filter((p) => (p.available ?? 0) > 0);
      const lines = inStock.map((p) => `- ${p.name}: con ${p.available}`);
      return inStock.length
        ? `Cac san pham con hang:\n${lines.join('\n')}`
        : 'Hien tat ca san pham tam het hang.';
    }

    if (shopIntent && matched) {
      if (!matched.shopName) {
        return `${matched.name} hien chua gan voi shop nao.`;
      }
      return `${matched.name} duoc ban tai shop "${matched.shopName}"${matched.shopRegion ? ` (giao tu ${matched.shopRegion})` : ''}. Gia ${this.vnd(matched.price)}${matched.unit ? '/' + matched.unit : ''}.`;
    }

    return null;
  }

  /** Ngu canh san pham (top khop) de bom vao prompt LLM. */
  private async getCatalogContext(message: string): Promise<string> {
    const norm = this.normalize(message);
    const productRelated =
      /(san pham|nong san|rau|cu|qua|trai cay|thit|ca|gia|ton kho|con hang|mua|dat|ban|shop|gian hang|cua hang)/.test(
        norm,
      );
    if (!productRelated) return '';
    const products = await this.loadActiveProducts();
    if (products.length === 0) return '';
    const lines = products.map(
      (p) =>
        `- ${p.name} | ${p.shopName ? 'shop ' + p.shopName + ' | ' : ''}gia ${this.vnd(p.price)}${p.unit ? '/' + p.unit : ''} | ton ${p.available ?? 0} | xuat xu ${p.originRegion ?? 'N/A'}`,
    );
    return `DANH MUC SAN PHAM HIEN CO (${products.length}):\n${lines.join('\n')}`;
  }

  private async loadActiveProducts() {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, deletedAt: null },
      include: {
        variants: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const result: {
      id: string;
      name: string;
      price: number;
      unit: string | null;
      originRegion: string | null;
      available: number | null;
      variantId: string | null;
      shopName: string | null;
      shopRegion: string | null;
    }[] = [];
    for (const p of products) {
      const v = p.variants[0];
      let available: number | null = null;
      if (v) {
        // Ton kha dung = tong ton tat ca cua hang trong chuoi
        const agg = await this.prisma.storeInventory.aggregate({
          where: { variantId: v.id, status: 'ACTIVE' },
          _sum: { quantityOnHand: true, reservedQuantity: true },
        });
        available =
          Number(agg._sum.quantityOnHand ?? 0) -
          Number(agg._sum.reservedQuantity ?? 0);
      }
      result.push({
        id: p.id,
        name: p.name,
        price: v?.price ?? 0,
        unit: v?.unit ?? null,
        originRegion: p.originRegion,
        available,
        variantId: v?.id ?? null,
        shopName: null,
        shopRegion: null,
      });
    }
    return result;
  }

  /** Khop san pham duoc nhac den trong cau hoi (token overlap, bo dau). */
  private matchProduct<T extends { name: string }>(
    message: string,
    products: T[],
  ): T | null {
    const msg = this.normalize(message);
    let best: { p: T; score: number } | null = null;
    for (const p of products) {
      const nameNorm = this.normalize(p.name);
      const tokens = nameNorm.split(' ').filter((t) => t.length >= 2);
      if (tokens.length === 0) continue;
      const hits = tokens.filter((t) => msg.includes(t)).length;
      const score = hits / tokens.length;
      // Yeu cau khop it nhat ~nua so token de tranh nham
      if (hits > 0 && (!best || score > best.score)) {
        best = { p, score };
      }
    }
    return best && best.score >= 0.5 ? best.p : null;
  }

  /** Cau tra loi nay co phai la fallback cua LLM (khong kha dung) khong. */
  private isLlmFallback(answer: string): boolean {
    const norm = this.normalize(answer);
    return (
      norm.includes('chua duoc cau hinh') ||
      norm.includes('chua the tra loi') ||
      norm.includes('co loi khi goi') ||
      norm.includes('chua co cau tra loi phu hop') ||
      norm.includes('thu lai sau')
    );
  }

  private vnd(n: number): string {
    return `${Math.round(n).toLocaleString('vi-VN')}d`;
  }

  // ---- internal ----
  private async getOrCreateConversation(id?: string, userId?: string, sessionId?: string) {
    if (id) {
      const existing = await this.prisma.aiConversation.findUnique({ where: { id } });
      if (existing) return existing;
    }
    return this.prisma.aiConversation.create({ data: { userId, sessionId } });
  }

  /** Retrieval: embed query, cosine voi cac chunk, lay top-k. Fallback keyword. */
  private async retrieve(query: string, k = 4): Promise<string> {
    const chunks = await this.prisma.aiDocumentChunk.findMany({
      include: { document: { select: { title: true } } },
    });
    if (chunks.length === 0) return '';

    const queryEmb = await this.gemini.embed(query);
    if (queryEmb.length > 0) {
      const scored = chunks
        .filter((c) => Array.isArray(c.embedding))
        .map((c) => ({
          c,
          score: cosineSimilarity(queryEmb, c.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      if (scored.length > 0) {
        return scored.map((s) => `[${s.c.document.title}] ${s.c.content}`).join('\n');
      }
    }

    // Fallback: keyword match (bo dau tieng Viet, cham diem theo token trung)
    const qTokens = Array.from(
      new Set(this.normalize(query).split(' ').filter((t) => t.length >= 3)),
    );
    if (qTokens.length === 0) return '';
    const scored = chunks
      .map((c) => {
        const norm = this.normalize(c.content);
        const hits = qTokens.filter((t) => norm.includes(t)).length;
        return { c, hits };
      })
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, k);
    return scored.map((s) => `[${s.c.document.title}] ${s.c.content}`).join('\n');
  }

  private async getOrderContext(userId: string): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: true },
    });
    if (orders.length === 0) return 'Khach hang chua co don hang nao.';
    return (
      'DON HANG GAN DAY CUA KHACH:\n' +
      orders
        .map(
          (o) =>
            `- ${o.orderNumber}: trang thai ${o.status}, tong ${o.grandTotal}d, ${o.items.length} san pham`,
        )
        .join('\n')
    );
  }

  /** Bo dau tieng Viet + lowercase de so khop khong phan biet dau. */
  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd')
      .toLowerCase();
  }

  private chunkText(text: string, size: number): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    const chunks: string[] = [];
    for (let i = 0; i < clean.length; i += size) {
      chunks.push(clean.slice(i, i + size));
    }
    return chunks.length ? chunks : [clean];
  }
}
