/**
 * ============================================================================
 * 🤖 BSB Bitrix24 AI Bot Worker Service (AI Туслах Бот & Чат Ажиллагаа)
 * ============================================================================
 * 
 * Энэхүү сервис нь Bitrix24 Open Lines-д зориулсан AI Welcome Bot-ийг удирдах үндсэн цөм юм.
 * 
 * Үндсэн чиг үүрэг:
 * 1. Event Polling & Message Ingestion:
 *    - Bitrix24 Bot API (/v1/bots/:id/events) дээрх шинэ мессежүүдийг (ONIMBOTV2MESSAGEADD) тогтмол шалгах.
 *    - Bitrix24 Open Lines чатын сессүүдээс ирсэн харилцагчийн мессежийг давхар хүлээн авах.
 * 2. Мэдээллийн сантай харьцах (RAG Search):
 *    - Харилцагчийн асуултаас PII (утас, и-мэйл) мэдээллийг цэвэрлэсний дараа KnowledgeBase-аас семантик хайлт хийх.
 * 3. AI хариулт боловсруулах (BitrixGPT / LLM):
 *    - Мэдээллийн сангаас олдсон баримтуудыг System Prompt-д оруулан үнэн зөв хариулт үүсгэх.
 * 4. Оператор луу шилжүүлэх (Intelligent Escalation / Handoff):
 *    - Хэрэглэгч өөрөө оператор хүссэн үед (түлхүүр үгс эсвэл /operator товчлуур).
 *    - Мэдээллийн санд тохирох нийтлэл олдоогүй эсвэл confidence score босгоос доогуур байвал.
 *    - AI загвар хариулахаас татгалзсан эсвэл алдаа гарсан үед хиймэл төөрөгдөл (hallucination)
 *      үүсгэлгүйгээр бот чатыг орхиж (leave chat), амьд операторын дараалалд автоматаар шилжүүлэх.
 * 5. Операторын AI Ноорог туслах (Suggest Draft Response):
 *    - Ажилтан харилцагчтай чаталж байх үед 1 товшилтоор илгээх бэлэн хариултыг мэдээллийн сангаас боловсруулж өгөх.
 */

import fs from 'fs';
import path from 'path';
import { knowledgeBase, KnowledgeArticle } from './knowledgeBase';
import { vibeRequest } from './vibeApi';
import { chatManager } from './chatManager';
import {
  meiliProductService,
  FormattedBsbProduct,
  ProductDisplayConfig,
  DEFAULT_PRODUCT_CONFIG,
  BSB_CATEGORIES,
  DetectedProductContext,
} from './meiliProductService';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'bot_config.json');
const LOGS_FILE = path.join(DATA_DIR, 'dialog_logs.json');

/**
 * AI Ботын тохиргооны бүтэц
 */
export interface BotConfig {
  botId: number | null; // Bitrix24 дээр бүртгэгдсэн ботын ID
  botCode: string; // Системийн кодын нэр (ж: kb_ai_helper)
  botName: string; // Дэлгэцэнд харагдах нэр (ж: BSB AI Туслах)
  selectedLineId: number | null; // Холбогдсон Open Line сувгийн ID
  selectedLineName: string; // Холбогдсон сувгийн нэр (ж: БСБ Мебель Facebook)
  isPollingActive: boolean; // Мессеж шалгах давтамж идэвхтэй эсэх
  currentOffset: number; // Bitrix event дарааллын одоогийн офсет
  tone: 'professional' | 'friendly' | 'concise'; // Хариултын өнгө аяс
  language: string; // Хариулах үндсэн хэл (mn)
  handoffThreshold: number; // Операторт шилжүүлэх хамгийн бага магадлалын босго (0.2)
  fallbackMessage: string; // Алдаа гарах үеийн нөөц мэдэгдэл
  operatorKeywords: string[]; // Оператор дуудах монгол/англи түлхүүр үгс
  systemPromptAddition: string; // Системийн нэмэлт зааварчилгаа
  model: string; // Ашиглах AI загвар (ж: bitrix/bitrixgpt-5.5)
  botAssignmentMode: 'manual_only' | 'all_chats'; // 'manual_only': зөвхөн операторын заасан чатад, 'all_chats': сувгийн бүх чатад
  enableProductSearch?: boolean; // MeiliSearch барааны сангаас автоматаар хайх
  productSearchEnabled?: boolean; // UI-тай нийцтэй талбар
  productSearchLimit?: number; // Нэг хариултанд авах барааны тоо (1-8)
  meiliUrl?: string; // MeiliSearch URL
  meiliIndex?: string; // MeiliSearch индекс
  productConfig?: ProductDisplayConfig; // Барааны мэдээлэл болон линкний форматын нарийвчилсан тохиргоо
}

/**
 * Ботын боловсруулсан харилцан яриа бүрийн бүртгэлийн бүтэц (Audit Log)
 */
export interface DialogLog {
  id: string;
  timestamp: string;
  dialogId: string;
  customerMessage: string;
  botAnswer: string;
  handedOff: boolean;
  handoffReason?: 'keyword' | 'low_confidence' | 'ai_error' | 'user_button' | 'model_declined' | 'assigned_to_operator' | 'manual_transfer';
  matchedArticles: { id: string; title: string; score: number }[];
  matchedProducts?: {
    code: string;
    name: string;
    priceFormatted: string;
    inStock: boolean;
    productUrl?: string;
    category?: string;
    categoryUrl?: string;
  }[];
  durationMs: number;
}

/**
 * AI харилцан ярианы идэвхтэй сесс ба санах ойн төлөв (AI Conversation Memory & Session State)
 */
export interface AiSessionState {
  chatId: string;
  dialogId: string;
  isActive: boolean;
  isHandedOff: boolean;
  handoffTimestamp?: string;
  handoffReason?: string;
  transferredToAgent?: string;
  lastCustomerMessage?: string;
  lastBotResponse?: string;
  detectedContext?: any;
  conversationTurns: Array<{ role: 'customer' | 'bot' | 'system'; text: string; timestamp: string }>;
  startedAt: string;
  lastActivityAt: string;
}

/**
 * Ботын боловсруулалтын хариу ба гарсан handoff дохио
 */
export interface BotProcessOutcome {
  answer: string;
  handedOff: boolean;
  handoff?: boolean; // Explicit 'handoff' signal when transferred to an agent
  handoffReason?: string;
  transferredToAgent?: string;
  chatId?: string;
  sessionCleared?: boolean;
}

const DEFAULT_CONFIG: BotConfig = {
  botId: 19170, // Pre-registered BSB AI Assistant
  botCode: 'kb_ai_helper',
  botName: 'BSB AI Туслах',
  selectedLineId: 39, // БСБ Мебель - Facebook - Comments
  selectedLineName: 'БСБ Мебель - Facebook - Comments',
  isPollingActive: false,
  currentOffset: 0,
  tone: 'professional',
  language: 'mn',
  handoffThreshold: 0.2,
  fallbackMessage: "Уучлаарай, системийн түр саатлын улмаас таныг харилцагчийн үйлчилгээний ажилтантай шууд холбож байна. Түр хүлээнэ үү.",
  operatorKeywords: [
    'оператор',
    'хүн',
    'хүнтэй',
    'хүнтэй ярих',
    'менежер',
    'ажилтан',
    'мэргэжилтэн',
    'туслах',
    'утсаар',
    'холбогдох',
    'operator',
    'human',
    'specialist',
    'manager',
    '/operator',
  ],
  systemPromptAddition: 'Монгол хэлээр эелдэг, товч бөгөөд ойлгомжтой, үнэн зөв хариулна уу.',
  model: 'bitrix/bitrixgpt-5.5',
  botAssignmentMode: 'manual_only',
  enableProductSearch: true,
  productSearchEnabled: true,
  productSearchLimit: 4,
  meiliUrl: 'https://meili.bsb.mn',
  meiliIndex: 'app_bsb_products',
  productConfig: DEFAULT_PRODUCT_CONFIG,
};

export class BotWorkerService {
  private config: BotConfig = DEFAULT_CONFIG;
  private logs: DialogLog[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessingPoll = false;
  private processedOpenlineMessageIds = new Set<string>();

  // Active AI conversation memory & session states per chat ID
  private activeSessions = new Map<string, AiSessionState>();

  constructor() {
    this.ensureDataDir();
    this.loadConfig();
    this.loadLogs();

    // Listen to handoff events from chatManager to automatically clear active AI session states
    chatManager.on('handoff', (event: any) => {
      try {
        if (event?.dialogId) {
          this.clearActiveSessionState(event.dialogId, {
            reason: event.reason || 'transferred_to_agent',
            transferredToAgent: event.targetAgentName,
          });
        }
        if (event?.dialogNumericId && event.dialogNumericId !== event.dialogId) {
          this.clearActiveSessionState(event.dialogNumericId, {
            reason: event.reason || 'transferred_to_agent',
            transferredToAgent: event.targetAgentName,
          });
        }
      } catch (err) {
        console.error('[BotWorker] Error handling handoff event:', err);
      }
    });

    chatManager.on('bot_connected', (event: any) => {
      try {
        if (event?.dialogId) {
          this.reactivateBotSession(event.dialogId);
        }
        if (event?.dialogNumericId && event.dialogNumericId !== event.dialogId) {
          this.reactivateBotSession(event.dialogNumericId);
        }
      } catch (err) {
        console.error('[BotWorker] Error handling bot_connected event:', err);
      }
    });
  }

  /**
   * Normalize chat or dialog key to resolve chat123, 123, d-123 to consistent key
   */
  public normalizeChatKey(id: string): string {
    if (!id) return '';
    const match = id.match(/\d+/);
    if (match) {
      return match[0];
    }
    return id.toLowerCase().trim();
  }

  /**
   * Get active session state for a chat
   */
  public getSession(chatOrDialogId: string): AiSessionState | undefined {
    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);
    return this.activeSessions.get(rawKey) || this.activeSessions.get(normKey);
  }

  /**
   * Check if a chat session is currently handed off to a human agent
   */
  public isSessionHandedOff(chatOrDialogId: string): boolean {
    if (!chatOrDialogId) return false;
    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);
    const session = this.activeSessions.get(rawKey) || this.activeSessions.get(normKey);

    // Also check chatManager dialog status
    const dialog =
      chatManager.getDialog(chatOrDialogId) ||
      chatManager.getDialogById(chatOrDialogId) ||
      (normKey ? chatManager.getDialogById(`chat-${normKey}`) : undefined) ||
      (normKey ? chatManager.getDialogById(`chat${normKey}`) : undefined);

    // CRITICAL: If the dialog explicitly has botActive === true (or status === 'bot'),
    // the bot is ACTIVE in this chat! It is NOT handed off.
    if (dialog && (dialog.botActive === true || dialog.status === 'bot')) {
      if (session && session.isHandedOff) {
        session.isHandedOff = false;
      }
      return false;
    }

    // If dialog explicitly has botActive === false, bot is detached / handed off
    if (dialog && dialog.botActive === false) {
      return true;
    }

    // Check memory session flag
    if (session && session.isHandedOff) {
      return true;
    }

    // If botActive is not explicitly true, check if assigned to human operator or in progress
    if (dialog) {
      if (
        dialog.status === 'in_progress' ||
        dialog.status === 'assigned' ||
        (!dialog.botActive && dialog.assignedAgentId && dialog.assignedAgentId !== 'unassigned')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear the active session state for a specific chat ID in AI memory.
   * Dispatches the 'handoff' signal and ensures the bot stops responding to messages meant for the human agent.
   */
  public clearActiveSessionState(
    chatOrDialogId: string,
    options?: { reason?: string; transferredToAgent?: string }
  ): { cleared: boolean; chatId: string; handoff: boolean; transferredToAgent?: string } {
    if (!chatOrDialogId) {
      return { cleared: false, chatId: '', handoff: true };
    }

    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);

    const existing = this.activeSessions.get(rawKey) || this.activeSessions.get(normKey);

    const handoffReason = options?.reason || 'transferred_to_agent';
    const transferredToAgent = options?.transferredToAgent;
    const now = new Date().toISOString();

    if (existing) {
      existing.isActive = false;
      existing.isHandedOff = true;
      existing.handoffTimestamp = now;
      existing.handoffReason = handoffReason;
      if (transferredToAgent) {
        existing.transferredToAgent = transferredToAgent;
      }
      // Purge active conversation memory turns and detected context
      existing.conversationTurns = [];
      existing.detectedContext = undefined;
      existing.lastActivityAt = now;
    } else {
      // Create a tombstone/handoff record in AI memory so that future messages are immediately blocked
      const handedOffSession: AiSessionState = {
        chatId: normKey || rawKey,
        dialogId: rawKey,
        isActive: false,
        isHandedOff: true,
        handoffTimestamp: now,
        handoffReason,
        transferredToAgent,
        conversationTurns: [],
        startedAt: now,
        lastActivityAt: now,
      };
      this.activeSessions.set(rawKey, handedOffSession);
      if (normKey && normKey !== rawKey) {
        this.activeSessions.set(normKey, handedOffSession);
      }
    }

    console.log(
      `[BotWorker] Cleared active AI session state and memory for chat ${chatOrDialogId} (Handoff signal sent. Agent: ${transferredToAgent || 'operator'}, Reason: ${handoffReason})`
    );

    return {
      cleared: true,
      chatId: chatOrDialogId,
      handoff: true,
      transferredToAgent,
    };
  }

  /**
   * Reactivate bot session memory when bot is intentionally re-connected to chat
   */
  public reactivateBotSession(chatOrDialogId: string): void {
    if (!chatOrDialogId) return;
    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);
    this.activeSessions.delete(rawKey);
    if (normKey) this.activeSessions.delete(normKey);

    const newSession: AiSessionState = {
      chatId: normKey || rawKey,
      dialogId: rawKey,
      isActive: true,
      isHandedOff: false,
      conversationTurns: [],
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    this.activeSessions.set(rawKey, newSession);
    if (normKey && normKey !== rawKey) {
      this.activeSessions.set(normKey, newSession);
    }
    this.clearProcessedOpenlineMessages(chatOrDialogId);
    console.log(`[BotWorker] Reactivated AI session state for chat ${chatOrDialogId}`);
  }

  /**
   * Clear tracked processed openline message IDs
   */
  public clearProcessedOpenlineMessages(chatOrDialogId?: string): void {
    if (!chatOrDialogId) {
      this.processedOpenlineMessageIds.clear();
      return;
    }
    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);
    for (const key of Array.from(this.processedOpenlineMessageIds)) {
      if (key.includes(rawKey) || (normKey && key.includes(normKey))) {
        this.processedOpenlineMessageIds.delete(key);
      }
    }
  }

  /**
   * Record conversation turn in AI memory for active sessions
   */
  public recordSessionTurn(
    chatOrDialogId: string,
    customerText: string,
    botText: string,
    context?: any
  ): void {
    const rawKey = chatOrDialogId;
    const normKey = this.normalizeChatKey(chatOrDialogId);
    let session = this.activeSessions.get(rawKey) || this.activeSessions.get(normKey);

    const now = new Date().toISOString();
    if (!session) {
      session = {
        chatId: normKey || rawKey,
        dialogId: rawKey,
        isActive: true,
        isHandedOff: false,
        conversationTurns: [],
        startedAt: now,
        lastActivityAt: now,
      };
      this.activeSessions.set(rawKey, session);
      if (normKey && normKey !== rawKey) {
        this.activeSessions.set(normKey, session);
      }
    }

    session.lastCustomerMessage = customerText;
    session.lastBotResponse = botText;
    session.lastActivityAt = now;
    if (context) {
      session.detectedContext = context;
    }

    session.conversationTurns.push(
      { role: 'customer', text: customerText, timestamp: now },
      { role: 'bot', text: botText, timestamp: now }
    );

    // Keep memory turns bounded (e.g. last 20 turns)
    if (session.conversationTurns.length > 20) {
      session.conversationTurns = session.conversationTurns.slice(-20);
    }
  }

  /**
   * Get all active sessions
   */
  public getAllActiveSessions(): AiSessionState[] {
    return Array.from(this.activeSessions.values());
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_CONFIG, ...parsed };

        // Auto-migrate any legacy broken URL patterns in config to official working BSB endpoints
        if (this.config.productConfig) {
          let updated = false;
          const currentProdPattern = this.config.productConfig.productUrlPattern || '';
          if (
            currentProdPattern.includes('/product/{slug}') ||
            currentProdPattern.includes('/product/{code}') ||
            currentProdPattern.includes('/products/{slug}') ||
            currentProdPattern === 'https://bsb.mn/product/{slug}'
          ) {
            this.config.productConfig.productUrlPattern = 'https://bsb.mn/products/by-code/{code}';
            updated = true;
          }

          const currentCatPattern = this.config.productConfig.categoryUrlPattern || '';
          if (
            currentCatPattern.includes('/category/{slug}') ||
            currentCatPattern.includes('/category/') ||
            currentCatPattern === 'https://bsb.mn/category/{slug}'
          ) {
            this.config.productConfig.categoryUrlPattern = 'https://bsb.mn/categories/{slug}';
            updated = true;
          }

          if (updated) {
            console.log('[BotWorker] Auto-migrated bot_config.json to official BSB product URL patterns (/products/by-code/:code)');
            this.saveConfig();
          }
        }
      } else {
        this.saveConfig();
      }
    } catch (e) {
      console.error('Failed to load bot config:', e);
    }
  }

  private saveConfig() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save bot config:', e);
    }
  }

  private loadLogs() {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load dialog logs:', e);
    }
  }

  private saveLogs() {
    try {
      this.ensureDataDir();
      // Keep most recent 500 logs
      if (this.logs.length > 500) {
        this.logs = this.logs.slice(0, 500);
      }
      fs.writeFileSync(LOGS_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save dialog logs:', e);
    }
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BotConfig>): BotConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    return { ...this.config };
  }

  getLogs(limit = 50): DialogLog[] {
    return this.logs.slice(0, limit);
  }

  addLog(log: DialogLog) {
    this.logs.unshift(log);
    this.saveLogs();
  }

  async resubscribeBot(): Promise<boolean> {
    if (!this.config.botId) return false;
    try {
      const res = await vibeRequest('POST', `/v1/bots/${this.config.botId}/resubscribe`);
      console.log(`[BotWorker] Resubscribed bot ${this.config.botId}:`, res.success);
      return Boolean(res.success);
    } catch (e) {
      console.warn('[BotWorker] Resubscribe warning:', e);
      return false;
    }
  }

  async startPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.config.isPollingActive = true;
    this.saveConfig();

    await this.resubscribeBot().catch(() => {});

    // Run first cycle immediately
    this.pollCycle().catch((err) => console.error('Immediate poll error:', err));

    // Poll every 2.5 seconds for steady customer event capture without rate limiting
    this.pollTimer = setInterval(() => {
      this.pollCycle().catch((err) => console.error('Poll error:', err));
    }, 2500);
    console.log(`[BotWorker] Polling started for bot ${this.config.botId} with offset ${this.config.currentOffset}`);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.config.isPollingActive = false;
    this.saveConfig();
    console.log('[BotWorker] Polling stopped');
  }

  async registerOrAttachBot(name?: string, code?: string): Promise<{ botId: number; name: string; code: string }> {
    const botCode = code || this.config.botCode || 'kb_ai_helper';
    const botName = name || this.config.botName || 'BSB AI Assistant';

    // First check existing bots
    const existing = await vibeRequest<{ bots: any[] }>('GET', '/v1/bots');
    const match = existing.data?.bots?.find((b: any) => b.code === botCode);
    if (match) {
      this.updateConfig({ botId: match.id, botCode: match.code, botName: match.name });
      return { botId: match.id, name: match.name, code: match.code };
    }

    // Otherwise register
    const res = await vibeRequest<any>('POST', '/v1/bots', {
      code: botCode,
      name: botName,
      type: 'bot',
      eventMode: 'fetch',
    });

    if (!res.success && res.error) {
      throw new Error(res.error.message || 'Failed to register bot');
    }

    const newBotId = res.data?.bot?.id || res.data?.botId;
    this.updateConfig({ botId: newBotId, botCode, botName });
    return { botId: newBotId, name: botName, code: botCode };
  }

  /**
   * Ботыг сонгосон Bitrix24 Open Line сувагт холбох.
   * Welcome bot горимоор тохируулагдах бөгөөд харилцагч чат эхлэх бүрт бот хамгийн түрүүнд
   * угтан авч, хариулах боломжгүй үед операторын дараалал (queue) руу шилжүүлнэ.
   */
  async bindToOpenLine(lineId: number, lineName: string): Promise<boolean> {
    if (!this.config.botId) {
      throw new Error('Bot must be registered before binding to an Open Line');
    }

    const res = await vibeRequest('PATCH', `/v1/openline-configs/${lineId}`, {
      welcomeBotEnable: 'Y',
      welcomeBotId: this.config.botId,
      welcomeBotJoin: 'always',
      welcomeBotLeft: 'queue',
    });

    if (!res.success && res.error) {
      throw new Error(res.error.message || 'Failed to bind bot to Open Line');
    }

    this.updateConfig({ selectedLineId: lineId, selectedLineName: lineName });
    // Сувагт амжилттай холбогдмогц ботын polling процессыг автоматаар эхлүүлнэ
    await this.startPolling();
    return true;
  }

  /**
   * Ботыг Open Line сувгаас салгах (welcome bot идэвхгүй болгож polling-г зогсоох).
   */
  async unbindFromOpenLine(lineId: number): Promise<boolean> {
    try {
      await vibeRequest('PATCH', `/v1/openline-configs/${lineId}`, {
        welcomeBotEnable: 'N',
        welcomeBotId: 0,
      });
    } catch (err) {
      console.warn(`[BotWorker] Failed to patch openline ${lineId} on Bitrix:`, err);
    }

    if (this.config.selectedLineId === lineId || !this.config.selectedLineId) {
      this.updateConfig({ selectedLineId: null, selectedLineName: '' });
      this.stopPolling();
    }
    console.log(`[BotWorker] Unbound line ${lineId}. Bot polling halted.`);
    return true;
  }

  /**
   * Bitrix24 Bot Event Polling цикл:
   * /v1/bots/:botId/events?offset=X хандалтаар шинэ үйл явдлуудыг асууж,
   * офсетийг автоматаар хадгалан дараагийн ээлжинд давхардалгүй шалгана.
   */
  private async pollCycle() {
    if (this.isProcessingPoll || !this.config.botId || !this.config.isPollingActive) {
      return;
    }

    this.isProcessingPoll = true;
    try {
      const offsetParam = this.config.currentOffset !== null ? `?offset=${this.config.currentOffset}` : '';
      const response = await vibeRequest<any>('GET', `/v1/bots/${this.config.botId}/events${offsetParam}`);

      if (!response.success) {
        return;
      }

      const events = response.data?.events || [];
      const nextOffset = response.data?.nextOffset;

      if (typeof nextOffset === 'number' && nextOffset !== this.config.currentOffset) {
        this.config.currentOffset = nextOffset;
        this.saveConfig();
      }

      for (const evt of events) {
        await this.handleEvent(evt);
      }
    } catch (e) {
      console.error('[BotWorker] Error during poll cycle:', e);
    } finally {
      this.isProcessingPoll = false;
    }
  }

  /**
   * Ирсэн үйл явдлыг (event) задлан, харилцагчийн мессеж мөн эсэхийг баталгаажуулж
   * операторын ажлын талбар (chatManager) болон AI хариулагч руу дамжуулах.
   */
  private async handleEvent(evt: any) {
    if (!this.config.isPollingActive || !this.config.botId) {
      return;
    }

    // Check event type
    const eventName = evt.event || evt.type || '';
    if (eventName !== 'ONIMBOTV2MESSAGEADD' && eventName !== 'ONIMBOTMESSAGEADD') {
      return;
    }

    const data = evt.data || {};
    const messageObj = data.message || {};
    const chatObj = data.chat || {};
    const userObj = data.user || {};

    const dialogId = String(chatObj.dialogId || messageObj.chatId || '');
    const rawText = (messageObj.text || '').trim();
    const senderId = userObj.id || messageObj.authorId;

    // Ignore bot's own messages or empty text
    if (!rawText || !dialogId || senderId === this.config.botId) {
      return;
    }

    const senderName =
      userObj.name ||
      `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() ||
      undefined;
    const senderAvatar = userObj.avatar || undefined;

    // Record incoming customer message into Omnichannel Workplace dialogs
    chatManager.recordIncomingBitrixMessage({
      dialogId,
      text: rawText,
      senderId,
      senderName,
      senderAvatar,
      channelId: this.config.selectedLineId || chatObj.entity_id || 39,
      channelName: this.config.selectedLineName || 'Битрикс24 Open Line',
      channelType: 'webchat',
    });

    // Check if dialog is currently in progress, assigned to an operator, or bot has detached
    const normKey = this.normalizeChatKey(dialogId);
    const currentDialog =
      chatManager.getDialogById(dialogId) ||
      chatManager.getDialog(dialogId) ||
      (normKey ? chatManager.getDialogById(`chat-${normKey}`) : undefined) ||
      (normKey ? chatManager.getDialogById(`chat${normKey}`) : undefined);

    const isBotActive = Boolean(currentDialog?.botActive || currentDialog?.status === 'bot');

    if (
      !isBotActive &&
      (this.isSessionHandedOff(dialogId) ||
        (currentDialog &&
          (currentDialog.status === 'in_progress' ||
            currentDialog.status === 'assigned' ||
            (currentDialog.assignedAgentId && currentDialog.assignedAgentId !== 'unassigned') ||
            currentDialog.botActive === false)))
    ) {
      console.log(`[BotWorker] Skipping bot auto-reply for ${dialogId}: Handled by operator or transferred to agent (bot detached)`);
      return;
    }

    // Хэрэв бот холбогдохоос өмнө оператортой харилцаж байсан хуучин мессеж бол алгасна
    if (currentDialog?.botConnectedAt) {
      const botConnectedTime = new Date(currentDialog.botConnectedAt).getTime();
      const eventTime = (messageObj.date ? new Date(messageObj.date).getTime() : 0) || (evt.date ? new Date(evt.date).getTime() : 0);
      if (eventTime > 0 && eventTime < botConnectedTime - 2000) {
        console.log(`[BotWorker] Skipping event for ${dialogId}: Message was sent before bot connected`);
        return;
      }
    }

    // Хэрэв горим нь зөвхөн заасан тухайлсан чатад холбогдох ('manual_only') бол botActive === true байхыг шалгана
    if (this.config.botAssignmentMode === 'manual_only' && !currentDialog?.botActive) {
      console.log(`[BotWorker] Skipping bot auto-reply for ${dialogId}: Manual assignment mode is active and bot is not connected to this chat`);
      return;
    }

    await this.processMessage(dialogId, rawText);
  }

  /**
   * Харилцагчийн ирүүлсэн мессежийг боловсруулах гол логик:
   * 1. PII (утас, и-мэйл) нууцлалын маск хийх
   * 2. Оператор хүссэн түлхүүр үг / товчлуурыг шалгах -> тийм бол шууд дамжуулах
   * 3. Мэдээллийн сангаас (Knowledge Base) семантик хайлт хийх
   * 4. Тохирох магадлал (score) босгоос бага бол операторт найрсаг шилжүүлэх (хиймэл төөрөгдөлгүй)
   * 5. VibeCode AI (BitrixGPT) загварт баримтуудыг System Prompt болгон өгч хариулт бэлтгэх
   * 6. Бэлэн хариултыг 'Оператор дуудах' инлайн товчлуурын хамт илгээх
   */
  async processMessage(dialogId: string, text: string): Promise<BotProcessOutcome> {
    const startTime = Date.now();
    const botId = this.config.botId;

    if (!botId) {
      throw new Error('Bot is not registered');
    }

    // Check if dialog is already transferred to an agent, in progress, or bot has detached
    const normKey = this.normalizeChatKey(dialogId);
    const existingDialog =
      chatManager.getDialog(dialogId) ||
      chatManager.getDialogById(dialogId) ||
      (normKey ? chatManager.getDialogById(`chat-${normKey}`) : undefined) ||
      (normKey ? chatManager.getDialogById(`chat${normKey}`) : undefined);

    const isBotActive = Boolean(existingDialog?.botActive || existingDialog?.status === 'bot');

    if (!isBotActive && this.isSessionHandedOff(dialogId)) {
      const agentName = existingDialog?.assignedAgentName || existingDialog?.assignedAgentId || 'хүний оператор';
      console.log(`[BotWorker] Aborting bot reply for ${dialogId}: Chat has been transferred to agent ${agentName}. Active session cleared.`);
      this.clearActiveSessionState(dialogId, {
        reason: 'transferred_to_agent',
        transferredToAgent: String(agentName),
      });
      return {
        answer: '',
        handedOff: true,
        handoff: true, // explicit handoff signal
        handoffReason: 'transferred_to_agent',
        transferredToAgent: String(agentName),
        chatId: dialogId,
        sessionCleared: true,
      };
    }

    if (existingDialog) {
      if (existingDialog.botActive === false) {
        console.log(`[BotWorker] Aborting bot reply for ${dialogId}: botActive is explicitly false`);
        this.clearActiveSessionState(dialogId, { reason: 'bot_detached' });
        return {
          answer: '',
          handedOff: true,
          handoff: true,
          handoffReason: 'bot_detached',
          chatId: dialogId,
          sessionCleared: true,
        };
      }
      if (
        !existingDialog.botActive &&
        existingDialog.status !== 'bot' &&
        existingDialog.assignedAgentId &&
        existingDialog.assignedAgentId !== 'unassigned'
      ) {
        console.log(`[BotWorker] Aborting bot reply for ${dialogId}: Assigned to operator ${existingDialog.assignedAgentName || existingDialog.assignedAgentId} (bot detached)`);
        this.clearActiveSessionState(dialogId, {
          reason: 'assigned_to_operator',
          transferredToAgent: existingDialog.assignedAgentName || existingDialog.assignedAgentId,
        });
        return {
          answer: '',
          handedOff: true,
          handoff: true,
          handoffReason: 'assigned_to_operator',
          transferredToAgent: existingDialog.assignedAgentName || existingDialog.assignedAgentId,
          chatId: dialogId,
          sessionCleared: true,
        };
      }
    }

    // Strip basic PII for model privacy
    const sanitizedText = text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');

    const lowerText = text.toLowerCase();

    // 1. Check if user explicitly asked for operator or clicked the operator button
    const isEscalationRequested =
      lowerText === '/operator' ||
      this.config.operatorKeywords.some((kw) => lowerText.includes(kw.toLowerCase()));

    if (isEscalationRequested) {
      const handoffMsg = "Би таныг яг одоо харилцагчийн үйлчилгээний ажилтантай (оператортой) холбож байна. Түр хүлээнэ үү...";
      const handoffReason = lowerText === '/operator' ? 'user_button' : 'keyword';
      await this.sendReply(dialogId, handoffMsg);
      await this.handoffToOperator(dialogId, handoffReason);
      chatManager.recordBotReply(dialogId, handoffMsg, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: handoffMsg,
        handedOff: true,
        handoffReason,
        matchedArticles: [],
        matchedProducts: [],
        durationMs: Date.now() - startTime,
      });

      return {
        answer: handoffMsg,
        handedOff: true,
        handoff: true, // explicit handoff signal
        handoffReason,
        chatId: dialogId,
        sessionCleared: true,
      };
    }

    // 2. Check for polite greeting (e.g. "Сайн байна уу", "Өдрийн мэнд") to avoid immediate handoff
    const isGreeting = /^(сайн байна уу|сайн уу|өдрийн мэнд|өглөөний мэнд|оройн мэнд|hi|hello|hey|sn bnu)[!.? ]*$/i.test(text.trim());
    if (isGreeting) {
      const greetingReply = "Сайн байна уу! БСБ Сервисд тавтай морилно уу. Танд ямар бараа, бүтээгдэхүүн, үнэ эсвэл үйлчилгээний талаар мэдээлэл хэрэгтэй байна вэ? Би туслахад бэлэн байна.";
      await this.sendReply(dialogId, greetingReply, true);
      chatManager.recordBotReply(dialogId, greetingReply, false, this.config.botName);
      this.recordSessionTurn(dialogId, text, greetingReply);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: greetingReply,
        handedOff: false,
        matchedArticles: [],
        matchedProducts: [],
        durationMs: Date.now() - startTime,
      });
      return { answer: greetingReply, handedOff: false, handoff: false, chatId: dialogId, sessionCleared: false };
    }

    // 3. Search MeiliSearch Product Database (https://meili.bsb.mn) using conversation context
    let matchedProducts: FormattedBsbProduct[] = [];
    let detectedProductContext: DetectedProductContext | undefined;
    const isProdSearchActive = this.config.productSearchEnabled !== false && this.config.enableProductSearch !== false;
    if (isProdSearchActive) {
      try {
        const prodLimit = this.config.productSearchLimit || 4;
        const dialogData = chatManager.getDialog(dialogId);
        const prevMessages = dialogData ? dialogData.messages.slice(-8) : [];
        const prodResult = await meiliProductService.searchByConversation(sanitizedText, prevMessages, {
          limit: prodLimit,
          config: this.config.productConfig,
        });
        matchedProducts = prodResult.hits;
        detectedProductContext = prodResult.detectedContext;
      } catch (prodErr) {
        console.warn('[BotWorker] MeiliSearch query failed:', prodErr);
      }
    }

    // 4. Search Knowledge Base & MeiliSearch Official Product Terms (app_bsb_product_terms)
    const matchedKb = knowledgeBase.search(sanitizedText, 3);
    const topKbScore = matchedKb.length > 0 ? matchedKb[0].score : 0;
    const matchedTerm = await meiliProductService.findRelevantTerm(sanitizedText);

    // 5. If confidence is below threshold, no products, and no official term -> check taxon or handoff
    const hasProductMatch = matchedProducts.length > 0;
    const hasKbMatch = matchedKb.length > 0 && topKbScore >= this.config.handoffThreshold;
    const hasTermMatch = matchedTerm !== null;

    if (!hasProductMatch && !hasKbMatch && !hasTermMatch) {
      // Check if a category was detected in the customer query (e.g. угаалгын машин, хөргөгч, зурагт)
      let detectedCat =
        detectedProductContext?.detectedCategory ||
        BSB_CATEGORIES.find((c) => c.keywords.some((kw) => sanitizedText.toLowerCase().includes(kw)))?.name;
      let detectedSlug =
        detectedProductContext?.categorySlug ||
        BSB_CATEGORIES.find((c) => c.name === detectedCat)?.slug;

      // Also check official MeiliSearch taxons (app_bsb_taxons)
      if (!detectedCat || !detectedSlug) {
        try {
          const liveTaxon = await meiliProductService.findBestTaxon(sanitizedText);
          if (liveTaxon && liveTaxon.slug && liveTaxon.name) {
            detectedCat = liveTaxon.name;
            detectedSlug = liveTaxon.slug;
          }
        } catch {}
      }

      if (detectedCat && detectedSlug) {
        let catUrl = detectedSlug.startsWith('http')
          ? detectedSlug
          : `https://bsb.mn/categories/${detectedSlug}`;
        if (
          detectedCat.toLowerCase().includes('буйдан') ||
          detectedSlug.toLowerCase().includes('buidan') ||
          detectedSlug.includes('2287')
        ) {
          catUrl = 'https://bsb.mn/categories/category_2287?has_stock=true';
        }
        const catReply = `Сайн байна уу! БСБ-д худалдаалагдаж буй ${detectedCat}-ны бүх загваруудыг дараах албан ёсны ангиллын холбоосоор орж сонирхох боломжтой:\n\n📁 [Ангилал: ${detectedCat}](${catUrl})\n\nТанд сонирхож буй брэнд, үзүүлэлт байгаа бол бичнэ үү, би дэлгэрэнгүй шалгаж өгье!`;

        await this.sendReply(dialogId, catReply, true);
        chatManager.recordBotReply(dialogId, catReply, false, this.config.botName);
        this.recordSessionTurn(dialogId, text, catReply);

        this.addLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          dialogId,
          customerMessage: text,
          botAnswer: catReply,
          handedOff: false,
          matchedArticles: [],
          matchedProducts: [],
          durationMs: Date.now() - startTime,
        });

        return { answer: catReply, handedOff: false, handoff: false, chatId: dialogId, sessionCleared: false };
      }

      const unsureMsg = "Манай барааны болон мэдээллийн санд энэ асуултын талаар тодорхой мэдээлэл олдсонгүй. Танд туслахаар харилцагчийн үйлчилгээний мэргэжилтэнтэй шууд холбож байна!";
      await this.sendReply(dialogId, unsureMsg);
      await this.handoffToOperator(dialogId, 'low_confidence');
      chatManager.recordBotReply(dialogId, unsureMsg, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: unsureMsg,
        handedOff: true,
        handoffReason: 'low_confidence',
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: [],
        durationMs: Date.now() - startTime,
      });

      return {
        answer: unsureMsg,
        handedOff: true,
        handoff: true,
        handoffReason: 'low_confidence',
        chatId: dialogId,
        sessionCleared: true,
      };
    }

    // 6. Generate answer via VibeCode AI (bitrix/bitrixgpt-5.5)
    try {
      const productContext = matchedProducts.length > 0
        ? meiliProductService.formatForPrompt(matchedProducts, this.config.productConfig)
        : '';

      const termsContext = matchedTerm
        ? `--- БСБ АЛБАН ЁСНЫ ҮЙЛЧИЛГЭЭНИЙ НӨХЦӨЛҮҮД (app_bsb_product_terms) ---\nГарчиг: ${matchedTerm.title}\nТайлбар: ${matchedTerm.term.description}\nНөхцөл, заалтууд:\n${matchedTerm.cleanText}\n`
        : '';

      const kbContext = matchedKb
        .map((m) => `### ${m.article.title} (Ангилал: ${m.article.category})\n${m.article.content}`)
        .join('\n\n');

      const productConfig = this.config.productConfig || DEFAULT_PRODUCT_CONFIG;
      const linkDirectives: string[] = [];
      if (productConfig.includeProductLink !== false) {
        linkDirectives.push("Хэрэглэгч бараа асуусан бол бараа тус бүрийн нэр, үнэ, үзүүлэлтийн мэдээллийн АРААС MeiliSearch баримтаас олдсон бодит 'url' талбарын хаягийг '🔗 Холбоос: {url}' (эсвэл 🔗 [Дэлгэрэнгүй үзэх]({url})) хэлбэрээр дараагийн мөрөнд нь тусад нь заавал хавсаргана. Барааны гарчиг/нэрэн дээр холбоос хавчуулахгүй, барааны мэдээллийнх нь араас тусад нь мөр болгож тавина. Буруу эсвэл дур мэдэн зохиосон линк огт тавьж болохгүй.");
      }
      if (productConfig.includeCategoryLink !== false) {
        linkDirectives.push("Хэрэглэгчид ижил төстэй бусад загваруудыг харах боломж олгож, дээрх 'categoryUrl' талбарын холбоосыг 📁 [Ангилал: {Ангиллын нэр}]({categoryUrl}) хэлбэрээр хариултын төгсгөлд санал болгоно.");
      }

      const systemPrompt = `Та бол БСБ (BSB) компанийн албан ёсны харилцагчийн үйлчилгээний туслах AI бот юм.
Хэрэглэгчийн асуултад БСБ Барааны мэдээллийн сан (MeiliSearch https://meili.bsb.mn) болон Мэдээллийн санд үндэслэн Монгол хэлээр маш тодорхой, эелдэг, найрсаг хариулна уу.

ДҮРЭМ ЖУРАМ:
1. Бараа, бүтээгдэхүүн, үнэ, загвар, техникийн үзүүлэлт, бэлэн байгаа эсэхийг асуусан бол "БСБ БАРААНЫ АЛБАН ЁСНЫ МЭДЭЭЛЛИЙН САН"-аас олдсон бодит бүтээгдэхүүний брэнд, нэр, үнэ (₮-өөр), бэлэн байгаа эсэх төлөв, гол техникийн үзүүлэлтийг тодорхой дурдаж хариулна.
2. Хэрэв барааны нөөц дууссан ("Одоогоор нөөц дууссан") байвал "Одоогоор нөөц түр дууссан байна" гэдгийг тодорхой мэдэгдэнэ.
3. Хүргэлт, буцаалт, төлбөрийн нөхцөлийн талаар асуусан бол "БСБ АЛБАН ЁСНЫ ҮЙЛЧИЛГЭЭНИЙ НӨХЦӨЛҮҮД"-ийн заалтыг (жишээ нь 72 цагийн сэтгэл ханамж, 24-72 цагийн хүргэлт, 250,000₮-с дээш үнэгүй хүргэлт г.м) яг үнэн зөв дурдаж хариулна.
4. ${linkDirectives.length > 0 ? linkDirectives.join('\n') : 'Барааны мэдээллийг тодорхой дурдана.'}
5. Лизинг, төлбөрийн нөхцөл (StorePay, PocketZero, Хаан банкны лизинг г.м.), салбар дэлгүүрийн хаяг асуусан бол Мэдээллийн сангаас үндэслэн тайлбарлана.
6. Барааны болон мэдээллийн санд БАЙХГҮЙ хуурамч мэдээллийг дур мэдэн зохиож БОЛОХГҮЙ.
7. БСБ Барааны сан эсвэл Үйлчилгээний нөхцөлөөс мэдээлэл олдсон бол [TRANSFER_OPERATOR] гаргахгүй, олдсон албан ёсны мэдээллийг найрсаг танилцуулна.
8. Өнгө аяс: ${this.config.tone}.
${this.config.systemPromptAddition}

${termsContext ? termsContext + '\n\n' : ''}${productContext ? productContext + '\n\n' : ''}${kbContext ? '--- МЭДЭЭЛЛИЙН САНГИЙН ХЭСГҮҮД ---\n' + kbContext + '\n\n' : ''}Хэрэв хэрэглэгчийн асуултын хариулт дээрх хэсгүүдэд огт байхгүй эсвэл хангалтгүй бол зөвхөн яг энэ үгийг гаргана уу: [TRANSFER_OPERATOR]`;

      const aiRes = await vibeRequest<any>('POST', '/v1/chat/completions', {
        model: this.config.model || 'bitrix/bitrixgpt-5.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedText },
        ],
      });

      const rawAny = aiRes as any;
      const aiContent = (rawAny.choices?.[0]?.message?.content || rawAny.data?.choices?.[0]?.message?.content || '').trim();

      if (!aiContent || aiContent.includes('[TRANSFER_OPERATOR]')) {
        // If products were found in MeiliSearch, do NOT transfer to operator with "no info"!
        if (matchedProducts.length > 0) {
          const itemsList = matchedProducts.slice(0, 3).map((p, idx) => {
            const stock = p.inStock ? 'Бэлэн байгаа' : 'Нөөц түр дууссан';
            const price = p.priceFormatted || 'Үнэ тодруулах';
            const specs = p.attributesSummary ? `\n   • Үзүүлэлт: ${p.attributesSummary}` : '';
            const productLink = p.url ? `\n   🔗 Холбоос: ${p.url}` : '';
            return `${idx + 1}. ${p.name}\n   • Үнэ: ${price} (${stock})${specs}${productLink}`;
          }).join('\n\n');

          const categoryItem = matchedProducts.find((p) => p.categoryUrl && p.category && p.category.toLowerCase() !== 'category');
          const categoryName = detectedProductContext?.detectedCategory || categoryItem?.category || 'Бараа бүтээгдэхүүн';
          let categoryUrl = detectedProductContext?.categorySlug
            ? (detectedProductContext.categorySlug.includes('category_2287') ? 'https://bsb.mn/categories/category_2287?has_stock=true' : `https://bsb.mn/categories/${detectedProductContext.categorySlug}`)
            : (categoryItem?.categoryUrl || 'https://bsb.mn/categories');

          if (categoryUrl.endsWith('/categories/category') || categoryUrl.endsWith('/category')) {
            categoryUrl = 'https://bsb.mn/categories';
          }

          const categoryLinkPart = categoryUrl
            ? `\n\nТа бусад бүх загварыг дараах албан ёсны ангиллын холбоосоор орж үзэх боломжтой:\n📁 [Ангилал: ${categoryName}](${categoryUrl})`
            : '';

          const directProductReply = `Сайн байна уу! БСБ-д худалдаалагдаж буй сонголтуудаас танилцуулж байна:\n\n${itemsList}${categoryLinkPart}\n\nТанд дэлгэрэнгүй мэдээлэл эсвэл зээлийн нөхцөл хэрэгтэй бол лавлана уу!`;

          await this.sendReply(dialogId, directProductReply, true);
          chatManager.recordBotReply(dialogId, directProductReply, false, this.config.botName);

          this.addLog({
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            dialogId,
            customerMessage: text,
            botAnswer: directProductReply,
            handedOff: false,
            matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
            matchedProducts: matchedProducts.map((p) => ({
              code: p.productCode,
              name: p.name,
              priceFormatted: p.priceFormatted,
              inStock: p.inStock,
              productUrl: p.productUrl,
              category: p.category,
              categoryUrl: p.categoryUrl,
            })),
            durationMs: Date.now() - startTime,
          });

          return {
            answer: directProductReply,
            handedOff: false,
            handoff: false,
            chatId: dialogId,
            sessionCleared: false,
          };
        }

        const transferText = "Манай мэдээллийн санд энэ асуултын талаар баталгаажсан мэдээлэл хангалтгүй байгаа тул таныг мэргэжилтэнтэй холбож байна.";
        await this.sendReply(dialogId, transferText);
        await this.handoffToOperator(dialogId, 'model_declined');
        chatManager.recordBotReply(dialogId, transferText, true, this.config.botName);

        this.addLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          dialogId,
          customerMessage: text,
          botAnswer: transferText,
          handedOff: true,
          handoffReason: 'model_declined',
          matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
          matchedProducts: matchedProducts.map((p) => ({
            code: p.productCode,
            name: p.name,
            priceFormatted: p.priceFormatted,
            inStock: p.inStock,
            productUrl: p.productUrl,
            category: p.category,
            categoryUrl: p.categoryUrl,
          })),
          durationMs: Date.now() - startTime,
        });

        return {
          answer: transferText,
          handedOff: true,
          handoff: true,
          handoffReason: 'model_declined',
          chatId: dialogId,
          sessionCleared: true,
        };
      }

      // Sanitize product and category links to guarantee they are 100% valid official BSB.mn links
      const sanitizedAiContent = meiliProductService.sanitizeAiResponseLinks(
        aiContent,
        matchedProducts,
        this.config.productConfig
      );

      // Send the AI answer with inline keyboard
      await this.sendReply(dialogId, sanitizedAiContent, true);
      chatManager.recordBotReply(dialogId, sanitizedAiContent, false, this.config.botName);
      this.recordSessionTurn(dialogId, text, sanitizedAiContent);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: sanitizedAiContent,
        handedOff: false,
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: matchedProducts.map((p) => ({
          code: p.productCode,
          name: p.name,
          priceFormatted: p.priceFormatted,
          inStock: p.inStock,
          productUrl: p.productUrl,
          category: p.category,
          categoryUrl: p.categoryUrl,
        })),
        durationMs: Date.now() - startTime,
      });

      return {
        answer: sanitizedAiContent,
        handedOff: false,
        handoff: false,
        chatId: dialogId,
        sessionCleared: false,
      };
    } catch (err: any) {
      console.error('[BotWorker] AI completion error:', err);

      // If MeiliSearch products were found, gracefully return them instead of error message
      if (matchedProducts.length > 0) {
        const itemsList = matchedProducts.slice(0, 3).map((p, idx) => {
          const stock = p.inStock ? 'Бэлэн байгаа' : 'Нөөц түр дууссан';
          const price = p.priceFormatted || 'Үнэ тодруулах';
          const specs = p.attributesSummary ? `\n   • Үзүүлэлт: ${p.attributesSummary}` : '';
          const productLink = p.url ? `\n   🔗 Холбоос: ${p.url}` : '';
          return `${idx + 1}. ${p.name}\n   • Үнэ: ${price} (${stock})${specs}${productLink}`;
        }).join('\n\n');

        const categoryItem = matchedProducts.find((p) => p.categoryUrl && p.category && p.category.toLowerCase() !== 'category');
        const categoryName = detectedProductContext?.detectedCategory || categoryItem?.category || 'Бараа бүтээгдэхүүн';
        let categoryUrl = detectedProductContext?.categorySlug
          ? (detectedProductContext.categorySlug.includes('category_2287') ? 'https://bsb.mn/categories/category_2287?has_stock=true' : `https://bsb.mn/categories/${detectedProductContext.categorySlug}`)
          : (categoryItem?.categoryUrl || 'https://bsb.mn/categories');

        if (categoryUrl.endsWith('/categories/category') || categoryUrl.endsWith('/category')) {
          categoryUrl = 'https://bsb.mn/categories';
        }

        const categoryLinkPart = categoryUrl
          ? `\n\nТа бусад бүх загварыг дараах албан ёсны ангиллын холбоосоор орж үзэх боломжтой:\n📁 [Ангилал: ${categoryName}](${categoryUrl})`
          : '';

        const directProductReply = `Сайн байна уу! БСБ-д худалдаалагдаж буй сонголтуудаас танилцуулж байна:\n\n${itemsList}${categoryLinkPart}\n\nТанд дэлгэрэнгүй мэдээлэл эсвэл зээлийн нөхцөл хэрэгтэй бол лавлана уу!`;

        await this.sendReply(dialogId, directProductReply, true);
        chatManager.recordBotReply(dialogId, directProductReply, false, this.config.botName);
        this.recordSessionTurn(dialogId, text, directProductReply);

        this.addLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          dialogId,
          customerMessage: text,
          botAnswer: directProductReply,
          handedOff: false,
          matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
          matchedProducts: matchedProducts.map((p) => ({
            code: p.productCode,
            name: p.name,
            priceFormatted: p.priceFormatted,
            inStock: p.inStock,
            productUrl: p.productUrl,
            category: p.category,
            categoryUrl: p.categoryUrl,
          })),
          durationMs: Date.now() - startTime,
        });

        return {
          answer: directProductReply,
          handedOff: false,
          handoff: false,
          chatId: dialogId,
          sessionCleared: false,
        };
      }

      // Fallback behavior on AI error
      const fallbackText = this.config.fallbackMessage;
      await this.sendReply(dialogId, fallbackText);
      await this.handoffToOperator(dialogId, 'ai_error');
      chatManager.recordBotReply(dialogId, fallbackText, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: fallbackText,
        handedOff: true,
        handoffReason: 'ai_error',
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: matchedProducts.map((p) => ({ code: p.productCode, name: p.name, priceFormatted: p.priceFormatted, inStock: p.inStock })),
        durationMs: Date.now() - startTime,
      });

      return {
        answer: fallbackText,
        handedOff: true,
        handoff: true,
        handoffReason: 'ai_error',
        chatId: dialogId,
        sessionCleared: true,
      };
    }
  }

  /**
   * Process incoming customer message detected via Bitrix24 Openlines session
   */
  public async processOpenlineCustomerMessage(params: {
    chatId: number;
    dialogId: string;
    messageId: string | number;
    text: string;
    customerName?: string;
    channelId: number;
    channelName: string;
    channelType: any;
  }): Promise<{ answer: string; handedOff: boolean } | null> {
    if (!this.config.botId) {
      return null;
    }

    const currentDialog =
      chatManager.getDialogById(params.dialogId) ||
      chatManager.getDialogById(`chat-${params.chatId}`) ||
      chatManager.getDialogById(`chat${params.chatId}`);

    const isExplicitlyConnected = Boolean(currentDialog?.botActive || currentDialog?.status === 'bot');

    // Хэрэв горим нь зөвхөн заасан тухайлсан чатад холбогдох ('manual_only') бол botActive === true байхыг шалгана
    if (this.config.botAssignmentMode === 'manual_only' && !isExplicitlyConnected) {
      return null;
    }

    // Хэрэв бүх чатад автоматаар хариулах горимтой бөгөөд тухайлсан суваг сонгосон бол сувгийн ID тохирч буйг шалгана
    if (!isExplicitlyConnected && this.config.selectedLineId && Number(this.config.selectedLineId) !== Number(params.channelId)) {
      return null;
    }

    // Check if session is handed off to an agent in AI memory
    if (!isExplicitlyConnected && (this.isSessionHandedOff(params.dialogId) || (params.chatId && this.isSessionHandedOff(String(params.chatId))))) {
      console.log(`[BotWorker] Skipping openline message for ${params.dialogId}: Chat has active handoff to human agent. Bot response suppressed.`);
      return null;
    }

    // Check if dialog is currently in progress, assigned to an operator, or bot has detached
    if (currentDialog) {
      if (currentDialog.botActive === false) {
        console.log(`[BotWorker] Skipping openline message for ${params.dialogId}: Bot explicitly detached`);
        return null;
      }
      if (!isExplicitlyConnected && currentDialog.assignedAgentId && currentDialog.assignedAgentId !== 'unassigned') {
        console.log(`[BotWorker] Skipping openline message for ${params.dialogId}: Handled by operator ${currentDialog.assignedAgentName || currentDialog.assignedAgentId}`);
        return null;
      }

      // Хэрэв бот холбогдохоос өмнө оператортой бичиж байсан хуучин чат бол огт хариулахгүй
      if (currentDialog.botConnectedAt) {
        const botConnectedTime = new Date(currentDialog.botConnectedAt).getTime();
        const matchingMsg = currentDialog.messages.find(
          (m) => m.id === `bx-${params.messageId}` || m.id === String(params.messageId) || m.text === params.text
        );
        if (matchingMsg && new Date(matchingMsg.timestamp).getTime() < botConnectedTime - 2000) {
          console.log(`[BotWorker] Skipping openline message for ${params.dialogId}: Message sent before bot was connected (${matchingMsg.timestamp} < ${currentDialog.botConnectedAt})`);
          return null;
        }
      }

      // Мөн уг мессежид аль хэдийн оператор эсвэл бот хариулсан эсэхийг шалгах
      const matchingMsg = currentDialog.messages.find(
        (m) => m.id === `bx-${params.messageId}` || m.id === String(params.messageId) || m.text === params.text
      );
      if (matchingMsg) {
        const msgTime = new Date(matchingMsg.timestamp).getTime();
        const hasAgentOrBotReplied = currentDialog.messages.some(
          (m) => (m.sender === 'agent' || m.sender === 'bot') && new Date(m.timestamp).getTime() >= msgTime
        );
        if (hasAgentOrBotReplied) {
          console.log(`[BotWorker] Skipping openline message for ${params.dialogId}: Already replied to by agent or bot`);
          return null;
        }
      }
    }

    const msgKey = `${params.dialogId}-${params.messageId}`;
    if (this.processedOpenlineMessageIds.has(msgKey)) {
      return null;
    }
    this.processedOpenlineMessageIds.add(msgKey);

    // Keep set bounded to prevent memory growth
    if (this.processedOpenlineMessageIds.size > 2000) {
      const arr = Array.from(this.processedOpenlineMessageIds);
      this.processedOpenlineMessageIds = new Set(arr.slice(arr.length - 1000));
    }

    // Ensure bot is in chat
    if (params.chatId) {
      await vibeRequest('POST', `/v1/chats/${params.chatId}/users`, {
        users: [this.config.botId],
      }).catch(() => {});
    }

    console.log(`[BotWorker] Auto-processing customer message for ${params.dialogId}: "${params.text.slice(0, 60)}"`);
    return await this.processMessage(params.dialogId, params.text);
  }

  private async sendReply(dialogId: string, message: string, includeKeyboard = false) {
    if (!this.config.botId || dialogId.startsWith('sim-')) return;

    const match = dialogId.match(/\d+/);
    const numericChatId = match ? parseInt(match[0], 10) : null;
    const bitrixDialogId = match ? `chat${match[0]}` : dialogId;

    if (numericChatId && numericChatId > 0) {
      // 1. Bitrix24 Openlines дээр мессеж илгээхийн тулд оператор эсвэл систем уг сешнийг "answer" хийсэн байх шаардлагатай
      try {
        await vibeRequest('POST', '/v1/openlines/operator/answer', {
          chatId: numericChatId,
        });
      } catch (ansErr) {
        // Аль хэдийн хариулагдсан байж болно
      }

      // Бот хэрэглэгчийг чатад урих
      await vibeRequest('POST', `/v1/chats/${numericChatId}/users`, {
        users: [this.config.botId],
      }).catch(() => {});
    }

    const body: any = {
      dialogId: bitrixDialogId,
      fields: {
        message,
      },
    };

    if (includeKeyboard) {
      body.fields.keyboard = [
        {
          TEXT: 'Оператор дуудах',
          ACTION: 'SEND',
          ACTION_VALUE: '/operator',
        },
      ];
    }

    let sentViaBot = false;
    try {
      const res = await vibeRequest<any>(
        'POST',
        `/v1/bots/${this.config.botId}/messages`,
        body,
        undefined,
        { isOutgoingMessage: true }
      );
      if (res && res.success) {
        sentViaBot = true;
        console.log(`[BotWorker] Sent reply via bot endpoint to ${bitrixDialogId} (msgId: ${JSON.stringify(res.data)})`);
        return res.data;
      } else {
        console.warn(`[BotWorker] Bot message failed for ${bitrixDialogId}:`, res?.error);
      }
    } catch (e: any) {
      console.warn(`[BotWorker] Error sending bot message:`, e.message);
    }

    // 2. Fallback: Bitrix чат руу шууд мессеж илгээх (Openlines холбогчоор харилцагчид шууд хүрдэг)
    try {
      const chatRes = await vibeRequest<any>(
        'POST',
        `/v1/chats/${bitrixDialogId}/messages`,
        {
          message,
        },
        undefined,
        { isOutgoingMessage: true }
      );
      if (chatRes && chatRes.success) {
        console.log(`[BotWorker] Sent reply via chat endpoint fallback to ${bitrixDialogId} (msgId: ${JSON.stringify(chatRes.data)})`);
        return chatRes.data;
      } else {
        console.warn(`[BotWorker] Chat message warning for ${bitrixDialogId}:`, chatRes?.error);
      }
    } catch (err2: any) {
      console.error(`[BotWorker] Chat message error for ${bitrixDialogId}:`, err2.message || err2);
    }
  }

  /**
   * Оператор чатыг өөртөө авах эсвэл шилжүүлэх үед ботыг харилцан ярианаас гаргах (салгах)
   */
  public async leaveChat(dialogId: string) {
    if (!this.config.botId || !dialogId || dialogId.startsWith('sim-')) return;

    try {
      const match = dialogId.match(/\d+/);
      const cleanId = match ? `chat${match[0]}` : dialogId;
      // In Bitrix24 Openlines, when welcome bot leaves the chat, the dialog transfers to the operator queue!
      await vibeRequest('POST', `/v1/bots/${this.config.botId}/chats/${cleanId}/leave`);
      console.log(`[BotWorker] Bot ${this.config.botId} left chat ${cleanId} (operator takeover / handoff)`);
    } catch (e: any) {
      console.warn(`[BotWorker] Note on leaving chat ${dialogId}:`, e.message || e);
    }
  }

  /**
   * Оператор чатыг эргүүлэн бот руу шилжүүлэх үед ботыг чатад буцаан нэмэх
   */
  public async rejoinChat(dialogId: string) {
    if (!this.config.botId || !dialogId || dialogId.startsWith('sim-')) return;

    const match = dialogId.match(/\d+/);
    if (match) {
      const numericChatId = parseInt(match[0], 10);
      try {
        await vibeRequest('POST', `/v1/chats/${numericChatId}/users`, {
          users: [this.config.botId],
        });
        console.log(`[BotWorker] Bot ${this.config.botId} rejoined chat ${dialogId}`);
      } catch (e: any) {
        console.warn(`[BotWorker] Note on rejoining chat ${dialogId}:`, e.message || e);
      }
    }
  }

  private async handoffToOperator(dialogId: string, reason?: string) {
    this.clearActiveSessionState(dialogId, { reason: reason || 'transferred_to_operator' });
    return this.leaveChat(dialogId);
  }

  async suggestDraftResponse(
    query: string,
    options?: {
      dialogId?: string;
      conversation?: Array<{ sender?: string; text?: string }> | string[];
      limit?: number;
    }
  ): Promise<{
    suggestion: string;
    matchedArticles: { id: string; title: string; score: number }[];
    matchedProducts?: Array<{
      id?: number;
      code: string;
      productCode: string;
      name: string;
      brand?: string;
      category?: string;
      categorySlug?: string;
      categoryUrl?: string;
      priceFormatted: string;
      inStock: boolean;
      url: string; // explicitly include the correct 'url' field from MeiliSearch document
      productUrl: string;
    }>;
    detectedContext?: any;
  }> {
    let conversationHistory = options?.conversation;
    if (!conversationHistory && options?.dialogId) {
      const dialog = chatManager.getDialog(options.dialogId);
      if (dialog && dialog.messages) {
        conversationHistory = dialog.messages.slice(-8);
      }
    }

    const [matchedKb, productRes] = await Promise.all([
      Promise.resolve(knowledgeBase.search(query, 3)),
      meiliProductService
        .searchByConversation(query, conversationHistory, {
          limit: options?.limit || 4,
          config: this.config.productConfig,
        })
        .catch(() => ({
          hits: [],
          total: 0,
          query,
          processingTimeMs: 0,
          detectedContext: undefined as any,
        })),
    ]);

    const kbContext = matchedKb
      .map((m) => `### ${m.article.title} (Ангилал: ${m.article.category})\n${m.article.content}`)
      .join('\n\n');

    const productContext = productRes.hits.length > 0
      ? meiliProductService.formatForPrompt(productRes.hits, this.config.productConfig)
      : '';

    const prompt = `Та бол БСБ компанийн харилцагчийн үйлчилгээний операторт туслах хиймэл оюун ухаан юм.
Оператор хэрэглэгчийн доорх асуултад шууд илгээх боломжтой, эелдэг найрсаг, тодорхой, мэргэжлийн хариултын нооргийг Монгол хэлээр боловсруулж өгнө үү.
Хэрэв бараа, бүтээгдэхүүн, үнэ, загвар, нөөц асуусан бол БСБ Барааны сангаас (MeiliSearch) олдсон бодит бүтээгдэхүүний нэр, үнэ, бэлэн байгаа эсэх мэдээллийг оруулан хариулна.

ЧУХАЛ ШААРДЛАГА - ХОЛБООС (URL):
- Барааны линкийг [Бараа үзэх](URL) эсвэл [Барааны нэр](URL) хэлбэрээр оруулахдаа дээрх MeiliSearch-ийн бодит 'url' талбарын хаягийг (https://bsb.mn/products/by-code/...) хаалтгүйгээр яг хуулж тавина.
- Өөрөө дур мэдэн буруу /product/ эсвэл ерөнхий холбоос зохиохыг ХАТУУ ХОРИГЛОНО.
- Төгсгөлд нь ангиллын холбоос байгаа бол [Ангилал: {Нэр}](URL) гэж санал болгоно уу.

--- ХЭРЭГЛЭГЧИЙН АСУУЛТ ---
${query}

${productContext ? productContext + '\n\n' : ''}--- МЭДЭЭЛЛИЙН САНГИЙН ЭХ СУРВАЛЖ ---
${kbContext || 'Одоогоор мэдээллийн сангаас шууд тохирох нийтлэл олдсонгүй.'}

Операторт шууд илгээхэд бэлэн Монгол хариулт:`;

    const mappedProducts = productRes.hits.map((p) => ({
      id: p.id,
      code: p.productCode,
      productCode: p.productCode,
      name: p.name,
      brand: p.brand,
      category: p.category,
      categorySlug: p.categorySlug,
      categoryUrl: p.categoryUrl,
      priceFormatted: p.priceFormatted,
      inStock: p.inStock,
      url: p.url, // explicit 'url' field from MeiliSearch document
      productUrl: p.url,
    }));

    try {
      const aiRes = await vibeRequest<any>('POST', '/v1/chat/completions', {
        model: this.config.model || 'bitrix/bitrixgpt-5.5',
        messages: [
          { role: 'system', content: 'Та бол БСБ операторын туслах бөгөөд бэлэн хариултыг Монгол хэлээр боловсруулдаг.' },
          { role: 'user', content: prompt },
        ],
      });

      const rawAny = aiRes as any;
      const content = (rawAny.choices?.[0]?.message?.content || rawAny.data?.choices?.[0]?.message?.content || '').trim();
      if (content) {
        const sanitizedDraft = meiliProductService.sanitizeAiResponseLinks(
          content,
          productRes.hits,
          this.config.productConfig
        );
        return {
          suggestion: sanitizedDraft,
          matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
          matchedProducts: mappedProducts,
          detectedContext: productRes.detectedContext,
        };
      }
    } catch (e) {
      console.warn('AI suggest draft error, falling back to top KB/Product content:', e);
    }

    if (productRes.hits.length > 0) {
      const items = productRes.hits.slice(0, 3).map((p, idx) => {
        const stock = p.inStock ? 'Бэлэн байгаа' : 'Нөөц түр дууссан';
        const specs = p.attributesSummary ? `\n   • Үзүүлэлт: ${p.attributesSummary}` : '';
        const productLink = p.url ? `\n   🔗 Холбоос: ${p.url}` : '';
        return `${idx + 1}. ${p.name}\n   • Үнэ: ${p.priceFormatted} (${stock})${specs}${productLink}`;
      }).join('\n\n');

      const categoryItem = productRes.hits.find((p) => p.categoryUrl && p.category && p.category.toLowerCase() !== 'category');
      const categoryName = productRes.detectedContext?.detectedCategory || categoryItem?.category || 'Бараа бүтээгдэхүүн';
      let categoryUrl = productRes.detectedContext?.categorySlug
        ? (productRes.detectedContext.categorySlug.includes('category_2287') ? 'https://bsb.mn/categories/category_2287?has_stock=true' : `https://bsb.mn/categories/${productRes.detectedContext.categorySlug}`)
        : (categoryItem?.categoryUrl || 'https://bsb.mn/categories');

      if (categoryUrl.endsWith('/categories/category') || categoryUrl.endsWith('/category')) {
        categoryUrl = 'https://bsb.mn/categories';
      }

      const catPart = categoryUrl
        ? `\n\n📁 [Ангилал: ${categoryName}](${categoryUrl})`
        : '';

      return {
        suggestion: `Сайн байна уу! БСБ-д худалдаалагдаж буй барааны мэдээллийг хүргэж байна:\n\n${items}${catPart}\n\nТанд дэлгэрэнгүй мэдээлэл хэрэгтэй бол лавлана уу!`,
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: mappedProducts,
        detectedContext: productRes.detectedContext,
      };
    }

    if (productRes.detectedContext?.detectedCategory) {
      const catName = productRes.detectedContext.detectedCategory;
      const catSlug = productRes.detectedContext.categorySlug || 'categories';
      let catUrl = `https://bsb.mn/categories/${catSlug}`;
      if (
        catName.toLowerCase().includes('буйдан') ||
        catSlug.toLowerCase().includes('buidan') ||
        catSlug.includes('2287')
      ) {
        catUrl = 'https://bsb.mn/categories/category_2287?has_stock=true';
      }
      return {
        suggestion: `Сайн байна уу! БСБ-д худалдаалагдаж буй ${catName}-ны бүх загваруудыг дараах албан ёсны холбоосоор орж сонирхох боломжтой:\n\n📁 [Ангилал: ${catName}](${catUrl})\n\nТанд сонирхож буй брэнд, үзүүлэлт байгаа бол бичнэ үү, би дэлгэрэнгүй шалгаж өгье!`,
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: [],
        detectedContext: productRes.detectedContext,
      };
    }

    if (matchedKb.length > 0) {
      return {
        suggestion: `Сайн байна уу! ${matchedKb[0].article.title} талаарх мэдээлэл:\n${matchedKb[0].article.content.slice(0, 300)}...`,
        matchedArticles: matchedKb.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        matchedProducts: [],
      };
    }

    return {
      suggestion: 'Сайн байна уу! Танд туслахад таатай байна. Та сонирхож буй бараа бүтээгдэхүүн, загвараа хэлбэл би үнэ болон бэлэн байгаа нөөцийг шалгаж өгөх боломжтой байна.',
      matchedArticles: [],
      matchedProducts: [],
    };
  }
}

export const botWorker = new BotWorkerService();
