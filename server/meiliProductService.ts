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

export interface ProductDisplayConfig {
  websiteBaseUrl: string; // e.g. "https://bsb.mn"
  productUrlPattern: string; // e.g. "https://bsb.mn/product/{slug}"
  categoryUrlPattern: string; // e.g. "https://bsb.mn/category/{slug}"
  includeProductLink: boolean; // Барааны шууд линкийг хариултад оруулах
  includeCategoryLink: boolean; // Барааны ангиллын линкийг хариултад оруулах
  includePrice: boolean; // Үнэ, хямдралын мэдээллийг оруулах
  includeStock: boolean; // Бэлэн байгаа эсэх нөөцийг оруулах
  includeBrand: boolean; // Брэндийн нэр оруулах
  includeSpecs: boolean; // Техникийн гол үзүүлэлтүүд оруулах
  includeWarranty: boolean; // Баталгаат хугацааг дурдах
  includePromotions: boolean; // Бэлэгтэй худалдаа, урамшууллыг дурдах
  includeImage: boolean; // Зургийн линкийг оруулах
  linkStyle: 'markdown' | 'bracket' | 'plain' | 'button'; // Линкний формат: [Бараа үзэх](url), 🔗 Үзэх: url, гэх мэт
  outputFormatTemplate: 'rich' | 'standard' | 'compact' | 'category_focused'; // Хариултын бүтцийн загвар
}

export const DEFAULT_PRODUCT_CONFIG: ProductDisplayConfig = {
  websiteBaseUrl: 'https://bsb.mn',
  productUrlPattern: 'https://bsb.mn/products/by-code/{code}',
  categoryUrlPattern: 'https://bsb.mn/categories/{slug}',
  includeProductLink: true,
  includeCategoryLink: true,
  includePrice: true,
  includeStock: true,
  includeBrand: true,
  includeSpecs: true,
  includeWarranty: true,
  includePromotions: true,
  includeImage: false,
  linkStyle: 'markdown',
  outputFormatTemplate: 'category_focused',
};

export interface FormattedBsbProduct {
  id: number;
  code: string;
  productCode: string;
  name: string;
  brand: string;
  category: string;
  categorySlug?: string;
  categoryUrl?: string;
  url: string; // explicitly include the correct 'url' field from MeiliSearch document
  productUrl: string;
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
  warrantyMonth?: string;
  promotionsSummary?: string;
  siteRemainsSummary?: string;
  isService?: boolean;
}

export interface DetectedProductContext {
  exactCode?: string;
  detectedBrand?: string;
  detectedCategory?: string;
  categorySlug?: string;
  detectedSpecs?: string[];
  preciseQuery: string;
  isFollowUpQuery: boolean;
  originalQuery: string;
}

export interface ConversationMessageInput {
  sender?: string;
  text?: string;
  time?: string;
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

export const BSB_BRANDS: Array<{ name: string; aliases: string[] }> = [
  { name: 'Samsung', aliases: ['samsung', 'самсунг'] },
  { name: 'Apple', aliases: ['apple', 'аппл', 'айфон', 'iphone', 'ipad', 'айпад', 'macbook', 'макбүүк', 'airpods'] },
  { name: 'LG', aliases: ['lg', 'элжи'] },
  { name: 'Panasonic', aliases: ['panasonic', 'панасоник'] },
  { name: 'Sony', aliases: ['sony', 'сони', 'playstation', 'ps5'] },
  { name: 'Toshiba', aliases: ['toshiba', 'тошиба'] },
  { name: 'Electrolux', aliases: ['electrolux', 'электролюкс'] },
  { name: 'Philips', aliases: ['philips', 'phil', 'филипс'] },
  { name: 'Karcher', aliases: ['karcher', 'кэрхэр'] },
  { name: 'Delonghi', aliases: ['delonghi', 'делонги'] },
  { name: 'TCL', aliases: ['tcl'] },
  { name: 'Haier', aliases: ['haier', 'хайер'] },
  { name: 'Lenovo', aliases: ['lenovo', 'леново', 'ideapad', 'thinkpad'] },
  { name: 'Dell', aliases: ['dell', 'делл', 'inspiron', 'vostro'] },
  { name: 'Asus', aliases: ['asus', 'асус', 'zenbook', 'rog'] },
  { name: 'HP', aliases: ['hp', 'эйчпи', 'pavilion', 'envy'] },
  { name: 'Xiaomi', aliases: ['xiaomi', 'redmi', 'шаоми', 'редми'] },
  { name: 'Sharp', aliases: ['sharp', 'шарп'] },
  { name: 'Beko', aliases: ['beko', 'беко'] },
  { name: 'Midea', aliases: ['midea', 'мидеа'] },
  { name: 'Bosch', aliases: ['bosch', 'бош'] },
  { name: 'Tefal', aliases: ['tefal', 'тефал'] },
  { name: 'Rowenta', aliases: ['rowenta', 'ровента'] },
  { name: 'Tekpoint', aliases: ['tekpoint'] },
  { name: 'Luxell', aliases: ['luxell'] },
  { name: 'Vestel', aliases: ['vestel', 'vest'] },
  { name: 'Tecno', aliases: ['tecno', 'текно'] },
];

export const BSB_CATEGORIES: Array<{
  name: string;
  slug: string;
  keywords: string[];
  canonicalSearchTerm: string;
}> = [
  {
    name: 'Хөргөгч',
    slug: 'ref_two_doors',
    keywords: ['хөргөгч', 'хөлдөөгч', 'хөргүүр', 'хөргөгчний', 'refrigerator', 'fridge', 'freezer', 'side by side', '2 хаалгатай'],
    canonicalSearchTerm: 'хөргөгч',
  },
  {
    name: 'Угаалгын машин',
    slug: 'washing_machine',
    keywords: ['угаалгын машин', 'угаалга', 'угаагч', 'хатаагч', 'washing machine', 'washer', 'dryer', 'автомат угаалгын'],
    canonicalSearchTerm: 'угаалгын машин',
  },
  {
    name: 'Телевизор',
    slug: 'tv',
    keywords: ['зурагт', 'телевизор', 'тв', 'tv', 'oled', 'qled', 'led tv', 'smart tv', 'ухаалаг зурагт'],
    canonicalSearchTerm: 'зурагт',
  },
  {
    name: 'Гар утас',
    slug: 'mobile',
    keywords: ['гар утас', 'утас', 'смартфон', 'phone', 'smartphone', 'mobile', 'айфон', 'iphone', 'galaxy', 'redmi'],
    canonicalSearchTerm: 'гар утас',
  },
  {
    name: 'Компьютер, Ноутбук',
    slug: 'computer',
    keywords: ['ноутбук', 'зөөврийн компьютер', 'компьютер', 'laptop', 'notebook', 'macbook', 'зөөврийн', 'суурин компьютер', 'десктоп'],
    canonicalSearchTerm: 'ноутбук',
  },
  {
    name: 'Тоос сорогч',
    slug: 'vacuum_cleaner_washer',
    keywords: ['тоос сорогч', 'тоос сорогчийн', 'робот тоос сорогч', 'vacuum', 'cleaner'],
    canonicalSearchTerm: 'тоос сорогч',
  },
  {
    name: 'Плитк, зуух',
    slug: 'hob',
    keywords: ['плитка', 'плитк', 'индукц', 'зуух', 'шарах шүүгээ', 'печь', 'хийн плитк', 'hob', 'oven'],
    canonicalSearchTerm: 'плитк',
  },
  {
    name: 'Агаар цэвэршүүлэгч',
    slug: 'air_purifier_all',
    keywords: ['агаар цэвэршүүлэгч', 'агаар чийгшүүлэгч', 'шүүлтүүр', 'air purifier', 'purifier'],
    canonicalSearchTerm: 'агаар цэвэршүүлэгч',
  },
  {
    name: 'Будаа агшаагч',
    slug: 'rice_cooker',
    keywords: ['будаа агшаагч', 'битүү чанагч', 'rice cooker', 'pressure cooker'],
    canonicalSearchTerm: 'будаа агшаагч',
  },
  {
    name: 'Буйдан',
    slug: 'code_2287',
    keywords: ['буйдан', 'диван', 'булангийн буйдан', 'ор болдог буйдан', 'sofa', 'couch'],
    canonicalSearchTerm: 'буйдан',
  },
  {
    name: 'Ор, матрас',
    slug: 'code_23/bukh-tavilga/or',
    keywords: ['ор', 'матрас', 'унтлагын ор', 'bed', 'mattress'],
    canonicalSearchTerm: 'ор',
  },
  {
    name: 'Ширээ, сандал',
    slug: 'code_23/bukh-tavilga/shiree-sandal',
    keywords: ['ширээ', 'сандал', 'ажлын ширээ', 'хоолны ширээ', 'оффис ширээ', 'table', 'chair', 'desk'],
    canonicalSearchTerm: 'ширээ сандал',
  },
  {
    name: 'Данх, ус буцалгагч',
    slug: 'kettle',
    keywords: ['данх', 'ус буцалгагч', 'чайник', 'kettle'],
    canonicalSearchTerm: 'данх',
  },
  {
    name: 'Индүү',
    slug: 'iron',
    keywords: ['индүү', 'уурын индүү', 'iron', 'steamer'],
    canonicalSearchTerm: 'индүү',
  },
  {
    name: 'Чихэвч',
    slug: 'audio',
    keywords: ['чихэвч', 'airpods', 'earbuds', 'headphone', 'headset', 'чихэвчний'],
    canonicalSearchTerm: 'чихэвч',
  },
  {
    name: 'Кофе чанагч',
    slug: 'coffee_maker',
    keywords: ['кофе чанагч', 'кофе машин', 'espresso', 'coffee maker'],
    canonicalSearchTerm: 'кофе чанагч',
  },
];

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${this.meiliUrl}/indexes/${this.indexName}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: '', limit: 1 }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.totalProductsCount = data.estimatedTotalHits || data.totalHits || 7339;
        this.lastHealthCheck = Date.now();
        return { isConnected: true, totalProducts: this.totalProductsCount };
      }
      this.isConnected = false;
      return { isConnected: false, totalProducts: this.totalProductsCount };
    } catch {
      this.isConnected = false;
      return { isConnected: false, totalProducts: this.totalProductsCount };
    } finally {
      clearTimeout(timeout);
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
   * Intelligently detects product name, exact code, brand, category, or specifications
   * from the entire ongoing conversation history (customer + previous agent messages).
   */
  public detectConversationProductContext(
    query: string,
    conversation?: Array<{ sender?: string; text?: string }> | string[]
  ): DetectedProductContext {
    const rawQuery = (query || '').trim();
    const cleanQuery = this.extractCleanSearchQuery(rawQuery);

    // Normalize messages into a chronological list
    const messages: string[] = [];
    if (Array.isArray(conversation)) {
      for (const item of conversation) {
        if (typeof item === 'string' && item.trim()) {
          messages.push(item.trim());
        } else if (item && typeof (item as any).text === 'string' && (item as any).text.trim()) {
          messages.push((item as any).text.trim());
        }
      }
    }
    if (rawQuery && !messages.includes(rawQuery)) {
      messages.push(rawQuery);
    }

    let exactCode: string | undefined;
    let detectedBrand: string | undefined;
    let detectedCategoryObj: { name: string; slug: string; canonicalSearchTerm: string } | undefined;
    const detectedSpecs: string[] = [];

    // Scan backwards from newest to oldest message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const lower = msg.toLowerCase();

      // 1. Detect explicit product code like PANA-TH-65NX950M, APPL-MY373X, LG-GC-B277BPUM
      if (!exactCode) {
        const codeMatch = msg.match(/\b([A-Za-z0-9]{3,}-[A-Za-z0-9\-]+)\b/);
        if (codeMatch && !codeMatch[1].toLowerCase().includes('wi-fi') && codeMatch[1].length >= 5) {
          exactCode = codeMatch[1];
        }
      }

      // 2. Detect brand
      if (!detectedBrand) {
        for (const brand of BSB_BRANDS) {
          if (brand.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(lower))) {
            detectedBrand = brand.name;
            break;
          }
        }
      }

      // 3. Detect category
      if (!detectedCategoryObj) {
        for (const cat of BSB_CATEGORIES) {
          if (cat.keywords.some((kw) => lower.includes(kw))) {
            detectedCategoryObj = {
              name: cat.name,
              slug: cat.slug,
              canonicalSearchTerm: cat.canonicalSearchTerm,
            };
            break;
          }
        }
      }

      // 4. Detect specs (e.g. 55 инч, 65, 128gb, 256gb, 512gb, 1tb, 8кг, 2 хаалгатай, side by side, pro max)
      const specMatches = msg.match(/\b(32|43|50|55|65|75|85|128gb|256gb|512gb|1tb|64gb|7кг|8кг|9кг|10кг|7kg|8kg|9kg|10kg|pro|max|plus|ultra|air|oled|qled|2 хаалгатай|хоёр хаалгатай|side by side)\b/gi);
      if (specMatches) {
        for (const s of specMatches) {
          const norm = s.trim();
          if (!detectedSpecs.some((existing) => existing.toLowerCase() === norm.toLowerCase())) {
            detectedSpecs.push(norm);
          }
        }
      }
    }

    // Determine if query is a follow-up inquiry (e.g. "Үнэ нь хэд вэ?", "Бэлэн байна уу?", "55 инч нь", "Линк өгөөч")
    const isFollowUpPattern = /^(үнэ|хэд|хэдтэй|бэлэн|байгаа|байна|хямдрал|өнгө|загвар|үзэх|линк|холбоос|аль|аль нь|санал|мэдээлэл|хэмжээ|хүргэлт|лизинг|storepay)/i;
    const isFollowUpQuery =
      cleanQuery.length < 4 ||
      isFollowUpPattern.test(cleanQuery) ||
      cleanQuery === 'үнэ' ||
      cleanQuery === 'бэлэн' ||
      (detectedCategoryObj !== undefined && !cleanQuery.includes(detectedCategoryObj.canonicalSearchTerm) && cleanQuery.split(' ').length <= 2);

    let preciseQuery = cleanQuery;

    if (exactCode) {
      preciseQuery = exactCode;
    } else if (isFollowUpQuery || cleanQuery.length < 4) {
      // Build precise query from conversation context: Brand + Specs + Category
      const parts: string[] = [];
      if (detectedBrand) parts.push(detectedBrand);
      if (detectedSpecs.length > 0) parts.push(detectedSpecs.slice(0, 2).join(' '));
      if (detectedCategoryObj) {
        const currentStr = parts.join(' ').toLowerCase();
        if (!currentStr.includes(detectedCategoryObj.canonicalSearchTerm)) {
          parts.push(detectedCategoryObj.canonicalSearchTerm);
        }
      }
      preciseQuery = parts.join(' ').trim() || cleanQuery || rawQuery;
    } else {
      // If query has a specific product search like "iPhone 16" or "Karcher AD-4", keep it but enrich if brand is missing
      if (detectedBrand && !cleanQuery.toLowerCase().includes(detectedBrand.toLowerCase()) && !cleanQuery.toLowerCase().includes('iphone')) {
        preciseQuery = `${detectedBrand} ${cleanQuery}`.trim();
      } else {
        preciseQuery = cleanQuery;
      }
    }

    return {
      exactCode,
      detectedBrand,
      detectedCategory: detectedCategoryObj?.name,
      categorySlug: detectedCategoryObj?.slug,
      detectedSpecs,
      preciseQuery: preciseQuery || rawQuery,
      isFollowUpQuery,
      originalQuery: rawQuery,
    };
  }

  /**
   * Performs an intelligent, context-aware MeiliSearch query using product names,
   * product codes, or categories detected throughout the chat conversation history.
   */
  public async searchByConversation(
    query: string,
    conversation?: Array<{ sender?: string; text?: string }> | string[],
    options: {
      limit?: number;
      inStockOnly?: boolean;
      requirePhysicalProduct?: boolean;
      config?: ProductDisplayConfig;
    } = {}
  ): Promise<MeiliSearchResult & { detectedContext: DetectedProductContext }> {
    const detectedContext = this.detectConversationProductContext(query, conversation);

    // 1. Try search with precise query
    let result = await this.searchProducts(detectedContext.preciseQuery, options);

    // 2. If exact code was detected but yielded 0 results, try original query
    if (result.hits.length === 0 && detectedContext.exactCode && detectedContext.preciseQuery !== query) {
      result = await this.searchProducts(query, options);
    }

    // 3. If still 0 hits and a category was detected, search canonical category term
    if (result.hits.length === 0 && detectedContext.detectedCategory) {
      const catTerm = BSB_CATEGORIES.find((c) => c.name === detectedContext.detectedCategory)?.canonicalSearchTerm;
      if (catTerm) {
        const fallbackQ = detectedContext.detectedBrand ? `${detectedContext.detectedBrand} ${catTerm}` : catTerm;
        result = await this.searchProducts(fallbackQ, options);
      }
    }

    return {
      ...result,
      detectedContext,
    };
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
      config?: ProductDisplayConfig;
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
    let timeout: NodeJS.Timeout | null = null;

    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 8000);

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

      if (!response.ok) {
        console.warn(`[MeiliProductService] Search failed with status ${response.status}`);
        return { hits: [], total: 0, query: searchQuery, processingTimeMs: Date.now() - startTime };
      }

      const data = await response.json();
      const rawHits: any[] = data.hits || [];

      // If initial cleaned query yielded 0 results, try original query or first keywords
      let finalHits = rawHits;
      if (finalHits.length === 0 && searchQuery !== query.trim()) {
        try {
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackController.abort(), 4000);
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
            signal: fallbackController.signal,
          });
          clearTimeout(fallbackTimeout);

          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData.hits && fallbackData.hits.length > 0) {
              finalHits = fallbackData.hits;
            }
          }
        } catch {
          // Gracefully continue with original hits
        }
      }

      // Format hits
      let formatted = finalHits.map((h) => this.formatHit(h, options.config));

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
      const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
      if (isAbort) {
        console.warn(`[MeiliProductService] Search for "${searchQuery}" timed out or was cancelled, continuing gracefully.`);
      } else {
        console.warn(`[MeiliProductService] Search notice:`, err?.message || err);
      }
      return { hits: [], total: 0, query: searchQuery, processingTimeMs: Date.now() - startTime };
    } finally {
      if (timeout) clearTimeout(timeout);
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
  public formatHit(h: any, config?: ProductDisplayConfig): FormattedBsbProduct {
    // In MeiliSearch app_bsb_products index, the primary BSB item code is stored in `h.code` (or `h.variants[0].code`)
    const productCode = String(
      h.code ||
      h.productCode ||
      h.variants?.[0]?.code ||
      h.variants?.[0]?.productCode ||
      h.objectID ||
      ''
    ).trim().replace(/\/+$/, '');

    const rawName = h.translations?.mn_MN?.name || h.name || productCode || '';
    const brandName = h.brand?.name || (h.brand?.code ? String(h.brand.code).toUpperCase() : '-');
    const categoryName = h.mainTaxon?.name || h.productTaxons?.[0]?.name || 'Цахилгаан бараа';
    const categorySlug = h.mainTaxon?.slug || h.productTaxons?.[0]?.slug || h.mainTaxon?.code || '';

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

    const slug = h.slug || h.translations?.mn_MN?.slug || productCode;
    const baseUrl = (config?.websiteBaseUrl || 'https://bsb.mn').replace(/\/+$/, '');

    // Official BSB.mn product page route is https://bsb.mn/products/by-code/:productCode
    // Handle both new {code} and backward-compatible {slug} or custom patterns
    let prodPattern = config?.productUrlPattern || `${baseUrl}/products/by-code/{code}`;
    
    // Auto-heal legacy or invalid patterns containing singular /product/ or wrong placeholder
    if (prodPattern.includes('/product/{slug}') || prodPattern.endsWith('/product/{code}')) {
      prodPattern = prodPattern
        .replace('/product/{slug}', '/products/by-code/{code}')
        .replace('/product/{code}', '/products/by-code/{code}');
    }
    if (prodPattern.includes('/products/{slug}')) {
      prodPattern = prodPattern.replace('/products/{slug}', '/products/by-code/{code}');
    }
    if (prodPattern.endsWith('/product/')) {
      prodPattern = `${prodPattern}by-code/{code}`;
    }

    let productUrl = prodPattern
      .replace('{code}', productCode)
      .replace('{productCode}', productCode)
      .replace('{slug}', productCode || slug)
      .replace('{id}', String(h.id || h.objectID || ''));

    // Final safety check: if URL somehow still contains singular /product/ instead of /products/by-code/
    if (productUrl.includes('/product/') && !productUrl.includes('/products/')) {
      productUrl = productUrl.replace('/product/', '/products/by-code/');
    }
    if (productUrl.includes('/undefined')) {
      productUrl = productUrl.replace('/undefined', `/${productCode}`);
    }

    // Official BSB.mn category page route is https://bsb.mn/categories/:categorySlug
    let catPattern = config?.categoryUrlPattern || `${baseUrl}/categories/{slug}`;
    if (catPattern.includes('/category/{slug}') || catPattern.includes('/category/')) {
      catPattern = catPattern.replace('/category/', '/categories/');
    }

    let categoryUrl = categorySlug
      ? catPattern
          .replace('{slug}', categorySlug)
          .replace('{code}', h.mainTaxon?.code || categorySlug)
      : `${baseUrl}/categories`;

    if (categoryUrl.includes('/category/') && !categoryUrl.includes('/categories/')) {
      categoryUrl = categoryUrl.replace('/category/', '/categories/');
    }

    // Warranty
    const warrantyMonth = h.warrantyMonth ? `${h.warrantyMonth} сар` : undefined;

    // Promotions & Badges
    let promotionsSummary: string | undefined;
    if (Array.isArray(h.promotionBadge) && h.promotionBadge.length > 0) {
      promotionsSummary = h.promotionBadge.map((b: any) => b.badgeText || b.name).filter(Boolean).join(', ');
    } else if (Array.isArray(h.cartPromotions) && h.cartPromotions.length > 0) {
      promotionsSummary = h.cartPromotions.map((p: any) => p.name || p.code).filter(Boolean).join(', ');
    }

    // Site Remains (Store branch inventory)
    let siteRemainsSummary: string | undefined;
    const remains = h.siteRemains || primaryVariant.siteRemains;
    if (Array.isArray(remains) && remains.length > 0) {
      const positiveRemains = remains.filter((r: any) => r && r.qty > 0).slice(0, 3);
      if (positiveRemains.length > 0) {
        siteRemainsSummary = positiveRemains.map((r: any) => `${r.siteCode || 'Салбар'}: ${r.qty}ш`).join(', ');
      }
    }

    const isService =
      (productCode && productCode.includes('UGS')) ||
      (productCode && productCode.includes('Voucher')) ||
      rawName.includes('үйлчилгээ') ||
      rawName.includes('холбуулах');

    // Ensure official URL is explicitly provided from document or official BSB route
    const rawDocUrl = typeof h.url === 'string' && h.url.trim() ? h.url.trim() : null;
    const finalProductUrl = rawDocUrl || productUrl;

    return {
      id: h.id || Number(h.objectID) || 0,
      code: productCode,
      productCode: productCode,
      name: rawName.trim(),
      brand: brandName,
      category: categoryName,
      categorySlug,
      categoryUrl,
      url: finalProductUrl, // explicitly include the correct 'url' field from MeiliSearch document
      productUrl: finalProductUrl,
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
      slug,
      warrantyMonth,
      promotionsSummary,
      siteRemainsSummary,
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
   * Format products into a concise, structured section for the AI System Prompt
   * with exact link and category instructions tailored to the user's configuration.
   */
  public formatForPrompt(products: FormattedBsbProduct[], config?: ProductDisplayConfig): string {
    if (!products || products.length === 0) {
      return '';
    }

    const cfg = config || DEFAULT_PRODUCT_CONFIG;

    const itemsText = products
      .map((p, idx) => {
        const stockStr = p.inStock ? 'БЭЛЭН БАЙГАА' : 'Одоогоор нөөц дууссан';
        const priceStr = p.hasDiscount && p.originalPriceFormatted
          ? `${p.priceFormatted} (Хямдарсан, үндсэн үнэ: ${p.originalPriceFormatted}, -${p.promotionPercentage || ''}%)`
          : p.priceFormatted;

        const details: string[] = [];

        if (cfg.includeBrand !== false && p.brand && p.brand !== '-') {
          details.push(`Брэнд: ${p.brand}`);
        }
        details.push(`Барааны нэр: ${p.name}`);
        details.push(`Барааны код: ${p.productCode}`);

        if (cfg.includePrice !== false) {
          details.push(`Үнэ: ${priceStr}`);
        }

        if (cfg.includeStock !== false) {
          const remainInfo = p.siteRemainsSummary ? ` (Салбарууд: ${p.siteRemainsSummary})` : '';
          details.push(`Төлөв/Нөөц: ${stockStr}${remainInfo}`);
        }

        if (cfg.includeSpecs !== false && p.attributesSummary) {
          details.push(`Үзүүлэлтүүд: ${p.attributesSummary}`);
        }

        if (cfg.includeWarranty !== false && p.warrantyMonth) {
          details.push(`Баталгаат хугацаа: ${p.warrantyMonth}`);
        }

        if (cfg.includePromotions !== false && p.promotionsSummary) {
          details.push(`Урамшуулал/Бэлэг: ${p.promotionsSummary}`);
        }

        // Explicitly format the official 'url' field from MeiliSearch document
        if (cfg.includeProductLink !== false && p.url) {
          details.push(`Барааны албан ёсны холбоос ('url' талбар): ${p.url}`);
        }

        if (cfg.includeCategoryLink !== false && p.categoryUrl) {
          details.push(`Ангилал: ${p.category}`);
          details.push(`Ангиллын албан ёсны холбоос ('categoryUrl' талбар): ${p.categoryUrl}`);
        }

        return `[Бараа #${idx + 1}]\n${details.join('\n')}`;
      })
      .join('\n\n');

    // Dynamic formatting rules for AI
    const rules: string[] = [];
    if (cfg.includeProductLink !== false) {
      if (cfg.linkStyle === 'markdown') {
        rules.push('1. БАРААНЫ ШУУД ХОЛБООС (\'url\' талбар): Хэрэглэгчийн асуусан барааны хувьд дээрх "Барааны албан ёсны холбоос (\'url\' талбар)" дээр өгөгдсөн бодит хаягийг [Бараа үзэх](URL) эсвэл [Барааны нэр](URL) хэлбэрээр Markdown холбоос болгон заавал хавсаргана уу (URL дээр { } хаалт бичихгүй, яг хаягийг нь тавина).');
      } else if (cfg.linkStyle === 'plain') {
        rules.push('1. БАРААНЫ ШУУД ХОЛБООС (\'url\' талбар): Дээрх "Барааны албан ёсны холбоос (\'url\' талбар)" дээр өгөгдсөн хаягийг хариултандаа текстээр тодорхой зааж өгнө үү.');
      } else {
        rules.push('1. БАРААНЫ ШУУД ХОЛБООС (\'url\' талбар): Барааны холбоосыг 🔗 [Бараа үзэх](URL) хэлбэрээр хавсаргана уу.');
      }
    }

    if (cfg.includeCategoryLink !== false) {
      rules.push('2. АНГИЛЛЫН ХОЛБООС: Хэрэглэгчид тухайн төрөл/ангиллын бусад загваруудыг харах боломжийг олгож, ангиллын холбоосыг дээрх "Ангиллын албан ёсны холбоос (\'categoryUrl\' талбар)"-аас ашиглан [Ангилал: {Нэр}](URL) хэлбэрээр хариултын төгсгөлд санал болгоно уу.');
    }

    if (cfg.includeStock !== false) {
      rules.push('3. ТӨЛӨВ: Бараа бэлэн байгаа бол дэлгүүрт бэлэн байгааг, хэрэв нөөц дууссан бол түр дууссаныг тодорхой дурдана.');
    }

    rules.push('4. ХАТУУ ШААРДЛАГА: Зөвхөн дээр өгөгдсөн MeiliSearch баримтын бодит \'url\' талбарын хаягийг (https://bsb.mn/products/by-code/...) яг хуулж тавина. Өөрөө дур мэдэн буруу /product/ эсвэл ерөнхий холбоос зохиож ТАС ХОРИГЛОНО!');

    return `--- БСБ БАРААНЫ АЛБАН ЁСНЫ МЭДЭЭЛЛИЙН САН (MeiliSearch https://meili.bsb.mn) ---
${itemsText}

ХАРИУЛТЫН ФОРМАТЫН ТУСГАЙ ЗААВАР:
${rules.join('\n')}
--------------------------------------------------------------`;
  }

  /**
   * Sanitizes and guarantees that any URLs in AI response strictly conform
   * to official working BSB.mn links (/products/by-code/:code and /categories/:slug).
   */
  public sanitizeAiResponseLinks(
    aiContent: string,
    products: FormattedBsbProduct[],
    config?: ProductDisplayConfig
  ): string {
    if (!aiContent) return aiContent;

    let text = aiContent;

    // 0. Remove any accidental curly braces or quotes around URLs (e.g., ({https://...}) -> (https://...))
    text = text.replace(/\]\(\s*\{+(https?:\/\/[^}\s)]+)\}+\s*\)/g, ']($1)');
    text = text.replace(/\{+(https?:\/\/bsb\.mn\/[^}\s]+)\}+/g, '$1');

    // 1. Replace any markdown link [label](url) that has incorrect, generic, or hallucinated URL with the matched product's exact 'url'
    if (products.length > 0) {
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (fullMatch, label, url) => {
        // If it's already an exact official product url or category url from our hits
        if (products.some((p) => p.url === url || p.productUrl === url || p.categoryUrl === url)) {
          return fullMatch;
        }

        const lowerLabel = label.toLowerCase();
        // If label refers to category
        if ((lowerLabel.includes('ангилал') || lowerLabel.includes('төрөл')) && products[0].categoryUrl) {
          return `[${label}](${products[0].categoryUrl})`;
        }

        // Match against best fitting product
        const matched =
          products.find(
            (p) =>
              lowerLabel.includes(p.name.toLowerCase().slice(0, 15)) ||
              lowerLabel.includes(p.code.toLowerCase()) ||
              (p.brand && p.brand !== '-' && lowerLabel.includes(p.brand.toLowerCase()))
          ) || products[0];

        if (matched && matched.url) {
          return `[${label}](${matched.url})`;
        }

        return fullMatch;
      });
    }

    // 2. Fix any singular /product/ occurrences -> /products/by-code/
    text = text.replace(/https?:\/\/bsb\.mn\/product\/by-code\//gi, 'https://bsb.mn/products/by-code/');
    text = text.replace(/https?:\/\/bsb\.mn\/product\/([a-zA-Z0-9_\-]+)/gi, (_match, slugOrCode) => {
      // Find if slugOrCode corresponds to any matched product
      const found = products.find(
        (p) =>
          p.productCode.toLowerCase() === slugOrCode.toLowerCase() ||
          p.code.toLowerCase() === slugOrCode.toLowerCase() ||
          p.slug?.toLowerCase() === slugOrCode.toLowerCase()
      );
      if (found) {
        return found.url || `https://bsb.mn/products/by-code/${found.productCode}`;
      }
      if (products.length > 0 && products[0].productCode) {
        return products[0].url || `https://bsb.mn/products/by-code/${products[0].productCode}`;
      }
      return `https://bsb.mn/products/by-code/${slugOrCode}`;
    });

    // 3. Fix /products/ without /by-code/ if followed by product code
    text = text.replace(
      /https?:\/\/bsb\.mn\/products\/(?!by-code\/)([A-Za-z0-9]+-[A-Za-z0-9\-]+)/gi,
      'https://bsb.mn/products/by-code/$1'
    );

    // 4. Fix /undefined in product links
    if (products.length > 0 && products[0].productCode) {
      text = text.replace(
        /https?:\/\/bsb\.mn\/products\/by-code\/undefined/gi,
        products[0].url || `https://bsb.mn/products/by-code/${products[0].productCode}`
      );
    }

    // 5. Fix singular /category/ -> /categories/
    text = text.replace(/https?:\/\/bsb\.mn\/category\//gi, 'https://bsb.mn/categories/');

    // 6. Clean any trailing slashes inside product URLs before closing brackets or markdown
    text = text.replace(/(https?:\/\/bsb\.mn\/products\/by-code\/[A-Za-z0-9_\-]+)\/+([)\s*\]])/g, '$1$2');

    // 7. Ensure primary product link exists if enabled in config and products were found
    const cfg = config || DEFAULT_PRODUCT_CONFIG;
    if (cfg.includeProductLink !== false && products.length > 0 && products[0].url) {
      const primaryUrl = products[0].url;
      const hasUrlAlready = text.includes(primaryUrl) || text.includes(products[0].productCode);
      if (!hasUrlAlready && !text.includes('products/by-code/')) {
        text += `\n\n🛒 [${products[0].name} дэлгэрэнгүй үзэх](${primaryUrl})`;
      }
    }

    // 8. Ensure category link exists if enabled and not present
    if (cfg.includeCategoryLink !== false && products.length > 0 && products[0].categoryUrl) {
      const catUrl = products[0].categoryUrl;
      const hasCatAlready = text.includes(catUrl) || text.includes('/categories/');
      if (!hasCatAlready) {
        text += `\n📁 [Ангилал: ${products[0].category}](${catUrl})`;
      }
    }

    return text;
  }
}

export const meiliProductService = new MeiliProductService();
