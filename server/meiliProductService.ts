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

export const MEILI_INDICES = {
  PRODUCTS: 'app_bsb_products',
  ATTRIBUTES: 'app_bsb_attributes',
  BRANDS: 'app_bsb_brands',
  PRODUCT_TERMS: 'app_bsb_product_terms',
  TAXONS: 'app_bsb_taxons',
} as const;

export interface BsbProductTerm {
  id: number;
  name: string;
  type: 'return_term' | 'delivery_term' | 'delivery_payment_term' | string;
  description: string;
  content: string;
  plainContent?: string;
}

export interface BsbBrand {
  id: number;
  code: string;
  name: string;
  totalProducts: number;
  taxons: string[];
  featured?: boolean;
  images?: Array<{ id: number; type: string; path: string; thumbnail?: string; large?: string }>;
}

export interface BsbTaxon {
  id: number;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  productTotal: number;
  parentCode?: string | null;
  parent?: string | null;
  images?: Array<{ id: number; type: string | null; path: string; thumbnail?: string; medium?: string }>;
}

export interface BsbAttribute {
  id: number;
  code: string;
  name: string;
  type: string;
  position?: number;
  configuration?: string[];
}

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
    keywords: [
      'хөргөгч',
      'хөлдөөгч',
      'хөргүүр',
      'хөргөгчний',
      'refrigerator',
      'fridge',
      'freezer',
      'side by side',
      '2 хаалгатай',
      'khorgoogch',
      'khorgogch',
      'horgoogch',
      'kholdoogch',
      'holdoogch',
    ],
    canonicalSearchTerm: 'хөргөгч',
  },
  {
    name: 'Угаалгын машин',
    slug: 'washing_machine',
    keywords: [
      'угаалгын машин',
      'угаалгын',
      'угаалга',
      'угаагч',
      'угаах машин',
      'угаалгын машины',
      'угаалгын машинууд',
      'автомат угаалгын',
      'бүрэн автомат',
      'хагас автомат',
      'хатаагч',
      'хувцас хатаагч',
      'washing machine',
      'washer',
      'dryer',
      'ugaalgin mashin',
      'ugaalgiin mashin',
      'ugaalgyn mashin',
      'ugaalga',
      'ugaagch',
      'ugaah mashin',
    ],
    canonicalSearchTerm: 'угаалгын машин',
  },
  {
    name: 'Телевизор',
    slug: 'tv',
    keywords: [
      'зурагт',
      'телевизор',
      'тв',
      'tv',
      'oled',
      'qled',
      'led tv',
      'smart tv',
      'ухаалаг зурагт',
      'zuragt',
      'televizor',
      'tivi',
    ],
    canonicalSearchTerm: 'зурагт',
  },
  {
    name: 'Гар утас',
    slug: 'mobile',
    keywords: [
      'гар утас',
      'утас',
      'смартфон',
      'phone',
      'smartphone',
      'mobile',
      'айфон',
      'iphone',
      'galaxy',
      'redmi',
      'gar utas',
      'utas',
      'smartfon',
    ],
    canonicalSearchTerm: 'гар утас',
  },
  {
    name: 'Компьютер, Ноутбук',
    slug: 'computer',
    keywords: [
      'ноутбук',
      'зөөврийн компьютер',
      'компьютер',
      'laptop',
      'notebook',
      'macbook',
      'зөөврийн',
      'суурин компьютер',
      'десктоп',
      'noutbuk',
      'nootbuk',
      'zeevriin kom',
    ],
    canonicalSearchTerm: 'зөөврийн компьютер',
  },
  {
    name: 'Тоос сорогч',
    slug: 'vacuum_cleaner_washer',
    keywords: [
      'тоос сорогч',
      'тоос сорогчийн',
      'робот тоос сорогч',
      'vacuum',
      'cleaner',
      'toos sorogch',
      'toosorogch',
      'toos sorogchiin',
    ],
    canonicalSearchTerm: 'тоос сорогч',
  },
  {
    name: 'Плитк, зуух',
    slug: 'hob',
    keywords: [
      'плитка',
      'плитк',
      'индукц',
      'зуух',
      'шарах шүүгээ',
      'печь',
      'хийн плитк',
      'hob',
      'oven',
      'plitka',
      'plitk',
      'zuukh',
      'zuuh',
      'indukts',
    ],
    canonicalSearchTerm: 'плитк',
  },
  {
    name: 'Агаар цэвэршүүлэгч',
    slug: 'air_purifier_all',
    keywords: [
      'агаар цэвэршүүлэгч',
      'агаар чийгшүүлэгч',
      'шүүлтүүр',
      'air purifier',
      'purifier',
      'agaar tsevershuulegch',
      'agaar chiigshuulegch',
    ],
    canonicalSearchTerm: 'агаар цэвэршүүлэгч',
  },
  {
    name: 'Будаа агшаагч',
    slug: 'rice_cooker',
    keywords: [
      'будаа агшаагч',
      'битүү чанагч',
      'rice cooker',
      'pressure cooker',
      'budaa agshaagch',
    ],
    canonicalSearchTerm: 'будаа агшаагч',
  },
  {
    name: 'Буйдан',
    slug: 'category_2287?has_stock=true',
    keywords: ['буйдан', 'диван', 'булангийн буйдан', 'ор болдог буйдан', 'sofa', 'couch', 'buidan', 'buidang', 'divan'],
    canonicalSearchTerm: 'буйдан',
  },
  {
    name: 'Ор, матрас',
    slug: 'code_23/bukh-tavilga/or',
    keywords: ['ор', 'матрас', 'унтлагын ор', 'bed', 'mattress', 'or', 'matras', 'untlagiin or'],
    canonicalSearchTerm: 'ор',
  },
  {
    name: 'Ширээ, сандал',
    slug: 'code_23/bukh-tavilga/shiree-sandal',
    keywords: ['ширээ', 'сандал', 'ажлын ширээ', 'хоолны ширээ', 'оффис ширээ', 'table', 'chair', 'desk', 'shiree', 'sandal'],
    canonicalSearchTerm: 'ширээ сандал',
  },
  {
    name: 'Данх, ус буцалгагч',
    slug: 'kettle',
    keywords: ['данх', 'ус буцалгагч', 'чайник', 'kettle', 'dankh', 'danh', 'chainik'],
    canonicalSearchTerm: 'данх',
  },
  {
    name: 'Индүү',
    slug: 'iron',
    keywords: ['индүү', 'уурын индүү', 'iron', 'steamer', 'induu', 'indvv'],
    canonicalSearchTerm: 'индүү',
  },
  {
    name: 'Чихэвч',
    slug: 'audio',
    keywords: ['чихэвч', 'airpods', 'earbuds', 'headphone', 'headset', 'чихэвчний', 'chikhevch', 'chihevch'],
    canonicalSearchTerm: 'чихэвч',
  },
  {
    name: 'Кофе чанагч',
    slug: 'coffee_maker',
    keywords: ['кофе чанагч', 'кофе машин', 'espresso', 'coffee maker', 'kofe chanagch', 'kofe mashin'],
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
  'хайж байгаа',
  'хайхаар',
  'гээд хайхаар',
  'хайх',
  'хайя',
  'харах',
  'харъя',
  'үзье',
  'үзүүлээч',
  'линк',
  'линкийг',
  'линк өгөөч',
  'линк байна уу',
  'холбоос',
  'холбоосыг',
  'холбоос өгөөч',
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
  'мэдээлэл',
  'зөвлөгөө',
  'санал болгох',
  'санал болгооч',
  'сонголт',
  'сонголтууд',
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
  private cachedTerms: BsbProductTerm[] | null = null;
  private termsCacheTime = 0;
  private cachedBrands: BsbBrand[] | null = null;
  private brandsCacheTime = 0;
  private cachedTaxons: BsbTaxon[] | null = null;
  private taxonsCacheTime = 0;

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
      indices: MEILI_INDICES,
    };
  }

  public updateConfig(url?: string, key?: string, index?: string) {
    if (url) this.meiliUrl = url.replace(/\/+$/, '');
    if (key) this.apiKey = key;
    if (index) this.indexName = index;
    this.cache.clear();
    this.cachedTerms = null;
    this.cachedBrands = null;
    this.cachedTaxons = null;
    this.checkHealth().catch(() => {});
  }

  public htmlToCleanText(html: string): string {
    if (!html) return '';
    let text = html;
    text = text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
    text = text.replace(/<ol[^>]*>/gi, '\n').replace(/<\/ol>/gi, '\n');
    text = text.replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, () => '• ').replace(/<\/li>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '$1');
    text = text.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    return text;
  }

  /**
   * Generic MeiliSearch query helper for any index
   */
  public async queryIndex<T = any>(
    indexName: string,
    params: { q?: string; limit?: number; filter?: string | string[]; offset?: number }
  ): Promise<{ hits: T[]; estimatedTotalHits: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${this.meiliUrl}/indexes/${indexName}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: params.q || '',
          limit: params.limit !== undefined ? params.limit : 20,
          filter: params.filter,
          offset: params.offset || 0,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`MeiliSearch index ${indexName} error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return {
        hits: (data.hits || []) as T[],
        estimatedTotalHits: data.estimatedTotalHits || data.totalHits || (data.hits?.length || 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch all 3 official BSB Product Terms (Буцаалтын нөхцөл, Хүргэлтийн нөхцөл, Хүргэлтийн төлбөр авах нөхцөл)
   * from MeiliSearch index `app_bsb_product_terms`.
   */
  public async getProductTerms(forceRefresh = false): Promise<BsbProductTerm[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTerms && now - this.termsCacheTime < 1000 * 60 * 30) {
      return this.cachedTerms;
    }

    try {
      const result = await this.queryIndex<BsbProductTerm>(MEILI_INDICES.PRODUCT_TERMS, {
        q: '',
        limit: 10,
      });

      const formatted = result.hits.map((item) => ({
        ...item,
        plainContent: this.htmlToCleanText(item.content),
      }));

      this.cachedTerms = formatted;
      this.termsCacheTime = now;
      return formatted;
    } catch (e) {
      console.warn('[MeiliProductService] Error fetching product terms:', e);
      return this.cachedTerms || [];
    }
  }

  /**
   * Search product terms in `app_bsb_product_terms`
   */
  public async searchProductTerms(query: string): Promise<BsbProductTerm[]> {
    const terms = await this.getProductTerms();
    if (!query || !query.trim()) return terms;

    const qLower = query.toLowerCase().trim();
    return terms.filter(
      (t) =>
        t.name.toLowerCase().includes(qLower) ||
        t.description.toLowerCase().includes(qLower) ||
        (t.plainContent && t.plainContent.toLowerCase().includes(qLower)) ||
        t.type.toLowerCase().includes(qLower)
    );
  }

  /**
   * Automatically match customer query against official terms from `app_bsb_product_terms`
   */
  public async findRelevantTerm(customerQuery: string): Promise<{
    term: BsbProductTerm;
    cleanText: string;
    title: string;
  } | null> {
    const terms = await this.getProductTerms();
    if (!terms || terms.length === 0) return null;

    const q = customerQuery.toLowerCase().trim();

    // 1. Check Return & Refund Policy (Буцаалтын нөхцөл)
    const isReturnQuery =
      q.includes('буцаа') ||
      q.includes('буцаалт') ||
      q.includes('солиул') ||
      q.includes('солих') ||
      q.includes('гэмтэлтэй') ||
      q.includes('сэтгэл ханамж') ||
      q.includes('алданги') ||
      q.includes('буцааж болох уу') ||
      q.includes('мөнгө буцаах');

    if (isReturnQuery) {
      const returnTerm = terms.find((t) => t.type === 'return_term') || terms[0];
      if (returnTerm) {
        return {
          term: returnTerm,
          title: returnTerm.name,
          cleanText: returnTerm.plainContent || this.htmlToCleanText(returnTerm.content),
        };
      }
    }

    // 2. Check Delivery Fee Policy (Хүргэлтийн төлбөр)
    const isDeliveryFeeQuery =
      q.includes('хүргэлтийн үнэ') ||
      q.includes('хүргэлтийн төлбөр') ||
      q.includes('хүргэлт хэд вэ') ||
      q.includes('хүргэлтийн үнэ хэд') ||
      q.includes('үнэгүй хүргэлт') ||
      q.includes('250000') ||
      q.includes('250,000');

    if (isDeliveryFeeQuery) {
      const feeTerm = terms.find((t) => t.type === 'delivery_payment_term');
      const delivTerm = terms.find((t) => t.type === 'delivery_term');
      if (feeTerm) {
        const combined = `${feeTerm.plainContent || this.htmlToCleanText(feeTerm.content)}\n\n${delivTerm ? (delivTerm.plainContent || this.htmlToCleanText(delivTerm.content)) : ''}`.trim();
        return {
          term: feeTerm,
          title: feeTerm.name,
          cleanText: combined,
        };
      }
    }

    // 3. Check General Delivery Terms (Хүргэлтийн нөхцөл, хугацаа, хязгаар бүс)
    const isDeliveryQuery =
      q.includes('хүргэлт') ||
      q.includes('хүргэх хугацаа') ||
      q.includes('хэзээ ирэх') ||
      q.includes('хэзээ хүргэх') ||
      q.includes('хотын хязгаар') ||
      q.includes('хүргэлтийн бүс') ||
      q.includes('хүргэлт яаж хийдэг') ||
      q.includes('хүргэж өгөх');

    if (isDeliveryQuery) {
      const delivTerm = terms.find((t) => t.type === 'delivery_term');
      if (delivTerm) {
        return {
          term: delivTerm,
          title: delivTerm.name,
          cleanText: delivTerm.plainContent || this.htmlToCleanText(delivTerm.content),
        };
      }
    }

    return null;
  }

  /**
   * Search brands from MeiliSearch index `app_bsb_brands` (146 official brands)
   */
  public async searchBrands(query = '', limit = 20): Promise<BsbBrand[]> {
    try {
      const result = await this.queryIndex<BsbBrand>(MEILI_INDICES.BRANDS, {
        q: query,
        limit,
      });
      return result.hits;
    } catch (e) {
      console.warn('[MeiliProductService] Error querying brands:', e);
      return [];
    }
  }

  /**
   * Search categories/taxons from MeiliSearch index `app_bsb_taxons` (621 official categories)
   */
  public async searchTaxons(query = '', limit = 20): Promise<BsbTaxon[]> {
    try {
      const result = await this.queryIndex<BsbTaxon>(MEILI_INDICES.TAXONS, {
        q: query,
        limit,
      });
      return result.hits;
    } catch (e) {
      console.warn('[MeiliProductService] Error querying taxons:', e);
      return [];
    }
  }

  /**
   * Find best matching taxon/category from `app_bsb_taxons`
   */
  public async findBestTaxon(categoryOrQuery: string): Promise<BsbTaxon | null> {
    if (!categoryOrQuery) return null;
    const clean = categoryOrQuery.toLowerCase().trim();

    // Official BSB category mapping for Sofa / Буйдан
    if (clean.includes('буйдан') || clean.includes('диван') || clean.includes('sofa') || clean.includes('couch')) {
      return {
        id: 186,
        code: 'category_2287',
        name: 'Буйдан',
        slug: 'category_2287?has_stock=true',
        productTotal: 310,
      };
    }

    try {
      const result = await this.queryIndex<BsbTaxon>(MEILI_INDICES.TAXONS, {
        q: clean,
        limit: 5,
      });
      if (result.hits && result.hits.length > 0) {
        // Look for exact name match
        const exact = result.hits.find(
          (t) => t.name.toLowerCase() === clean || t.slug.toLowerCase() === clean || t.code.toLowerCase() === clean
        );
        const hit = exact || result.hits[0];
        if (hit && (hit.name.toLowerCase().includes('буйдан') || hit.slug.includes('buidan') || hit.code === 'category_2287')) {
          return {
            ...hit,
            slug: 'category_2287?has_stock=true',
          };
        }
        return hit;
      }
      return null;
    } catch (e) {
      console.warn('[MeiliProductService] Error finding best taxon:', e);
      return null;
    }
  }

  /**
   * Search filter attributes from MeiliSearch index `app_bsb_attributes` (164 filter attributes)
   */
  public async searchAttributes(query = '', limit = 20): Promise<BsbAttribute[]> {
    try {
      const result = await this.queryIndex<BsbAttribute>(MEILI_INDICES.ATTRIBUTES, {
        q: query,
        limit,
      });
      return result.hits;
    } catch (e) {
      console.warn('[MeiliProductService] Error querying attributes:', e);
      return [];
    }
  }

  /**
   * Get real-time stats and health across ALL 5 MeiliSearch indices
   */
  public async getAllIndicesStats(): Promise<
    Record<
      string,
      {
        index: string;
        name: string;
        count: number;
        description: string;
        status: 'connected' | 'error';
      }
    >
  > {
    const indicesConfig = [
      {
        index: MEILI_INDICES.PRODUCTS,
        name: 'Бараа бүтээгдэхүүн',
        description: 'БСБ-ийн 7,300+ нэр төрлийн цахилгаан бараа, компьютер, тавилга',
      },
      {
        index: MEILI_INDICES.TAXONS,
        name: 'Ангилал / Taxons',
        description: '620+ барааны бүлэг, дэд ангилал ба бүтцийн шатлал',
      },
      {
        index: MEILI_INDICES.BRANDS,
        name: 'Брэндүүд',
        description: '140+ албан ёсны брэндүүд, лого, барааны тоо',
      },
      {
        index: MEILI_INDICES.PRODUCT_TERMS,
        name: 'Үйлчилгээний нөхцөлүүд',
        description: 'Хүргэлт, буцаалт, төлбөрийн албан ёсны журам, заалтууд',
      },
      {
        index: MEILI_INDICES.ATTRIBUTES,
        name: 'Шинж чанар / Үзүүлэлт',
        description: '160+ техникийн үзүүлэлт, инч, хүчин чадал, шүүлтүүр',
      },
    ];

    const results: Record<string, any> = {};

    await Promise.all(
      indicesConfig.map(async (item) => {
        try {
          const res = await this.queryIndex(item.index, { q: '', limit: 1 });
          results[item.index] = {
            index: item.index,
            name: item.name,
            count: res.estimatedTotalHits,
            description: item.description,
            status: 'connected',
          };
        } catch {
          results[item.index] = {
            index: item.index,
            name: item.name,
            count: 0,
            description: item.description,
            status: 'error',
          };
        }
      })
    );

    return results;
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

    // Remove common question prefixes and suffixes using Cyrillic-aware word boundaries
    const sortedStopWords = [...QUESTION_STOP_WORDS].sort((a, b) => b.length - a.length);
    for (const phrase of sortedStopWords) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Zа-яёөүА-ЯЁӨҮ0-9])${escaped}(?=[^a-zA-Zа-яёөүА-ЯЁӨҮ0-9]|$)`, 'gi');
      cleaned = cleaned.replace(regex, '$1 ');
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

  // Helper to match category keywords with boundary checks for short words
  private matchesCategoryKeyword(text: string, kw: string): boolean {
    const normKw = kw.toLowerCase().trim();
    const normText = text.toLowerCase();
    if (normKw.length <= 3) {
      // For short 2-3 letter words (like 'ор', 'тв', 'tv', 'bed'), require full word boundary
      const regex = new RegExp(`(^|[^a-zA-Zа-яёөүА-ЯЁӨҮ0-9])${normKw}([^a-zA-Zа-яёөүА-ЯЁӨҮ0-9]|$)`, 'i');
      return regex.test(normText);
    }
    return normText.includes(normKw);
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

    // Normalize messages into a chronological list, isolating to the current active session
    const messages: string[] = [];
    if (Array.isArray(conversation)) {
      // Find latest session boundary if conversation contains session markers
      let startIndex = 0;
      for (let idx = 0; idx < conversation.length; idx++) {
        const item = conversation[idx];
        const text = typeof item === 'string' ? item : ((item as any)?.text || '');
        if (
          text.includes('Session closed') ||
          text.includes('Conversation #') ||
          text.includes('Conversation started')
        ) {
          startIndex = idx + 1;
        }
      }

      const activeSlice = conversation.slice(startIndex);
      for (const item of activeSlice) {
        if (typeof item === 'string' && item.trim()) {
          messages.push(item.trim());
        } else if (item && typeof (item as any).text === 'string' && (item as any).text.trim()) {
          // Ignore system messages from CRM / Openlines (e.g. "Order attached", "Deal attached", "picked conversation", etc.)
          if ((item as any).sender === 'system') {
            continue;
          }
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

    // Check if the customer's CURRENT message explicitly mentions a product category
    const currentQueryLower = rawQuery.toLowerCase();
    const directCategoryMatch = BSB_CATEGORIES.find((cat) =>
      cat.keywords.some((kw) => this.matchesCategoryKeyword(currentQueryLower, kw))
    );
    if (directCategoryMatch) {
      detectedCategoryObj = {
        name: directCategoryMatch.name,
        slug: directCategoryMatch.slug,
        canonicalSearchTerm: directCategoryMatch.canonicalSearchTerm,
      };
    }

    // Check if the customer's CURRENT message explicitly mentions a brand
    let currentBrandMatch: string | undefined;
    for (const brand of BSB_BRANDS) {
      if (brand.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(currentQueryLower))) {
        currentBrandMatch = brand.name;
        break;
      }
    }
    if (currentBrandMatch) {
      detectedBrand = currentBrandMatch;
    }

    // Check if current message has an explicit product code
    const currentCodeMatch = rawQuery.match(/\b([A-Za-z0-9]{3,}-[A-Za-z0-9\-]+)\b/);
    if (currentCodeMatch && !currentCodeMatch[1].toLowerCase().includes('wi-fi') && currentCodeMatch[1].length >= 5) {
      exactCode = currentCodeMatch[1];
    }

    // Scan backwards from newest to oldest message for missing context ONLY if not directly supplied in current query
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const lower = msg.toLowerCase();

      // 1. Detect explicit product code if not already found and user didn't switch to a broad category
      if (!exactCode && !directCategoryMatch) {
        const codeMatch = msg.match(/\b([A-Za-z0-9]{3,}-[A-Za-z0-9\-]+)\b/);
        if (codeMatch && !codeMatch[1].toLowerCase().includes('wi-fi') && codeMatch[1].length >= 5) {
          exactCode = codeMatch[1];
        }
      }

      // 2. Detect brand if not found in current query and user didn't switch categories
      if (!detectedBrand && !directCategoryMatch) {
        for (const brand of BSB_BRANDS) {
          if (brand.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(lower))) {
            detectedBrand = brand.name;
            break;
          }
        }
      }

      // 3. Detect category from history if not in current query
      if (!detectedCategoryObj) {
        for (const cat of BSB_CATEGORIES) {
          if (cat.keywords.some((kw) => this.matchesCategoryKeyword(lower, kw))) {
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
    const isFollowUpPattern = /^(үнэ|хэд|хэдтэй|бэлэн|байгаа|байна|хямдрал|өнгө|загвар|үзэх|линк|холбоос|аль|аль нь|санал|мэдээлэл|хэмжээ|хүргэлт|лизинг|storepay|pocket|une|hed|hedtei|belen|baigaa|baina|link|uzekh)/i;
    const isFollowUpQuery =
      !directCategoryMatch &&
      (cleanQuery.length < 4 ||
        isFollowUpPattern.test(cleanQuery) ||
        cleanQuery === 'үнэ' ||
        cleanQuery === 'бэлэн' ||
        cleanQuery === 'une' ||
        cleanQuery === 'belen');

    let preciseQuery = cleanQuery;

    if (exactCode) {
      preciseQuery = exactCode;
    } else if (directCategoryMatch) {
      // Direct category inquiry like "угаалгын машин", "угаалгын машин байна уу", "угаалгын машин хайх"
      if (detectedBrand) {
        preciseQuery = `${detectedBrand} ${directCategoryMatch.canonicalSearchTerm}`;
      } else {
        preciseQuery = cleanQuery || directCategoryMatch.canonicalSearchTerm;
      }
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
      const catObj = BSB_CATEGORIES.find((c) => c.name === detectedContext.detectedCategory);
      const catTerm = catObj?.canonicalSearchTerm;
      if (catTerm) {
        // First try pure canonical category term directly
        result = await this.searchProducts(catTerm, options);
        // If still 0 and brand was detected, try brand + catTerm
        if (result.hits.length === 0 && detectedContext.detectedBrand) {
          result = await this.searchProducts(`${detectedContext.detectedBrand} ${catTerm}`, options);
        }
      }
    }

    // 4. If still 0 hits and inStockOnly was true, retry without inStockOnly
    if (result.hits.length === 0 && options.inStockOnly) {
      const relaxedOptions = { ...options, inStockOnly: false };
      result = await this.searchProducts(detectedContext.preciseQuery || query, relaxedOptions);
      if (result.hits.length === 0 && detectedContext.detectedCategory) {
        const catTerm = BSB_CATEGORIES.find((c) => c.name === detectedContext.detectedCategory)?.canonicalSearchTerm;
        if (catTerm) {
          result = await this.searchProducts(catTerm, relaxedOptions);
        }
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
   * Intelligently resolves the most accurate, specific, and official category for a product
   */
  public resolveCategory(h: any, rawName: string): { name: string; slug: string } {
    const lowerName = (rawName || '').toLowerCase();

    // 1. Check if category represents Sofa / Буйдан
    const isSofa =
      lowerName.includes('буйдан') ||
      lowerName.includes('sofa') ||
      (Array.isArray(h.productTaxons) &&
        h.productTaxons.some(
          (t: any) =>
            (t.name && t.name.toLowerCase().includes('буйдан')) ||
            (t.slug && t.slug.toLowerCase().includes('buidan')) ||
            t.code === 'category_2287' ||
            t.code === 'category_4029'
        ));

    if (isSofa) {
      return { name: 'Буйдан', slug: 'category_2287?has_stock=true' };
    }

    // 2. Direct BSB_CATEGORIES keyword check against product title
    for (const cat of BSB_CATEGORIES) {
      if (cat.keywords.some((kw) => this.matchesCategoryKeyword(lowerName, kw))) {
        // If product has a specific matching taxon (e.g. front-door washing machine), use it if valid
        const matchedTaxon = Array.isArray(h.productTaxons)
          ? h.productTaxons.find((t: any) => {
              if (!t?.name || !t?.slug) return false;
              const n = t.name.toLowerCase();
              return cat.keywords.some((kw) => this.matchesCategoryKeyword(n, kw));
            })
          : null;
        if (matchedTaxon && matchedTaxon.slug !== 'category') {
          return { name: matchedTaxon.name, slug: matchedTaxon.slug };
        }
        return { name: cat.name, slug: cat.slug };
      }
    }

    // 3. Inspect mainTaxon if valid and not a dummy root 'category'
    const mainValid =
      h.mainTaxon &&
      h.mainTaxon.name &&
      h.mainTaxon.slug &&
      String(h.mainTaxon.code).toLowerCase() !== 'category' &&
      String(h.mainTaxon.slug).toLowerCase() !== 'category' &&
      String(h.mainTaxon.name).toLowerCase() !== 'category';

    if (mainValid) {
      return { name: h.mainTaxon.name, slug: h.mainTaxon.slug || h.mainTaxon.code };
    }

    // 4. Inspect valid taxons from productTaxons
    const validTaxons = Array.isArray(h.productTaxons)
      ? h.productTaxons.filter((t: any) => {
          if (!t || !t.name || !t.slug) return false;
          const lowerSlug = String(t.slug).toLowerCase();
          const lowerName = String(t.name).toLowerCase();
          const lowerCode = String(t.code || '').toLowerCase();
          if (lowerSlug === 'category' || lowerName === 'category' || lowerCode === 'category') return false;
          if (lowerCode.endsWith('_brand') || lowerCode.endsWith('_group')) return false;
          if (lowerSlug.includes('/brendeer') || lowerSlug.includes('/baraany-bulgeer')) return false;
          if (lowerSlug.includes('banner') || lowerSlug.includes('kollekts') || lowerSlug.includes('collection')) return false;
          if (lowerName === 'брэндээр' || lowerName === 'барааны бүлгээр' || lowerName === 'бүлгээр') return false;
          return true;
        })
      : [];

    if (validTaxons.length > 0) {
      const leaf = validTaxons[validTaxons.length - 1];
      return { name: leaf.name, slug: leaf.slug || leaf.code };
    }

    return { name: 'Цахилгаан бараа', slug: 'electronics' };
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
    const resolvedCat = this.resolveCategory(h, rawName);
    const categoryName = resolvedCat.name;
    let categorySlug = resolvedCat.slug;

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

    // Build official category URL
    let categoryUrl: string;
    if (categorySlug.includes('category_2287') || categorySlug.includes('buidan') || categoryName.toLowerCase().includes('буйдан')) {
      categorySlug = 'category_2287?has_stock=true';
      categoryUrl = `${baseUrl}/categories/category_2287?has_stock=true`;
    } else {
      // Official BSB.mn category page route is https://bsb.mn/categories/:categorySlug
      let catPattern = config?.categoryUrlPattern || `${baseUrl}/categories/{slug}`;
      if (catPattern.includes('/category/{slug}') || catPattern.includes('/category/')) {
        catPattern = catPattern.replace('/category/', '/categories/');
      }

      // If categorySlug somehow ended up as dummy root 'category', fix to electronics
      if (!categorySlug || categorySlug.toLowerCase() === 'category') {
        categorySlug = 'electronics';
      }

      categoryUrl = catPattern
        .replace('{slug}', categorySlug)
        .replace('{code}', categorySlug);

      if (categoryUrl.includes('/category/') && !categoryUrl.includes('/categories/')) {
        categoryUrl = categoryUrl.replace('/category/', '/categories/');
      }
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
      rules.push("1. БАРААНЫ ХОЛБООС ('url' талбар): Бараа тус бүрийн нэр, үнэ, үзүүлэлтийн мэдээллийн АРААС барааны албан ёсны холбоосыг дараагийн мөрөнд нь тусад нь '🔗 Холбоос: {url}' (эсвэл 🔗 [Дэлгэрэнгүй үзэх]({url})) хэлбэрээр заавал хавсаргана уу. Барааны гарчиг/нэрэн дээр холбоос хавчуулахгүй, барааны дэлгэрэнгүй мэдээллийнх нь араас тусад нь мөр болгож тавина.");
    }

    if (cfg.includeCategoryLink !== false) {
      rules.push("2. АНГИЛЛЫН ХОЛБООС ('categoryUrl' талбар): Хариултын төгсгөлд хэрэглэгчид тухайн ангиллын бусад бүх загварыг үзэх боломж олгож, ангиллын холбоосыг дээрх 'categoryUrl'-аас ашиглан 📁 [Ангилал: {Ангиллын нэр}]({categoryUrl}) хэлбэрээр санал болгоно уу.");
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

    // Always normalize any sofa / буйдан category URLs to official working link:
    // https://bsb.mn/categories/category_2287?has_stock=true
    text = text.replace(
      /https?:\/\/bsb\.mn\/categories\/code_23\/bukh-tavilga\/buidan[^\s)\]]*/gi,
      'https://bsb.mn/categories/category_2287?has_stock=true'
    );
    text = text.replace(
      /https?:\/\/bsb\.mn\/categories\/code_2287[^\s)\]]*/gi,
      'https://bsb.mn/categories/category_2287?has_stock=true'
    );
    text = text.replace(
      /https?:\/\/bsb\.mn\/categories\/category_4029[^\s)\]]*/gi,
      'https://bsb.mn/categories/category_2287?has_stock=true'
    );
    text = text.replace(
      /https?:\/\/bsb\.mn\/categories\/[^\s)\]]*buidan[^\s)\]]*/gi,
      'https://bsb.mn/categories/category_2287?has_stock=true'
    );

    // 1. Replace any markdown link [label](url) that has incorrect, generic, or hallucinated URL with the matched product's exact 'url'
    if (products.length > 0) {
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (fullMatch, label, url) => {
        const lowerLabel = label.toLowerCase();

        // Check if this link refers to sofa category
        if (lowerLabel.includes('буйдан') || lowerLabel.includes('sofa') || url.includes('buidan') || url.includes('2287')) {
          if (url.includes('/categories/') || url.includes('/category/') || lowerLabel.includes('ангилал') || lowerLabel.includes('төрөл')) {
            return `[${label}](https://bsb.mn/categories/category_2287?has_stock=true)`;
          }
        }

        // If it's already an exact official product url or category url from our hits
        if (products.some((p) => p.url === url || p.productUrl === url || p.categoryUrl === url)) {
          return fullMatch;
        }

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

    // 5.1. Replace broken generic /categories/category with real product category
    if (products.length > 0 && products[0].categoryUrl && !products[0].categoryUrl.endsWith('/categories/category')) {
      text = text.replace(/https?:\/\/bsb\.mn\/categories\/category(?=[)\s\]]|$)/gi, products[0].categoryUrl);
      if (products[0].category && products[0].category.toLowerCase() !== 'category') {
        text = text.replace(/\[Ангилал:\s*Category\]/gi, `[Ангилал: ${products[0].category}]`);
      }
    }

    // 6. Clean any trailing slashes inside product URLs before closing brackets or markdown
    text = text.replace(/(https?:\/\/bsb\.mn\/products\/by-code\/[A-Za-z0-9_\-]+)\/+([)\s*\]])/g, '$1$2');

    // 6.1. Move product links that were wrapped around product titles to the end of the product info block
    // e.g., 1. [LG 11kg LG-F4V3ES6S](url)\n   • Үнэ: ... -> 1. LG 11kg LG-F4V3ES6S\n   • Үнэ: ...\n   🔗 Холбоос: url
    const blocks = text.split(/\n\n+/);
    const movedBlocks = blocks.map((block) => {
      const match = block.match(/^(\s*(?:\d+[\.\)]|\-|\*|•)\s*)\[([^\]\n]+)\]\((https?:\/\/bsb\.mn\/products\/by-code\/[^\s)]+)\)([\s\S]*)$/);
      if (match) {
        const bullet = match[1];
        const title = match[2];
        const url = match[3];
        const rest = match[4].trimEnd();
        if (rest.includes(url)) {
          return bullet + title + rest;
        }
        return `${bullet}${title}${rest}\n   🔗 Холбоос: ${url}`;
      }
      return block;
    });
    text = movedBlocks.join('\n\n');

    // 7. Ensure primary product link exists if enabled in config and products were found
    const cfg = config || DEFAULT_PRODUCT_CONFIG;
    if (cfg.includeProductLink !== false && products.length > 0 && products[0].url) {
      const primaryUrl = products[0].url;
      const hasUrlAlready = text.includes(primaryUrl) || text.includes(products[0].productCode);
      if (!hasUrlAlready && !text.includes('products/by-code/')) {
        text += `\n\n🔗 Холбоос: ${primaryUrl}`;
      }
    }

    // 8. Ensure category link exists if enabled and not present
    if (cfg.includeCategoryLink !== false && products.length > 0 && products[0].categoryUrl) {
      const catUrl = products[0].categoryUrl;
      const hasCatAlready = text.includes(catUrl) || text.includes('/categories/');
      if (!hasCatAlready && !catUrl.endsWith('/categories/category')) {
        const catName = products[0].category && products[0].category.toLowerCase() !== 'category'
          ? products[0].category
          : 'Бараа бүтээгдэхүүн';
        text += `\n📁 [Ангилал: ${catName}](${catUrl})`;
      }
    }

    return text;
  }
}

export const meiliProductService = new MeiliProductService();
