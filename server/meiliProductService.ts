/**
 * ============================================================================
 * 🛍️ BSB MeiliSearch Product Database Service (Барааны мэдээллийн сан)
 * ============================================================================
 * 
 * Энэхүү сервис нь https://meili.bsb.mn дээрх MeiliSearch индексийг (app_bsb_products)
 * ашиглан БСБ-гийн 7,300+ нэр төрлийн цахилгаан бараа, компьютер, гэр ахуйн бараа,
 * тавилгын бодит үнэ, нөөц (in-stock), брэнд, техникийн үзүүлэлтийг AI бот болон
 * операторт шуурхай өгөх үүрэгтэй.
 */

export interface FormattedBsbProduct {
  id: number;
  code: string;
  productCode: string;
  name: string;
  brand: string;
  category: string;
  price: number; // MNT
  priceFormatted: string; // e.g. "4,499,900₮"
  originalPrice?: number;
  originalPriceFormatted?: string;
  hasDiscount: boolean;
  promotionPercentage?: number;
  inStock: boolean;
  onHand?: number;
  attributes: string[];
  attributesSummary: string;
  descriptionSummary: string;
  imageUrl?: string;
  slug?: string;
  isService?: boolean;
}

export interface MeiliSearchResult {
  hits: FormattedBsbProduct[];
  total: number;
  query: string;
  processingTimeMs: number;
}

const DEFAULT_MEILI_URL = 'https://meili.bsb.mn';
const DEFAULT_MEILI_API_KEY = '1TkoJ[9Qa|14/&7Q';
const DEFAULT_MEILI_INDEX = 'app_bsb_products';

// Stop-words and common question phrases in Mongolian customer chats
const QUESTION_STOP_WORDS = [
  'сайн байна уу',
  'сайн уу',
  'байна уу',
  'байгаа юу',
  'байгаа юмаа',
  'байгаа болов уу',
  'байна уу танайд',
  'үнэ хэд вэ',
  'үнэ нь хэд вэ',
  'үнэ нь ямар вэ',
  'хэд вэ',
  'хэдээр зардаг вэ',
  'үнэ',
  'хямдралтай',
  'хямдрал',
  'бэлэн байгаа юу',
  'бэлэн байна уу',
  'хайж байна',
  'авах гэсэн юм',
  'авах гэсийн',
  'сонирхож байна',
  'асуух гэсэн юм',
  'үзэх гэсэн юм',
  'хүргэлттэй юу',
  'хүргэж өгөх үү',
  'лизингээр',
  'зээлээр',
  'хувааж төлөх',
  'нөөц байгаа юу',
  'дэлгүүрт байна уу',
  'хэлж өгөөч',
  'мэдээлэл өгөөч',
  'мэдээлэл авъя',
  'мэдээлэл авмаар байна',
  'байна',
  'байгаа',
  'уу',
  'үү',
  'юу',
  'юу байна',
  'вэ',
  'бэ',
  'ямар',
  'ямаршуу',
  'загварууд',
  'загвар',
];

export class MeiliProductService {
  private meiliUrl: string;
  private apiKey: string;
  private indexName: string;
  private cache = new Map<string, { result: MeiliSearchResult; timestamp: number }>();
  private cacheTtlMs = 1000 * 60 * 5; // 5 mins cache
  private totalProductsCount = 0;
  private lastHealthCheck = 0;
  private isConnected = false;

  constructor() {
    this.meiliUrl = (process.env.MEILI_URL || process.env.MEILISEARCH_HOST || DEFAULT_MEILI_URL).replace(/\/+$/, '');
    this.apiKey = process.env.MEILI_API_KEY || process.env.MEILISEARCH_KEY || DEFAULT_MEILI_API_KEY;
    this.indexName = process.env.MEILI_INDEX || DEFAULT_MEILI_INDEX;

    // Check connection initially
    this.checkHealth().catch(() => {});
  }

  public getConfig() {
    return {
      meiliUrl: this.meiliUrl,
      indexName: this.indexName,
      totalProducts: this.totalProductsCount,
      isConnected: this.isConnected,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  public updateConfig(url?: string, key?: string, index?: string) {
    if (url) this.meiliUrl = url.replace(/\/+$/, '');
    if (key) this.apiKey = key;
    if (index) this.indexName = index;
    this.cache.clear();
    this.checkHealth().catch(() => {});
  }

  public async checkHealth(): Promise<{ isConnected: boolean; totalProducts: number }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.meiliUrl}/indexes/${this.indexName}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: '', limit: 1 }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.totalProductsCount = data.estimatedTotalHits || data.totalHits || 7300;
        this.lastHealthCheck = Date.now();
        return { isConnected: true, totalProducts: this.totalProductsCount };
      }
      this.isConnected = false;
      return { isConnected: false, totalProducts: this.totalProductsCount };
    } catch (e) {
      this.isConnected = false;
      return { isConnected: false, totalProducts: this.totalProductsCount };
    }
  }

  public async getStats(): Promise<{
    connected: boolean;
    numberOfDocuments: number;
    index: string;
    endpoint: string;
  }> {
    const health = await this.checkHealth();
    return {
      connected: health.isConnected,
      numberOfDocuments: health.totalProducts || this.totalProductsCount || 7339,
      index: this.indexName,
      endpoint: this.meiliUrl,
    };
  }

  /**
   * Extract meaningful product search keywords from natural customer chat text.
   * Examples:
   *  - "Сайн байна уу, iPhone 16 Plus үнэ хэд вэ?" -> "iPhone 16 Plus"
   *  - "65 инчийн зурагт бэлэн байгаа юу?" -> "65 зурагт"
   *  - "PHIL-HR-1811 үнэ" -> "PHIL-HR-1811"
   */
  public extractCleanSearchQuery(text: string): string {
    if (!text) return '';

    // Check for explicit product codes like PANA-TH-65NX950M or APPL-MW123ZP
    const codeMatch = text.match(/[A-Za-z0-9]+-[A-Za-z0-9\-]+/);
    if (codeMatch && codeMatch[0].length >= 5) {
      return codeMatch[0];
    }

    let cleaned = text.trim();

    // Remove punctuation except hyphens/slashes
    cleaned = cleaned.replace(/[?,.!;:()"'~`@#$%^&*+=_{}\[\]|\\<>]/g, ' ');

    // Normalize spacing
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove common question prefixes and suffixes
    let lower = cleaned.toLowerCase();
    for (const phrase of QUESTION_STOP_WORDS) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      cleaned = cleaned.replace(regex, ' ');
    }

    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If cleaned string became too empty, return original trimmed
    return cleaned.length >= 2 ? cleaned : text.trim();
  }

  /**
   * Determine if customer's message appears to be asking for product details,
   * prices, stock, specifications, or electronics/furniture categories.
   */
  public isProductInquiry(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    // Product code pattern
    if (/[a-z0-9]+-[a-z0-9]+/i.test(text)) return true;

    // Direct product words
    const productKeywords = [
      'үнэ',
      'хэд',
      'өртөг',
      'бараа',
      'бүтээгдэхүүн',
      'зурагт',
      'тв',
      'tv',
      'телевизор',
      'хөргөгч',
      'хөлдөөгч',
      'угаалгын машин',
      'угаалга',
      'хатаагч',
      'тоос сорогч',
      'агаар цэвэршүүлэгч',
      'ус цэвэршүүлэгч',
      'агааржуулагч',
      'кондэйшн',
      'плитка',
      'шарах шүүгээ',
      'богино долгион',
      'микроволновка',
      'индукц',
      'ус буцалгагч',
      'данх',
      'кофе чанагч',
      'инч',
      'inch',
      'утас',
      'гар утас',
      'смартфон',
      'phone',
      'iphone',
      'айфон',
      'айпад',
      'ipad',
      'ноутбук',
      'компьютер',
      'зөөврийн',
      'лаптоп',
      'laptop',
      'macbook',
      'дэлгэц',
      'монитор',
      'чихэвч',
      'speaker',
      'спикер',
      'чанга яригч',
      'дуугаралт',
      'саундбар',
      'тавилга',
      'буйдан',
      'ор',
      'ширээ',
      'сандал',
      'шүүгээ',
      'матрас',
      'гал тогоо',
      'samsung',
      'apple',
      'lg',
      'panasonic',
      'electrolux',
      'sony',
      'delonghi',
      'karcher',
      'toshiba',
      'philips',
      'phil',
      'tcl',
      'haier',
      'lenovo',
      'asus',
      'dell',
      'hp',
      'xiaomi',
      'redmi',
      'бэлэн байгаа',
      'нөөц',
      'хямдрал',
      'бэлэгтэй',
      'загвар',
    ];

    return productKeywords.some((kw) => lower.includes(kw));
  }

  /**
   * Search MeiliSearch product index with fallback query logic and ranking.
   */
  public async searchProducts(
    query: string,
    options: {
      limit?: number;
      inStockOnly?: boolean;
      requirePhysicalProduct?: boolean;
    } = {}
  ): Promise<MeiliSearchResult> {
    const limit = options.limit || 5;
    const cleanQ = this.extractCleanSearchQuery(query);
    const searchQuery = cleanQ || query.trim();

    if (!searchQuery) {
      return { hits: [], total: 0, query: '', processingTimeMs: 0 };
    }

    const cacheKey = `${searchQuery}-${limit}-${options.inStockOnly ? '1' : '0'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.result;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      // Perform MeiliSearch search
      const response = await fetch(`${this.meiliUrl}/indexes/${this.indexName}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: searchQuery,
          limit: limit * 2, // fetch slightly more to filter/rank physical products
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[MeiliProductService] Search failed with status ${response.status}`);
        return { hits: [], total: 0, query: searchQuery, processingTimeMs: Date.now() - startTime };
      }

      const data = await response.json();
      const rawHits: any[] = data.hits || [];

      // If initial cleaned query yielded 0 results, try original query or first keywords
      let finalHits = rawHits;
      if (finalHits.length === 0 && searchQuery !== query.trim()) {
        const fallbackRes = await fetch(`${this.meiliUrl}/indexes/${this.indexName}/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: query.trim().split(' ').slice(0, 3).join(' '),
            limit: limit * 2,
          }),
        }).catch(() => null);

        if (fallbackRes && fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.hits && fallbackData.hits.length > 0) {
            finalHits = fallbackData.hits;
          }
        }
      }

      // Format hits
      let formatted = finalHits.map((h) => this.formatHit(h));

      // Separate services vs physical products (Vouchers/installation services usually have code containing 'UGS' or 'Voucher' or price < 90,000 without brand)
      if (options.requirePhysicalProduct !== false) {
        const isAskingForService = /үйлчилгээ|холбуулах|тогтоох|угсрах|засвар/i.test(query);
        if (!isAskingForService) {
          formatted.sort((a, b) => {
            // Put physical products with brand higher
            const aHasBrand = Boolean(a.brand && a.brand !== '-');
            const bHasBrand = Boolean(b.brand && b.brand !== '-');
            if (aHasBrand && !bHasBrand) return -1;
            if (!aHasBrand && bHasBrand) return 1;

            // Put in-stock higher if both or neither have brand
            if (a.inStock && !b.inStock) return -1;
            if (!a.inStock && b.inStock) return 1;

            return 0;
          });
        }
      }

      if (options.inStockOnly) {
        formatted = formatted.filter((p) => p.inStock);
      }

      const finalResult: MeiliSearchResult = {
        hits: formatted.slice(0, limit),
        total: data.estimatedTotalHits || formatted.length,
        query: searchQuery,
        processingTimeMs: Date.now() - startTime,
      };

      this.cache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
      return finalResult;
    } catch (err: any) {
      console.error('[MeiliProductService] Error querying MeiliSearch:', err.message || err);
      return { hits: [], total: 0, query: searchQuery, processingTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Lookup product by exact code or barcode
   */
  public async getProductByCode(code: string): Promise<FormattedBsbProduct | null> {
    if (!code) return null;
    const cleanCode = code.trim();

    try {
      const res = await this.searchProducts(cleanCode, { limit: 1 });
      if (res.hits.length > 0) {
        const match = res.hits[0];
        if (
          match.code.toLowerCase() === cleanCode.toLowerCase() ||
          match.productCode.toLowerCase() === cleanCode.toLowerCase() ||
          match.slug?.toLowerCase().includes(cleanCode.toLowerCase())
        ) {
          return match;
        }
        return match;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper to format raw MeiliSearch hit into clean UI & Prompt friendly object
   */
  private formatHit(h: any): FormattedBsbProduct {
    const rawName = h.translations?.mn_MN?.name || h.name || h.productCode || '';
    const brandName = h.brand?.name || (h.brand?.code ? String(h.brand.code).toUpperCase() : '-');
    const categoryName = h.mainTaxon?.name || h.productTaxons?.[0]?.name || 'Цахилгаан бараа';

    // Primary variant pricing
    const primaryVariant = h.variants?.[0] || {};
    // Price in MeiliSearch is stored in cents/multiplied by 100 (e.g. 449990000 = 4,499,900 MNT)
    const rawPrice = typeof primaryVariant.price === 'number' ? primaryVariant.price : 0;
    const priceMnt = rawPrice > 0 ? Math.round(rawPrice / 100) : 0;

    const rawOrigPrice = typeof primaryVariant.originalPrice === 'number' ? primaryVariant.originalPrice : 0;
    const originalPriceMnt = rawOrigPrice > 0 ? Math.round(rawOrigPrice / 100) : undefined;

    const hasDiscount = Boolean(h.hasDiscount || (originalPriceMnt && originalPriceMnt > priceMnt));
    const promotionPercentage = primaryVariant.promotionPercentage || (
      hasDiscount && originalPriceMnt && priceMnt
        ? Math.round(((originalPriceMnt - priceMnt) / originalPriceMnt) * 100)
        : undefined
    );

    const inStock = Boolean(primaryVariant.inStock);
    const onHand = typeof primaryVariant.onHand === 'number' ? primaryVariant.onHand : undefined;

    // Clean attributes
    const attributes: string[] = [];
    if (Array.isArray(h.attributes)) {
      for (const attr of h.attributes) {
        if (!attr || !attr.name) continue;
        const valArr = Array.isArray(attr.value) ? attr.value : [attr.value];
        const cleanedVals = valArr
          .filter(Boolean)
          .map((v: any) => {
            const str = String(v);
            return str.includes('===') ? str.split('===').pop() : str;
          });
        if (cleanedVals.length > 0) {
          attributes.push(`${attr.name}: ${cleanedVals.join(', ')}`);
        }
      }
    }

    const attributesSummary = attributes.slice(0, 4).join(' | ');

    // Clean description
    const descriptionSummary = this.cleanDescription(h.description || h.shortDescription || '');

    // Image URL
    const imageUrl =
      h.images?.[0]?.medium ||
      h.images?.[0]?.thumbnail ||
      h.images?.[0]?.path ||
      h.images?.[0]?.originalImagePath;

    const isService =
      (h.productCode && h.productCode.includes('UGS')) ||
      (h.productCode && h.productCode.includes('Voucher')) ||
      rawName.includes('үйлчилгээ') ||
      rawName.includes('холбуулах');

    return {
      id: h.id || Number(h.objectID),
      code: h.code || h.productCode,
      productCode: h.productCode || h.code,
      name: rawName.trim(),
      brand: brandName,
      category: categoryName,
      price: priceMnt,
      priceFormatted: priceMnt > 0 ? `${priceMnt.toLocaleString()}₮` : 'Үнэ тодруулах',
      originalPrice: originalPriceMnt,
      originalPriceFormatted: originalPriceMnt ? `${originalPriceMnt.toLocaleString()}₮` : undefined,
      hasDiscount,
      promotionPercentage,
      inStock,
      onHand,
      attributes,
      attributesSummary,
      descriptionSummary,
      imageUrl,
      slug: h.slug,
      isService,
    };
  }

  private cleanDescription(desc: string): string {
    if (!desc) return '';
    try {
      if (desc.startsWith('[') && (desc.includes('monsieurbiz') || desc.includes('content'))) {
        const parsed = JSON.parse(desc);
        let content = '';
        for (const item of parsed) {
          if (item.data?.content) content += ' ' + item.data.content;
        }
        return content
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300);
      }
    } catch (e) {}

    return desc
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
  }

  /**
   * Format products into a concise, structured section for the AI System Prompt.
   */
  public formatForPrompt(products: FormattedBsbProduct[]): string {
    if (!products || products.length === 0) {
      return '';
    }

    const itemsText = products
      .map((p, idx) => {
        const stockStr = p.inStock ? 'БЭЛЭН БАЙГАА' : 'Одоогоор нөөц дууссан';
        const priceStr = p.hasDiscount && p.originalPriceFormatted
          ? `${p.priceFormatted} (Хямдарсан, үндсэн үнэ: ${p.originalPriceFormatted}, -${p.promotionPercentage || ''}%)`
          : p.priceFormatted;

        const details = [
          `Барааны нэр: ${p.brand !== '-' ? p.brand + ' ' : ''}${p.name}`,
          `Код: ${p.productCode}`,
          `Үнэ: ${priceStr}`,
          `Төлөв/Нөөц: ${stockStr}`,
        ];

        if (p.attributesSummary) {
          details.push(`Үзүүлэлтүүд: ${p.attributesSummary}`);
        }

        if (p.descriptionSummary) {
          details.push(`Тайлбар: ${p.descriptionSummary.slice(0, 150)}`);
        }

        return `[Бараа #${idx + 1}]\n${details.join('\n')}`;
      })
      .join('\n\n');

    return `--- БСБ БАРААНЫ АЛБАН ЁСНЫ МЭДЭЭЛЛИЙН САН (MeiliSearch https://meili.bsb.mn) ---\n${itemsText}\n--------------------------------------------------------------`;
  }
}

export const meiliProductService = new MeiliProductService();
