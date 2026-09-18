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
  handoffReason?: 'keyword' | 'low_confidence' | 'ai_error' | 'user_button' | 'model_declined';
  matchedArticles: { id: string; title: string; score: number }[];
  durationMs: number;
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
};

export class BotWorkerService {
  private config: BotConfig = DEFAULT_CONFIG;
  private logs: DialogLog[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessingPoll = false;
  private processedOpenlineMessageIds = new Set<string>();

  constructor() {
    this.ensureDataDir();
    this.loadConfig();
    this.loadLogs();
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
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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

    if (!this.config.selectedLineId) {
      this.config.isPollingActive = false;
      this.saveConfig();
      console.log('[BotWorker] Polling not started: no line is bound to bot.');
      return;
    }

    this.config.isPollingActive = true;
    this.saveConfig();

    await this.resubscribeBot().catch(() => {});

    // Run first cycle immediately
    this.pollCycle().catch((err) => console.error('Immediate poll error:', err));

    // Poll every 1.2 seconds for low-latency customer event capture
    this.pollTimer = setInterval(() => {
      this.pollCycle().catch((err) => console.error('Poll error:', err));
    }, 1200);
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
    if (this.isProcessingPoll || !this.config.botId || !this.config.isPollingActive || !this.config.selectedLineId) {
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
    if (!this.config.isPollingActive || !this.config.selectedLineId || !this.config.botId) {
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
    const currentDialog = chatManager.getDialogById(dialogId);
    if (
      currentDialog &&
      (currentDialog.status === 'in_progress' ||
        currentDialog.status === 'assigned' ||
        (currentDialog.assignedAgentId && currentDialog.assignedAgentId !== 'unassigned') ||
        currentDialog.botActive === false)
    ) {
      console.log(`[BotWorker] Skipping bot auto-reply for ${dialogId}: Handled by operator ${currentDialog.assignedAgentName || currentDialog.assignedAgentId} (bot detached)`);
      return;
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
  async processMessage(dialogId: string, text: string): Promise<{ answer: string; handedOff: boolean }> {
    const startTime = Date.now();
    const botId = this.config.botId;

    if (!botId) {
      throw new Error('Bot is not registered');
    }

    // Check if dialog is assigned to an operator, in progress, or bot has detached
    const existingDialog = chatManager.getDialogById(dialogId);
    if (
      existingDialog &&
      (existingDialog.status === 'in_progress' ||
        existingDialog.status === 'assigned' ||
        (existingDialog.assignedAgentId && existingDialog.assignedAgentId !== 'unassigned') ||
        existingDialog.botActive === false)
    ) {
      console.log(`[BotWorker] Aborting bot reply for ${dialogId}: Assigned to operator ${existingDialog.assignedAgentName || existingDialog.assignedAgentId} (bot detached)`);
      return { answer: '', handedOff: false };
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
      await this.sendReply(dialogId, handoffMsg);
      await this.handoffToOperator(dialogId);
      chatManager.recordBotReply(dialogId, handoffMsg, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: handoffMsg,
        handedOff: true,
        handoffReason: lowerText === '/operator' ? 'user_button' : 'keyword',
        matchedArticles: [],
        durationMs: Date.now() - startTime,
      });

      return { answer: handoffMsg, handedOff: true };
    }

    // 2. Search Knowledge Base
    const matched = knowledgeBase.search(sanitizedText, 3);
    const topScore = matched.length > 0 ? matched[0].score : 0;

    // 3. If confidence is below threshold -> handoff to operator immediately without hallucinations
    if (matched.length === 0 || topScore < this.config.handoffThreshold) {
      const unsureMsg = "Манай мэдээллийн санд энэ асуултын талаар тодорхой мэдээлэл олдсонгүй. Танд туслахаар харилцагчийн үйлчилгээний мэргэжилтэнтэй шууд холбож байна!";
      await this.sendReply(dialogId, unsureMsg);
      await this.handoffToOperator(dialogId);
      chatManager.recordBotReply(dialogId, unsureMsg, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: unsureMsg,
        handedOff: true,
        handoffReason: 'low_confidence',
        matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        durationMs: Date.now() - startTime,
      });

      return { answer: unsureMsg, handedOff: true };
    }

    // 4. Generate answer via VibeCode AI (bitrix/bitrixgpt-5.5)
    try {
      const kbContext = matched
        .map((m) => `### ${m.article.title} (Ангилал: ${m.article.category})\n${m.article.content}`)
        .join('\n\n');

      const systemPrompt = `Та бол БСБ (BSB) компанийн нээлттэй сувгийн харилцагчийн үйлчилгээний туслах AI бот юм.
Хэрэглэгчийн асуултад зөвхөн доорх Мэдээллийн Сангийн хэсгүүдэд үндэслэн Монгол хэлээр маш тодорхой, эелдэг, найрсаг хариулна уу.
Мэдээллийн санд байхгүй зүйлийг зохиож хариулж БОЛОХГҮЙ.
Өнгө аяс: ${this.config.tone}.
${this.config.systemPromptAddition}

--- МЭДЭЭЛЛИЙН САНГИЙН ХЭСГҮҮД ---
${kbContext}

Хэрэв хэрэглэгчийн асуултын хариулт дээрх хэсгүүдэд огт байхгүй эсвэл хангалтгүй бол зөвхөн яг энэ үгийг гаргана уу: [TRANSFER_OPERATOR]`;

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
        const transferText = "Манай мэдээллийн санд энэ асуултын талаар баталгаажсан мэдээлэл хангалтгүй байгаа тул таныг мэргэжилтэнтэй холбож байна.";
        await this.sendReply(dialogId, transferText);
        await this.handoffToOperator(dialogId);
        chatManager.recordBotReply(dialogId, transferText, true, this.config.botName);

        this.addLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          dialogId,
          customerMessage: text,
          botAnswer: transferText,
          handedOff: true,
          handoffReason: 'model_declined',
          matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
          durationMs: Date.now() - startTime,
        });

        return { answer: transferText, handedOff: true };
      }

      // Send the AI answer with inline keyboard
      await this.sendReply(dialogId, aiContent, true);
      chatManager.recordBotReply(dialogId, aiContent, false, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: aiContent,
        handedOff: false,
        matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        durationMs: Date.now() - startTime,
      });

      return { answer: aiContent, handedOff: false };
    } catch (err: any) {
      console.error('[BotWorker] AI completion error:', err);
      // Fallback behavior on AI error
      const fallbackText = this.config.fallbackMessage;
      await this.sendReply(dialogId, fallbackText);
      await this.handoffToOperator(dialogId);
      chatManager.recordBotReply(dialogId, fallbackText, true, this.config.botName);

      this.addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        dialogId,
        customerMessage: text,
        botAnswer: fallbackText,
        handedOff: true,
        handoffReason: 'ai_error',
        matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        durationMs: Date.now() - startTime,
      });

      return { answer: fallbackText, handedOff: true };
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
    if (!this.config.botId || !this.config.isPollingActive || !this.config.selectedLineId) {
      return null;
    }

    if (Number(this.config.selectedLineId) !== Number(params.channelId)) {
      return null;
    }

    const msgKey = `${params.dialogId}-${params.messageId}`;
    if (this.processedOpenlineMessageIds.has(msgKey)) {
      return null;
    }
    this.processedOpenlineMessageIds.add(msgKey);

    // Check if dialog is currently in progress, assigned to an operator, or bot has detached
    const currentDialog = chatManager.getDialogById(params.dialogId);
    if (
      currentDialog &&
      (currentDialog.status === 'in_progress' ||
        currentDialog.status === 'assigned' ||
        (currentDialog.assignedAgentId && currentDialog.assignedAgentId !== 'unassigned') ||
        currentDialog.botActive === false)
    ) {
      console.log(`[BotWorker] Skipping openline message processing for ${params.dialogId}: Handled by operator ${currentDialog.assignedAgentName || currentDialog.assignedAgentId} (bot detached)`);
      return null;
    }

    // Хэрэв горим нь зөвхөн заасан тухайлсан чатад холбогдох ('manual_only') бол botActive === true байхыг шалгана
    if (this.config.botAssignmentMode === 'manual_only' && !currentDialog?.botActive) {
      console.log(`[BotWorker] Skipping openline message processing for ${params.dialogId}: Manual assignment mode is active and bot is not connected to this chat`);
      return null;
    }

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

    // Ensure bot is in chat if it is a real Bitrix chat (e.g. chat75386)
    const match = dialogId.match(/\d+/);
    if (match) {
      const numericChatId = parseInt(match[0], 10);
      await vibeRequest('POST', `/v1/chats/${numericChatId}/users`, {
        users: [this.config.botId],
      }).catch(() => {});
    }

    const body: any = {
      dialogId,
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

    try {
      const res = await vibeRequest<any>('POST', `/v1/bots/${this.config.botId}/messages`, body);
      if (res && res.success) {
        return;
      }
      console.warn('[BotWorker] Bot message endpoint warning, falling back to chat message:', res?.error);
    } catch (e) {
      console.warn('[BotWorker] Bot message request error, falling back to chat message:', e);
    }

    // Fallback: Send directly to chat
    try {
      await vibeRequest('POST', `/v1/chats/${dialogId}/messages`, {
        message: `🤖 [${this.config.botName}]\n\n${message}`,
      });
      console.log(`[BotWorker] Sent reply via fallback chat endpoint to ${dialogId}`);
    } catch (err2) {
      console.error('[BotWorker] Fallback chat message failed too:', err2);
    }
  }

  /**
   * Оператор чатыг өөртөө авах эсвэл шилжүүлэх үед ботыг харилцан ярианаас гаргах (салгах)
   */
  public async leaveChat(dialogId: string) {
    if (!this.config.botId || !dialogId || dialogId.startsWith('sim-')) return;

    try {
      // In Bitrix24 Openlines, when welcome bot leaves the chat, the dialog transfers to the operator queue!
      await vibeRequest('POST', `/v1/bots/${this.config.botId}/chats/${dialogId}/leave`);
      console.log(`[BotWorker] Bot ${this.config.botId} left chat ${dialogId} (operator takeover / handoff)`);
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

  private async handoffToOperator(dialogId: string) {
    return this.leaveChat(dialogId);
  }

  async suggestDraftResponse(query: string): Promise<{ suggestion: string; matchedArticles: { id: string; title: string; score: number }[] }> {
    const matched = knowledgeBase.search(query, 3);
    const kbContext = matched
      .map((m) => `### ${m.article.title} (Ангилал: ${m.article.category})\n${m.article.content}`)
      .join('\n\n');

    const prompt = `Та бол БСБ компанийн харилцагчийн үйлчилгээний операторт туслах хиймэл оюун ухаан юм.
Оператор хэрэглэгчийн доорх асуултад шууд илгээх боломжтой, эелдэг найрсаг, тодорхой, мэргэжлийн хариултын нооргийг Монгол хэлээр боловсруулж өгнө үү.
Хэрэв мэдээллийн сангаас хариулт олдохгүй бол хэрэглэгчид найрсаг хандан дэлгэрэнгүй тодруулах эсвэл шууд холбогдох боломжтой хариулт санал болгоно уу.

--- ХЭРЭГЛЭГЧИЙН АСУУЛТ ---
${query}

--- МЭДЭЭЛЛИЙН САНГИЙН ЭХ СУРВАЛЖ ---
${kbContext || 'Одоогоор мэдээллийн сангаас шууд тохирох нийтлэл олдсонгүй.'}

Операторт шууд илгээхэд бэлэн Монгол хариулт:`;

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
        return {
          suggestion: content,
          matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
        };
      }
    } catch (e) {
      console.warn('AI suggest draft error, falling back to top KB article content:', e);
    }

    if (matched.length > 0) {
      return {
        suggestion: `Сайн байна уу! ${matched[0].article.title} талаарх мэдээлэл:\n${matched[0].article.content.slice(0, 300)}...`,
        matchedArticles: matched.map((m) => ({ id: m.article.id, title: m.article.title, score: m.score })),
      };
    }

    return {
      suggestion: 'Сайн байна уу! Танд туслахад таатай байна. Та асуултаа тодруулж хэлбэл би шалгаж өгөх боломжтой байна.',
      matchedArticles: [],
    };
  }
}

export const botWorker = new BotWorkerService();
