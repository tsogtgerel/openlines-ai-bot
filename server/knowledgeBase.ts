import fs from 'fs';
import path from 'path';

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const KB_FILE = path.join(DATA_DIR, 'knowledge_base.json');

const DEFAULT_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'art-hours',
    title: 'Ажлын цагийн хуваарь & Харилцагчийн үйлчилгээ',
    category: 'Ерөнхий',
    content: 'Манай харилцагчийн үйлчилгээний төв болон төв оффис Даваа - Баасан гаригт 09:00 - 18:30 цагийн хооронд ажиллана. БСБ-гийн бүх салбар их дэлгүүрүүд Даваа-Ням гаригт 10:00 - 20:00 цаг хүртэл өдөр бүр ажиллаж байна. Онлайн дэлгүүрийн захиалгыг 24/7 цагийн турш хүлээн авна.',
    keywords: ['цаг', 'ажлын цаг', 'хуваарь', 'хэдэн цаг', 'хэзээ хүртэл', 'нээлттэй', 'хаах', 'амралтын өдөр', 'дэлгүүр', 'салбар', 'hours', 'time'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'art-payment',
    title: 'Төлбөрийн нөхцөл, Хүүгүй хуваан төлөлт & НӨАТ',
    category: 'Төлбөр тооцоо',
    content: 'Бид бүх төрлийн банкны карт, QPay, SocialPay, Khan Bank, Golomt Bank зэрэг шилжүүлгүүдийг хүлээн авна. Мөн StorePay, PocketZero зэрэг үйлчилгээгээр урьдчилгаагүй, 0% хүүтэй хуваан төлөх боломжтой. Байгууллагын худалдан авалтад НӨАТ-ын И-Баримт, нэхэмжлэх шууд олгогдоно.',
    keywords: ['төлбөр', 'төлөх', 'төлбөрийн нөхцөл', 'данс', 'qpay', 'лизинг', 'зээл', 'хүүгүй', 'storepay', 'pocket', 'нөат', 'ибаримт', 'баримт', 'нэхэмжлэх', 'payment'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'art-delivery',
    title: 'Хүргэлтийн хугацаа, Нөхцөл & Захиалга хянах',
    category: 'Хүргэлт',
    content: 'Улаанбаатар хот дотор 50,000₮-с дээш худалдан авалтад хүргэлт ҮНЭГҮЙ бөгөөд 24-48 цагийн дотор гэрийн хаягаар хүргэж, тавилга цахилгаан барааг мэргэжлийн баг угсарч суурилуулж өгнө. Орон нутгийн унаанд 24 цагийн дотор найдвартай хүргэж өгнө. Захиалгын явцыг мессежээр очсон линк болон утасны дугаараараа хянах боломжтой.',
    keywords: ['хүргэлт', 'хүргэх', 'хэзээ ирэх', 'хүргэлтийн хугацаа', 'үнэгүй хүргэлт', 'орон нутаг', 'хаяг', 'захиалга', 'угсралт', 'delivery', 'shipping'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'art-returns',
    title: 'Баталгаат хугацаа & Бараа буцаах, солих журам',
    category: 'Баталгаа & Буцаалт',
    content: 'Бүх цахилгаан бараа, компьютер, тавилгад үйлдвэрийн албан ёсны 1-ээс 3 хүртэлх жилийн баталгаа олгогдоно. Барааг хүлээн авснаас хойш 72 цагийн дотор үйлдвэрийн гэмтэл согог илэрсэн тохиолдолд баримттай нь шинээр сольж өгнө. Баталгаат хугацаанд манай албан ёсны Сервис төв үнэ төлбөргүй үйлчилнэ.',
    keywords: ['баталгаа', 'баталгаат хугацаа', 'буцаалт', 'солих', 'эвдэрсэн', 'гэмтэл', 'засвар', 'сервис', 'буцаах', 'солиулах', 'warranty', 'return'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'art-contact',
    title: 'Оператор, Менежертэй шууд холбогдох',
    category: 'Тусламж',
    content: 'Та чатын "Оператор дуудах" товчийг дарах эсвэл чатаар "оператор", "хүнтэй ярих" гэж бичсэнээр манай харилцагчийн үйлчилгээний ажилтантай шууд холбогдоно. Ажлын цагаар оператор дунджаар 1-2 минутын дотор хариу өгнө.',
    keywords: ['оператор', 'ажилтан', 'менежер', 'хүн', 'хүнтэй', 'утсаар', 'мэргэжилтэн', 'туслах', 'холбогдох', 'operator', 'human', 'agent'],
    updatedAt: new Date().toISOString(),
  },
];

export class KnowledgeBaseService {
  private articles: KnowledgeArticle[] = [];

  constructor() {
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load() {
    try {
      if (fs.existsSync(KB_FILE)) {
        const raw = fs.readFileSync(KB_FILE, 'utf-8');
        this.articles = JSON.parse(raw);
      } else {
        this.articles = DEFAULT_ARTICLES;
        this.save();
      }
    } catch (e) {
      console.error('Failed to load KB file, using defaults', e);
      this.articles = DEFAULT_ARTICLES;
    }
  }

  private save() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(KB_FILE, JSON.stringify(this.articles, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save KB file', e);
    }
  }

  getAll(): KnowledgeArticle[] {
    return [...this.articles];
  }

  getById(id: string): KnowledgeArticle | undefined {
    return this.articles.find((a) => a.id === id);
  }

  add(article: Omit<KnowledgeArticle, 'id' | 'updatedAt'>): KnowledgeArticle {
    const newArticle: KnowledgeArticle = {
      ...article,
      id: `art-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: new Date().toISOString(),
    };
    this.articles.unshift(newArticle);
    this.save();
    return newArticle;
  }

  update(id: string, updates: Partial<Omit<KnowledgeArticle, 'id'>>): KnowledgeArticle | null {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.articles[idx] = {
      ...this.articles[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.articles[idx];
  }

  delete(id: string): boolean {
    const initialLen = this.articles.length;
    this.articles = this.articles.filter((a) => a.id !== id);
    if (this.articles.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  search(query: string, maxResults = 3): { article: KnowledgeArticle; score: number }[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const queryTokens = normalizedQuery
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const scored = this.articles.map((art) => {
      let score = 0;
      const titleLower = art.title.toLowerCase();
      const contentLower = art.content.toLowerCase();
      const keywords = art.keywords.map((k) => k.toLowerCase());

      // Exact phrase matches
      if (titleLower.includes(normalizedQuery)) score += 3.0;
      if (contentLower.includes(normalizedQuery)) score += 1.5;

      for (const kw of keywords) {
        if (normalizedQuery.includes(kw) || kw.includes(normalizedQuery)) {
          score += 2.5;
        }
      }

      // Token overlap
      for (const token of queryTokens) {
        if (keywords.some((k) => k.includes(token))) score += 1.5;
        if (titleLower.includes(token)) score += 1.0;
        if (contentLower.includes(token)) score += 0.4;
      }

      // Normalize score by query token count
      const normalizedScore = queryTokens.length > 0 ? score / (queryTokens.length * 1.5) : 0;

      return {
        article: art,
        score: Math.min(1.0, normalizedScore),
      };
    });

    return scored
      .filter((item) => item.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
}

export const knowledgeBase = new KnowledgeBaseService();
