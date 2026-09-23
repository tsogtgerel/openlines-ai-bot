/**
 * ============================================================================
 * 🤖 BSB Bitrix24 Open Lines AI Bot & Omnichannel Workplace - Main Server
 * ============================================================================
 * 
 * Энэхүү сервер нь БСБ-гийн харилцагчийн үйлчилгээний нэгдсэн систем бөгөөд:
 * 1. Bitrix24 Open Lines (Facebook, WebChat, Telegram, Instagram, WhatsApp) интеграци
 * 2. Google Gemini & BitrixGPT суурьтай AI ботын автомат хариулт ба операторт шилжүүлэлт (Handoff)
 * 3. Харилцагчийн асуултыг суваг бүрээр цуглуулж ангилах, AI зөвлөмж & тайлан гаргах (Inquiry Analytics)
 * 4. Операторын нэгдсэн ажлын байр (Live Workplace), чатын удирдлага, CRM мэдээлэл
 * 5. Операторуудын ажлын цаг бүртгэл (Clock-in, Clock-out, Break) болон ээлжийн хяналт
 * 6. Хөгжүүлэлтийн үед Vite middleware, үйлдвэрлэлийн (Production) үед Single-Page App статик серверийг гүйцэтгэнэ.
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import {
  vibeRequest,
  crmCreateDeal,
  crmUpdateLead,
  crmGetLead,
  crmGetDeal,
  crmGetStatuses,
  BITRIX_PORTAL_DOMAIN,
} from './server/vibeApi';
import { knowledgeBase } from './server/knowledgeBase';
import { botWorker } from './server/botWorker';
import { chatManager } from './server/chatManager';
import { worktimeManager } from './server/worktimeManager';
import { bitrixAgentsService } from './server/bitrixAgentsService';
import { bitrixOpenlinesSync } from './server/bitrixOpenlinesSync';
import { inquiryAnalyticsService } from './server/inquiryAnalyticsService';
import { typingManager } from './server/typingManager';
import { meiliProductService } from './server/meiliProductService';
import { crmContextResolver } from './server/crmContextResolver';

// .env файлын тохиргоог ачааллах
dotenv.config();

// Стандарт контейнер болон Nginx-ийн эхлэх порт
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // WebSocket broadcast forwarder reference
  let broadcastWs: (data: any, excludeWs?: WebSocket) => void = () => {};

  // Allow embedding in Bitrix24 iframe and mobile app webview
  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    next();
  });

  // Serve PWA Web App Manifest with correct MIME type
  app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.webmanifest'));
  });

  // ==========================================================================
  // 1. Health Check & Bitrix24 Portal Profile API
  // ==========================================================================
  /**
   * GET /api/health
   * Серверийн амьд төлөв (liveness/readiness probe)-ийг шалгах зориулалттай.
   */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * GET /api/me
   * Холбогдсон Bitrix24 порталын нэр, ID болон тарифын мэдээллийг буцаана.
   */
  app.get('/api/me', async (req, res) => {
    try {
      const resp = await vibeRequest('GET', '/v1/me');
      res.json(resp);
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 2. Open Lines & Bitrix Assigned Agents API
  // ==========================================================================
  /**
   * GET /api/openlines
   * Бүх нээлттэй сувгуудын жагсаалт ба суваг бүрт хуваарилагдсан бодит агентуудын мэдээлэл.
   */
  app.get('/api/openlines', async (req, res) => {
    try {
      // Кэшлэгдсэн эсвэл шинэчилсэн сувгийн өгөгдлийг татах
      const syncResult = await bitrixAgentsService.syncAgents(false);
      res.json({
        success: true,
        data: syncResult.lines,
        total: syncResult.lines.length,
        meta: {
          lastSyncTime: syncResult.lastSyncTime,
          totalOperatorLinks: syncResult.totalOperatorLinks,
          totalUniqueAgents: syncResult.totalUniqueAgents,
          fromCache: syncResult.fromCache,
        },
      });
    } catch (e: any) {
      console.warn('Falling back to basic openline-configs:', e.message);
      try {
        const resp = await vibeRequest('GET', '/v1/openline-configs');
        res.json(resp);
      } catch (err: any) {
        res.status(500).json({ success: false, error: { message: err.message } });
      }
    }
  });

  /**
   * POST /api/openlines/sync-agents
   * Bitrix24 Openlines-аас хамгийн сүүлийн үеийн агентууд болон сувгуудыг хүчээр (force) татаж синк хийнэ.
   */
  app.post('/api/openlines/sync-agents', async (req, res) => {
    try {
      const syncResult = await bitrixAgentsService.syncAgents(true); // force fresh sync
      // Цаг бүртгэлийн менежер дэх ажилтнуудын бүртгэлийг шинэчлэх
      worktimeManager.syncWithBitrixAgents(syncResult.uniqueAgents);
      res.json({
        success: true,
        data: syncResult,
        message: `Амжилттай татлаа: ${syncResult.lines.length} сувгаас ${syncResult.totalUniqueAgents} агент татагдлаа.`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/openlines/:id/agents
   * Сонгосон сувгийн ID-аар зөвхөн тухайн сувагт ажиллах эрхтэй операторуудыг буцаана.
   */
  app.get('/api/openlines/:id/agents', async (req, res) => {
    try {
      const lineId = parseInt(req.params.id, 10);
      const agents = bitrixAgentsService.getAgentsForChannel(lineId);
      res.json({ success: true, data: agents });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 3. Bitrix24 AI Bot Registration, Configuration & Event Polling
  // ==========================================================================
  /**
   * GET /api/bot/status
   * Ботын одоогийн тохиргоо (сонгогдсон суваг, полинг идэвхтэй эсэх, ботын нэр) болон Bitrix дэх төлөвийг авна.
   */
  app.get('/api/bot/status', async (req, res) => {
    try {
      const config = botWorker.getConfig();
      let botDetails = null;
      if (config.botId) {
        const botsList = await vibeRequest<any>('GET', '/v1/bots');
        botDetails = botsList.data?.bots?.find((b: any) => b.id === config.botId);
      }
      res.json({
        success: true,
        data: {
          config,
          botDetails,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/register
   * Bitrix24 порталд шинэ бот бүртгэх эсвэл байгаа ботод холбогдох.
   */
  app.post('/api/bot/register', async (req, res) => {
    try {
      const { name, code } = req.body;
      const bot = await botWorker.registerOrAttachBot(name, code);
      res.json({ success: true, data: bot });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PATCH /api/bot/config
   * Ботын параметрүүдийг (өнгө аяс, хэл, операторт шилжүүлэх босго оноо, систем промпт) шинэчлэх.
   */
  app.patch('/api/bot/config', (req, res) => {
    try {
      const updated = botWorker.updateConfig(req.body);
      res.json({ success: true, data: updated });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/bind-openline
   * Тодорхой нээлттэй сувгийн Welcome ботоор BSB AI ботыг холбох.
   */
  app.post('/api/bot/bind-openline', async (req, res) => {
    try {
      const { lineId, lineName } = req.body;
      if (!lineId) {
        return res.status(400).json({ success: false, error: { message: 'lineId is required' } });
      }
      await botWorker.bindToOpenLine(Number(lineId), lineName || `Line ${lineId}`);
      res.json({ success: true, data: { bound: true, lineId } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/unbind-openline
   * Сувгаас ботыг салгаж, зөвхөн амьд операторуудын дараалалд шилжүүлэх.
   */
  app.post('/api/bot/unbind-openline', async (req, res) => {
    try {
      const { lineId } = req.body;
      const targetLineId = lineId ? Number(lineId) : botWorker.getConfig().selectedLineId;
      if (targetLineId) {
        await botWorker.unbindFromOpenLine(Number(targetLineId));
      } else {
        botWorker.updateConfig({ selectedLineId: null, selectedLineName: '' });
        botWorker.stopPolling();
      }
      res.json({ success: true, data: { unbound: true, lineId: targetLineId, config: botWorker.getConfig() } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/resubscribe
   * Bitrix24 бот ивэнт хүлээж авахгүй гацсан үед вебхүүк/эвэнтийг дахин бүртгэх.
   */
  app.post('/api/bot/resubscribe', async (req, res) => {
    try {
      const ok = await botWorker.resubscribeBot();
      res.json({ success: ok, message: ok ? 'Бот амжилттай дахин бүртгэгдлээ' : 'Бүртгэл амжилтгүй' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/toggle-polling
   * Bitrix мессежүүдийг шалгах автомат таймерыг асаах / унтраах.
   */
  app.post('/api/bot/toggle-polling', async (req, res) => {
    try {
      const { active } = req.body;
      if (active) {
        await botWorker.startPolling();
      } else {
        botWorker.stopPolling();
      }
      res.json({ success: true, data: { isPollingActive: botWorker.getConfig().isPollingActive } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 4. Knowledge Base (Мэдээллийн Сан) CRUD & Search API
  // ==========================================================================
  /**
   * GET /api/kb
   * Хадгалагдсан бүх зааварчилгаа, мэдээллийн нийтлэлүүдийг жагсаана.
   */
  app.get('/api/kb', (req, res) => {
    res.json({ success: true, data: knowledgeBase.getAll() });
  });

  /**
   * POST /api/kb
   * Мэдээллийн санд шинээр нийтлэл, түгээмэл асуултын хариулт нэмнэ.
   */
  app.post('/api/kb', (req, res) => {
    try {
      const { title, category, content, keywords } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, error: { message: 'Title and content are required' } });
      }
      const created = knowledgeBase.add({
        title,
        category: category || 'General',
        content,
        keywords: Array.isArray(keywords) ? keywords : (keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
      });
      res.json({ success: true, data: created });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PUT /api/kb/:id
   * Тодорхой нийтлэлийн агуулга, түлхүүр үгийг засах.
   */
  app.put('/api/kb/:id', (req, res) => {
    try {
      const updated = knowledgeBase.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: { message: 'Article not found' } });
      }
      res.json({ success: true, data: updated });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * DELETE /api/kb/:id
   * Мэдээллийн сангаас нийтлэл устгах.
   */
  app.delete('/api/kb/:id', (req, res) => {
    try {
      const deleted = knowledgeBase.delete(req.params.id);
      res.json({ success: true, data: { deleted } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/kb/search?q=...
   * Түлхүүр үгийн жин болон текстээр хайлт хийх.
   */
  app.get('/api/kb/search', (req, res) => {
    const q = (req.query.q as string) || '';
    const results = knowledgeBase.search(q);
    res.json({ success: true, data: results });
  });

  // ==========================================================================
  // 4.1. BSB Products MeiliSearch Catalog API (https://meili.bsb.mn)
  // ==========================================================================
  /**
   * GET /api/products/search?q=...&limit=...&inStockOnly=true
   * MeiliSearch сангаас барааны нэр, бренд, үзүүлэлтээр хайх.
   */
  app.get('/api/products/search', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const inStockOnly = req.query.inStockOnly === 'true';
      const botConfig = botWorker.getConfig();
      const result = await meiliProductService.searchProducts(q, {
        limit,
        inStockOnly,
        config: botConfig.productConfig,
      });
      res.json({ success: true, data: result, config: botConfig.productConfig });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/products/format-preview
   * Өгөгдсөн тохиргоогоор барааны мэдээлэл болон линк AI prompt-д хэрхэн орохыг урьдчилан харах.
   */
  app.post('/api/products/format-preview', async (req, res) => {
    try {
      const { query = 'зурагт', config, contextualIntentDetection } = req.body || {};
      const activeConfig = config || botWorker.getConfig().productConfig;
      const isContextualIntentActive = contextualIntentDetection !== undefined
        ? contextualIntentDetection
        : (botWorker.getConfig().contextualIntentDetection !== false);

      const convRes = await meiliProductService.searchByConversation(query, [], {
        limit: 3,
        config: activeConfig,
        contextualIntentDetection: isContextualIntentActive,
      });

      const detectedContext = convRes.detectedContext;
      const hits = convRes.hits;
      const promptText = hits.length > 0 ? meiliProductService.formatForPrompt(hits, activeConfig) : '';

      res.json({
        success: true,
        data: {
          hits,
          promptText,
          config: activeConfig,
          detectedContext,
          contextualIntentActive: isContextualIntentActive,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/products/resolve-url
   * Standardized URL resolution endpoint: checks specific BSB product structure,
   * explicitly retrieves 'url', validates existence of product-specific page,
   * and falls back to category-level link if missing.
   */
  app.post('/api/products/resolve-url', (req, res) => {
    try {
      const { product, options } = req.body || {};
      const resolved = meiliProductService.resolveProductUrl(product, options);
      res.json({ success: true, data: resolved });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/products/stats
   * MeiliSearch холболт болон нийт барааны статистик төлөв авах.
   */
  app.get('/api/products/stats', async (req, res) => {
    try {
      const stats = await meiliProductService.getStats();
      res.json({ success: true, data: stats });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/products/:code
   * Бүтээгдэхүүний кодоор дэлгэрэнгүй мэдээлэл авах.
   */
  app.get('/api/products/:code', async (req, res) => {
    try {
      const product = await meiliProductService.getProductByCode(req.params.code);
      if (!product) {
        return res.status(404).json({ success: false, error: { message: 'Бүтээгдэхүүн олдсонгүй' } });
      }
      res.json({ success: true, data: product });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/meili/indices
   * MeiliSearch дээрх бүх 5 индексийн (app_bsb_products, app_bsb_taxons, app_bsb_brands, app_bsb_product_terms, app_bsb_attributes)
   * холболт, нийт баримтын тоо, статусыг нэгтгэн авах.
   */
  app.get('/api/meili/indices', async (req, res) => {
    try {
      const stats = await meiliProductService.getAllIndicesStats();
      res.json({ success: true, data: stats });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/meili/terms
   * app_bsb_product_terms индексээс буцаалтын нөхцөл, хүргэлтийн нөхцөл, төлбөрийн албан ёсны заалтуудыг авах.
   */
  app.get('/api/meili/terms', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const terms = await meiliProductService.searchProductTerms(q);
      res.json({ success: true, data: terms });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/meili/brands
   * app_bsb_brands индексээс 140+ албан ёсны брэнд, лого, барааны тоог хайх/авах.
   */
  app.get('/api/meili/brands', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const brands = await meiliProductService.searchBrands(q, limit);
      res.json({ success: true, data: brands });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/meili/taxons
   * app_bsb_taxons индексээс 620+ барааны ангилал, шатлал, холбоос (slug)-ийг хайх/авах.
   */
  app.get('/api/meili/taxons', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const taxons = await meiliProductService.searchTaxons(q, limit);
      res.json({ success: true, data: taxons });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/meili/attributes
   * app_bsb_attributes индексээс 160+ техникийн үзүүлэлт, шүүлтүүрийн шинж чанарыг хайх/авах.
   */
  app.get('/api/meili/attributes', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const attributes = await meiliProductService.searchAttributes(q, limit);
      res.json({ success: true, data: attributes });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 5. Logs & Live Testing Simulator API
  // ==========================================================================
  /**
   * GET /api/logs
   * Бүх нээлттэй сувгийн харилцан яриа, ботын лог болон операторын шилжүүлэлтийн бодит түүх
   */
  app.get('/api/logs', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const filter = (req.query.filter as string) || 'all'; // 'all' | 'answered' | 'handed_off'
      const channelId = req.query.channelId as string;
      const search = ((req.query.search as string) || '').toLowerCase().trim();

      // 1. Get real dialogs from chatManager
      const allDialogs = chatManager.getAllDialogs();
      const realLogs = allDialogs.map((d) => {
        const custMsgs = d.messages.filter((m) => m.sender === 'customer');
        const lastCust = custMsgs[custMsgs.length - 1];
        const lastCustText = lastCust?.text || d.lastMessageText || 'Харилцагчийн асуулт';

        const agentMsgs = d.messages.filter((m) => m.sender === 'agent' && !m.isInternalNote);
        const replies = d.messages.filter(
          (m) => (m.sender === 'agent' || m.sender === 'bot') && !m.isInternalNote
        );
        const lastReply = replies[replies.length - 1];

        let durationMs = 0;
        if (lastCust && lastReply) {
          const diff = new Date(lastReply.timestamp).getTime() - new Date(lastCust.timestamp).getTime();
          if (diff > 0 && diff < 86400000) {
            durationMs = diff;
          }
        }

        const isHandedOff = d.status !== 'bot' || Boolean(d.assignedAgentId) || agentMsgs.length > 0;
        let handoffReason: string | undefined = undefined;
        if (isHandedOff) {
          if (d.assignedAgentName || d.assignedAgentId) {
            handoffReason = 'assigned_to_operator';
          } else if (lastCustText.toLowerCase().includes('/operator') || lastCustText.includes('оператор')) {
            handoffReason = 'user_button';
          } else if (d.status === 'closed') {
            handoffReason = 'manual_transfer';
          } else {
            handoffReason = 'keyword';
          }
        }

        let responderType: 'bot' | 'agent' | 'system' = 'system';
        let responderName = 'Систем';
        let responderAvatar: string | undefined = undefined;
        if (lastReply) {
          responderType = lastReply.sender as 'bot' | 'agent';
          responderName =
            lastReply.senderName ||
            (lastReply.sender === 'bot' ? 'BSB AI Туслах' : d.assignedAgentName || 'Оператор');
          responderAvatar = lastReply.senderAvatar || d.assignedAgentAvatar || undefined;
        } else if (d.assignedAgentName) {
          responderType = 'agent';
          responderName = d.assignedAgentName;
          responderAvatar = d.assignedAgentAvatar || undefined;
        }

        let botAnswerText = 'Операторын хариу хүлээгдэж буй...';
        if (lastReply) {
          botAnswerText = lastReply.text;
        } else if (d.status === 'closed') {
          botAnswerText = d.resolutionSummary || 'Чат амжилттай шийдвэрлэгдэж хаагдсан.';
        }

        return {
          id: `log-${d.id}`,
          dialogId: d.dialogId || d.id,
          chatId: d.id,
          timestamp: d.lastMessageTime || d.createdAt,
          customerName: d.customer.name,
          customerAvatar: d.customer.avatar,
          channelId: d.channelId,
          channelName: d.channelName,
          channelType: d.channelType,
          customerMessage: lastCustText,
          botAnswer: botAnswerText,
          responderType,
          responderName,
          responderAvatar,
          status: d.status,
          handedOff: isHandedOff,
          handoffReason,
          matchedArticles: (d.customer.tags || []).map((t) => ({ id: t, title: t, score: 0.9 })),
          durationMs,
          messagesCount: d.messages.length,
        };
      });

      // 2. Combine with bot worker simulator logs
      const botLogs = botWorker.getLogs(50).map((l) => ({
        ...l,
        chatId: l.dialogId,
        customerName: 'Симулятор хэрэглэгч',
        channelId: 'simulator',
        channelName: 'Туршилтын симулятор',
        channelType: 'webchat' as const,
        responderType: (l.handedOff ? 'agent' : 'bot') as 'agent' | 'bot',
        responderName: l.handedOff ? 'Оператор' : 'BSB AI Туслах',
        status: l.handedOff ? 'assigned' : 'closed',
      }));

      // Merge and sort newest first
      const combined = [...realLogs, ...botLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply filtering
      let filtered = combined;
      if (filter === 'answered') {
        filtered = filtered.filter((l) => !l.handedOff);
      } else if (filter === 'handed_off') {
        filtered = filtered.filter((l) => l.handedOff);
      }

      if (channelId && channelId !== 'all') {
        filtered = filtered.filter((l) => String(l.channelId || '') === String(channelId));
      }

      if (search) {
        filtered = filtered.filter(
          (l) =>
            (l.customerName && l.customerName.toLowerCase().includes(search)) ||
            (l.customerMessage && l.customerMessage.toLowerCase().includes(search)) ||
            (l.botAnswer && l.botAnswer.toLowerCase().includes(search)) ||
            (l.dialogId && l.dialogId.toLowerCase().includes(search)) ||
            (l.channelName && l.channelName.toLowerCase().includes(search))
        );
      }

      res.json({
        success: true,
        data: filtered.slice(0, limit),
        total: filtered.length,
        stats: {
          totalLogs: combined.length,
          handedOffCount: combined.filter((l) => l.handedOff).length,
          answeredCount: combined.filter((l) => !l.handedOff).length,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/test-simulate
   * Вэбээс ботыг шууд турших симулятор. Бодит харилцагчид мессеж очихгүйгээр AI хэрхэн хариулахыг шалгана.
   */
  app.post('/api/test-simulate', async (req, res) => {
    try {
      const { message, dialogId } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: { message: 'Message text is required' } });
      }
      const testDialogId = dialogId || `sim-${Date.now()}`;
      const outcome = await botWorker.processMessage(testDialogId, message);
      res.json({
        success: true,
        data: outcome,
        handoff: outcome.handoff || outcome.handedOff || false,
        sessionCleared: outcome.sessionCleared || false,
        chatId: testDialogId,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/ask
   * POST /api/bot/chat
   * POST /api/bot/respond
   * Backend API handler for AI responses:
   * Returns AI answer or a 'handoff' signal when a chat is transferred to an agent.
   * Clears the active session state for that specific chat ID in AI memory to prevent the bot
   * from responding to messages meant for the human agent.
   */
  app.post(['/api/bot/ask', '/api/bot/chat', '/api/bot/respond'], async (req, res) => {
    try {
      const { message, text, dialogId, chatId } = req.body || {};
      const targetMessage = (message || text || '').trim();
      const targetChatId = dialogId || chatId || `chat-${Date.now()}`;

      if (!targetMessage) {
        return res.status(400).json({ success: false, error: { message: 'Message or text is required' } });
      }

      // Check if session is already handed off before invoking AI
      const dialog = chatManager.getDialog(targetChatId) || chatManager.getDialogById(targetChatId);
      const isBotActive = Boolean(dialog?.botActive || dialog?.status === 'bot');
      if (!isBotActive && botWorker.isSessionHandedOff(targetChatId)) {
        const agentName = dialog?.assignedAgentName || dialog?.assignedAgentId || 'хүний оператор';
        return res.json({
          success: true,
          data: {
            answer: '',
            handedOff: true,
            handoff: true,
            handoffReason: 'transferred_to_agent',
            transferredToAgent: agentName,
            chatId: targetChatId,
            sessionCleared: true,
          },
          handoff: true,
          signal: 'handoff',
          handedOff: true,
          sessionCleared: true,
          chatId: targetChatId,
          transferredToAgent: agentName,
          message: 'Chat has been handed off to an agent. Bot response suppressed.',
        });
      }

      const outcome = await botWorker.processMessage(targetChatId, targetMessage);

      res.json({
        success: true,
        data: outcome,
        handoff: outcome.handoff || outcome.handedOff || false,
        signal: (outcome.handoff || outcome.handedOff) ? 'handoff' : undefined,
        handedOff: outcome.handedOff || false,
        sessionCleared: outcome.sessionCleared || false,
        chatId: targetChatId,
        transferredToAgent: outcome.transferredToAgent,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/handoff
   * POST /api/chats/:id/handoff
   * Explicit handoff signal endpoint: transfers chat to human agent and immediately
   * clears the active session state and memory for that specific chat ID.
   */
  app.post(['/api/bot/handoff', '/api/chats/:id/handoff'], async (req, res) => {
    try {
      const chatId = req.params.id || req.body.chatId || req.body.dialogId;
      const { agentId, agentName, reason } = req.body || {};

      if (!chatId) {
        return res.status(400).json({ success: false, error: { message: 'Chat ID is required' } });
      }

      // Update dialog in chatManager
      const existing = chatManager.getDialog(chatId) || chatManager.getDialogById(chatId);
      if (existing) {
        if (agentId && agentName) {
          chatManager.transferDialog(chatId, agentId, agentName);
        } else {
          chatManager.detachBotFromChat(chatId, agentName || 'Хүний оператор');
        }
      }

      // Clear active session state in bot memory
      const result = botWorker.clearActiveSessionState(chatId, {
        reason: reason || 'transferred_to_agent',
        transferredToAgent: agentName || existing?.assignedAgentName || 'Оператор',
      });

      const targetId = existing?.dialogId || existing?.id || chatId;
      await botWorker.leaveChat(targetId);

      res.json({
        success: true,
        handoff: true,
        signal: 'handoff',
        chatId,
        sessionCleared: true,
        transferredToAgent: agentName || existing?.assignedAgentName || 'Оператор',
        reason: reason || 'transferred_to_agent',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/bot/sessions
   * List all tracked AI sessions and their handoff status
   */
  app.get('/api/bot/sessions', (req, res) => {
    try {
      const sessions = botWorker.getAllActiveSessions();
      res.json({ success: true, data: sessions, total: sessions.length });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/bot/sessions/:chatId
   * Get session status and AI memory for a specific chat ID
   */
  app.get('/api/bot/sessions/:chatId', (req, res) => {
    try {
      const session = botWorker.getSession(req.params.chatId);
      const isHandedOff = botWorker.isSessionHandedOff(req.params.chatId);
      res.json({
        success: true,
        data: session || null,
        isHandedOff,
        chatId: req.params.chatId,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/bot/sessions/:chatId/reactivate
   * Reactivate bot session memory and reset handoff flag for a specific chat ID
   */
  app.post('/api/bot/sessions/:chatId/reactivate', async (req, res) => {
    try {
      const chatId = req.params.chatId;
      chatManager.connectBotToChat(chatId);
      botWorker.reactivateBotSession(chatId);
      res.json({
        success: true,
        chatId,
        message: `Bot session reactivated and connected to ${chatId}`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 5.1 Customer Inquiries Analytics & AI Report Generation API
  // ==========================================================================
  /**
   * GET /api/analytics/inquiries?channels=...
   * Сувгуудаас цуглуулсан бодит асуултуудыг семантик ангилалтайгаар шүүн авна.
   */
  app.get('/api/analytics/inquiries', (req, res) => {
    try {
      const channelsParam = req.query.channels as string;
      const channelIds = channelsParam ? channelsParam.split(',').filter(Boolean) : undefined;
      const inquiries = inquiryAnalyticsService.getInquiries(channelIds);
      res.json({
        success: true,
        data: inquiries,
        total: inquiries.length,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/analytics/generate-report
   * Сонгосон сувгуудаар бүлэглэж, ихэвчлэн асуудаг асуултуудад AI бэлэн хариулт & удирдлагын тайлан гаргана.
   */
  app.post('/api/analytics/generate-report', async (req, res) => {
    try {
      const { channels, forceAi, timeRange, startDate, endDate } = req.body || {};
      const channelIds = Array.isArray(channels) ? channels : undefined;
      const report = await inquiryAnalyticsService.generateReport(
        channelIds,
        Boolean(forceAi),
        timeRange,
        startDate,
        endDate
      );
      res.json({
        success: true,
        data: report,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/analytics/agent-performance
   * Оператор тус бүрийн гүйцэтгэлийн үзүүлэлт: хариуцсан нийт чат, дундаж хариулах хугацаа, AI ашиглалт
   */
  app.get('/api/analytics/agent-performance', (req, res) => {
    try {
      const { channels, timeRange, startDate, endDate } = req.query;
      let channelIds: string[] | undefined;
      if (typeof channels === 'string') {
        channelIds = channels.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const stats = inquiryAnalyticsService.getAgentPerformanceStats(
        channelIds,
        typeof timeRange === 'string' ? timeRange : undefined,
        typeof startDate === 'string' ? startDate : undefined,
        typeof endDate === 'string' ? endDate : undefined
      );
      res.json({
        success: true,
        data: stats,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/analytics/add-to-kb
   * AI-аар үүсгэсэн оновчтой хариултыг 1 товшилтоор ботын мэдээллийн санд нэмж сургана.
   */
  app.post('/api/analytics/add-to-kb', (req, res) => {
    try {
      const { title, category, content, keywords } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: { message: 'Title and content are required' } });
      }
      const created = knowledgeBase.add({
        title,
        category: category || 'Харилцагчийн түгээмэл асуулт',
        content,
        keywords: Array.isArray(keywords)
          ? keywords
          : (keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
      });
      res.json({
        success: true,
        data: created,
        message: 'Амжилттай Мэдээллийн санд нэмэгдлээ!',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 6. Infrastructure (VibeCode Cloud Servers)
  // ==========================================================================
  /**
   * GET /api/infra/servers
   * Байршуулах боломжтой серверүүдийн жагсаалт ба статус.
   */
  app.get('/api/infra/servers', async (req, res) => {
    try {
      const resp = await vibeRequest('GET', '/v1/infra/servers');
      res.json(resp);
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/infra/servers/create
   * Шинэ VPS үүлэн сервер үүсгэх хүсэлт.
   */
  app.post('/api/infra/servers/create', async (req, res) => {
    try {
      const { name, plan, region, image } = req.body;
      const resp = await vibeRequest('POST', '/v1/infra/servers', {
        provider: 'bitrix-cloud',
        name: name || 'openlines-ai-bot',
        plan: plan || 'bc-small',
        region: region || 'bc-eu-central',
        image: image || 'ubuntu-2404-lts',
      });
      res.json(resp);
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/infra/servers/:id/deploy
   * Сервер рүү ботын шинэ хувилбарыг автоматаар deploy хийх.
   */
  app.post('/api/infra/servers/:id/deploy', async (req, res) => {
    try {
      const { id } = req.params;
      const resp = await vibeRequest('POST', `/v1/infra/servers/${id}/deploy`, req.body);
      res.json(resp);
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 7. Omnichannel Chat & Open Channel Workplace (Операторын нэгдсэн ажлын байр)
  // ==========================================================================
  /**
   * POST /api/chats/sync
   * Bitrix24 Open Lines-ийн бодит сесс, чатуудыг татаж дотоод чатын сантай синк хийнэ.
   */
  app.post('/api/chats/sync', async (req, res) => {
    try {
      const syncResult = await bitrixOpenlinesSync.syncOpenlineSessions(40);
      const requestingAgentId = (req.body && req.body.requestingAgentId) || (req.query && req.query.requestingAgentId);
      const targetAgent = requestingAgentId
        ? worktimeManager.getAgentById(requestingAgentId as string)
        : worktimeManager.getCurrentAgent();

      const dialogs = chatManager.getAllDialogs({
        agentAccessRole: targetAgent?.accessRole,
        agentAssignedChannelIds: targetAgent?.assignedChannelIds,
        requestingAgentId: targetAgent?.id,
        requestingBitrixUserId: targetAgent?.bitrixUserId,
        canAccessAllChannels: targetAgent?.canAccessAllChannels,
      });
      res.json({
        success: true,
        data: {
          ...syncResult,
          status: bitrixOpenlinesSync.getStatus(),
          dialogs,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/chats/sync-status
   * Автомат синкийн хамгийн сүүлийн цаг, давтамж, төлөвийн мэдээллийг авна.
   */
  app.get('/api/chats/sync-status', (req, res) => {
    res.json({ success: true, data: bitrixOpenlinesSync.getStatus() });
  });

  /**
   * GET /api/chats/stream
   * Real-time Server-Sent Events (SSE) stream for instant, low-latency push of incoming messages
   * and chat updates. Reduces message latency from 3-6 seconds down to <50ms.
   */
  app.get('/api/chats/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const requestingAgentId = req.query.requestingAgentId as string;
    const targetAgent = requestingAgentId
      ? worktimeManager.getAgentById(requestingAgentId)
      : worktimeManager.getCurrentAgent();

    // Initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ version: chatManager.getVersion(), time: new Date().toISOString() })}\n\n`);

    const changeListener = (eventData: any) => {
      try {
        // Enforce RBAC permission filtering for agents
        if (targetAgent && targetAgent.accessRole === 'agent' && eventData.dialog) {
          const d = eventData.dialog;
          if (!targetAgent.canAccessAllChannels && Array.isArray(targetAgent.assignedChannelIds)) {
            const allowed = targetAgent.assignedChannelIds.map(String);
            if (!allowed.includes(String(d.channelId))) {
              return;
            }
          }
          const isUnassigned = (!d.assignedAgentId || d.assignedAgentId === 'unassigned') && d.status !== 'in_progress' && d.status !== 'assigned';
          
          const myIdSet = new Set<string>();
          if (targetAgent.id) {
            myIdSet.add(targetAgent.id);
            if (targetAgent.id.startsWith('bx-')) myIdSet.add(targetAgent.id.replace('bx-', ''));
            else myIdSet.add(`bx-${targetAgent.id}`);
          }
          if (targetAgent.bitrixUserId) {
            myIdSet.add(String(targetAgent.bitrixUserId));
            myIdSet.add(`bx-${targetAgent.bitrixUserId}`);
          }

          const dAgentId = String(d.assignedAgentId || '');
          const dClosedId = String(d.closedByAgentId || '');
          const isAssigned = Boolean(dAgentId && myIdSet.has(dAgentId));
          const isClosed = Boolean(dClosedId && myIdSet.has(dClosedId));

          // Allow dialog:update events for chats in allowed channels so agent UI immediately reflects transfers
          if (eventData.type !== 'dialog:update' && !isUnassigned && !isAssigned && !isClosed) {
            return;
          }
        }

        console.log(`[SSE:StateSync] Pushing ${eventData.type || 'message'} event to client:`, {
          dialogId: eventData.dialogId,
          assignedAgentId: eventData.dialog?.assignedAgentId,
          assignedAgentName: eventData.dialog?.assignedAgentName,
          status: eventData.dialog?.status,
        });
        res.write(`event: ${eventData.type || 'message'}\ndata: ${JSON.stringify(eventData)}\n\n`);
      } catch {
        // Socket may have closed
      }
    };

    chatManager.on('change', changeListener);

    // Keep-alive heartbeat ping every 15s
    const pingTimer = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch {
        clearInterval(pingTimer);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingTimer);
      chatManager.off('change', changeListener);
      res.end();
    });
  });

  /**
   * GET /api/chats/delta
   * Lightweight delta sync endpoint: only returns dialogs modified since `since` version.
   * If unchanged, responds with ~50 bytes in ~2ms instead of full dialog history.
   */
  app.get('/api/chats/delta', (req, res) => {
    try {
      const sinceVersion = parseInt(req.query.since as string, 10) || 0;
      const { status, channelId, channelType, assignedAgentId, closedByAgentId, search, isStarred, sortBy, requestingAgentId } = req.query;
      const targetAgent = requestingAgentId
        ? worktimeManager.getAgentById(requestingAgentId as string)
        : worktimeManager.getCurrentAgent();

      const delta = chatManager.getDelta(sinceVersion, {
        status: status as string,
        channelId: channelId as string,
        channelType: channelType as string,
        assignedAgentId: assignedAgentId as string,
        closedByAgentId: closedByAgentId as string,
        search: search as string,
        isStarred: isStarred !== undefined ? isStarred === 'true' : undefined,
        sortBy: sortBy as any,
        agentAccessRole: targetAgent?.accessRole,
        agentAssignedChannelIds: targetAgent?.assignedChannelIds,
        requestingAgentId: targetAgent?.id,
        requestingBitrixUserId: targetAgent?.bitrixUserId,
        canAccessAllChannels: targetAgent?.canAccessAllChannels,
      });

      res.json({ success: true, data: delta });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/chats
   * Шүүлтүүр (status, channelId, channelType, search, isStarred)-тэйгээр бүх чатыг авах.
   */
  app.get('/api/chats', (req, res) => {
    try {
      const { status, channelId, channelType, assignedAgentId, closedByAgentId, search, isStarred, sortBy, requestingAgentId } = req.query;
      const targetAgent = requestingAgentId
        ? worktimeManager.getAgentById(requestingAgentId as string)
        : worktimeManager.getCurrentAgent();

      const dialogs = chatManager.getAllDialogs({
        status: status as string,
        channelId: channelId as string,
        channelType: channelType as string,
        assignedAgentId: assignedAgentId as string,
        closedByAgentId: closedByAgentId as string,
        search: search as string,
        isStarred: isStarred !== undefined ? isStarred === 'true' : undefined,
        sortBy: sortBy as any,
        agentAccessRole: targetAgent?.accessRole,
        agentAssignedChannelIds: targetAgent?.assignedChannelIds,
        requestingAgentId: targetAgent?.id,
        requestingBitrixUserId: targetAgent?.bitrixUserId,
        canAccessAllChannels: targetAgent?.canAccessAllChannels,
      });
      res.json({ success: true, data: dialogs });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/chats/:id
   * Нэг харилцан ярианы дэлгэрэнгүй, мессежийн түүх, харилцагчийн CRM профайлыг авах.
   */
  app.get('/api/chats/:id', (req, res) => {
    try {
      const dialog = chatManager.getDialogById(req.params.id);
      if (!dialog) {
        return res.status(404).json({ success: false, error: { message: 'Chat dialog not found' } });
      }
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/sync
   * Зөвхөн тухайн нэг чатын шинэ мессежүүдийг Bitrix24-өөс шуурхай (1-2 секундэд) татах.
   */
  app.post('/api/chats/:id/sync', async (req, res) => {
    try {
      const dialog = await bitrixOpenlinesSync.syncSingleChat(req.params.id);
      if (!dialog) {
        return res.status(404).json({ success: false, error: { message: 'Chat dialog not found' } });
      }
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/active
   * Операторын дэлгэц дээр идэвхтэй нээлттэй байгаа чатыг мэдэгдэх (тэргүүн ээлжинд синк хийхэд ашиглана).
   */
  app.post('/api/chats/active', (req, res) => {
    try {
      const { chatId } = req.body;
      bitrixOpenlinesSync.setActiveChatId(chatId || null);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/messages
   * Чатад оператор хариу бичих, эсвэл дотоод санамж (whisper note) үлдээх.
   * Хэрэв бодит Bitrix чат бол мессежийг шууд Bitrix24 REST API-аар илгээнэ.
   */
  app.post('/api/chats/:id/messages', async (req, res) => {
    try {
      const { id } = req.params;
      const { text, sender, senderName, senderAvatar, senderAgentId, isInternalNote } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: { message: 'Message text is required' } });
      }

      const outcome = chatManager.sendMessage(id, {
        text: text.trim(),
        sender: sender || 'agent',
        senderName,
        senderAvatar,
        senderAgentId,
        isInternalNote: Boolean(isInternalNote),
      });

      // Clear typing indicator for the message author
      try {
        const afterTypers = typingManager.setTyping(
          id,
          { agentId: senderAgentId || senderName || sender || 'user', name: senderName || 'User' },
          false
        );
        const clearTypingEvent = { type: 'typing:update', dialogId: id, typers: afterTypers };
        broadcastWs(clearTypingEvent);
        chatManager.emit('change', clearTypingEvent);
      } catch {}

      // Хэрэв оператор бодит харилцагчид бичиж байгаа бол Bitrix24 чат руу илгээнэ
      if (sender === 'agent' && !isInternalNote) {
        const dialogId = outcome.dialog.dialogId || outcome.dialog.id;
        const match = dialogId ? dialogId.match(/\d+/) : null;
        if (match) {
          try {
            const numericChatId = parseInt(match[0], 10);
            await bitrixOpenlinesSync.sendMessageToBitrixChat(
              `chat${numericChatId}`,
              text.trim(),
              senderName || outcome.dialog.assignedAgentName
            );
          } catch (sendErr: any) {
            console.warn('[Server] Could not send message to Bitrix Chat:', sendErr.message);
          }
        }
      }

      // Хэрэв харилцагч бичсэн бөгөөд чат дээр бот идэвхтэй бол автоматаар AI хариулт үүсгэнэ
      if (sender === 'customer') {
        const dialog = outcome.dialog;
        const botCfg = botWorker.getConfig();
        const shouldBotReply =
          dialog.botActive === true ||
          (botCfg.botAssignmentMode === 'all_chats' &&
            dialog.status !== 'in_progress' &&
            dialog.status !== 'assigned' &&
            dialog.botActive !== false &&
            !dialog.assignedAgentId);

        if (shouldBotReply && dialog.status !== 'closed') {
          // For local/simulation chats only. Real Bitrix Openlines chats are handled authoritatively by bitrixOpenlinesSync
          // to prevent duplicate AI triggers and race conditions.
          const match = (dialog.dialogId || dialog.id)?.match(/\d+/);
          const isBitrixOpenlineChat = Boolean(match && !dialog.id.startsWith('sim-'));

          if (!isBitrixOpenlineChat) {
            setTimeout(async () => {
              try {
                await botWorker.processMessage(dialog.id, text.trim());
              } catch (botErr: any) {
                console.error('[Server] Bot response error for customer message:', botErr.message);
              }
            }, 350);
          }
        }
      }

      res.json({ success: true, data: outcome });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/typing
   * Real-time typing notification endpoint (WebSocket & polling fallback)
   */
  app.post('/api/chats/:id/typing', (req, res) => {
    try {
      const { id } = req.params;
      const { isTyping, agentId, name, role, avatar } = req.body || {};
      const typers = typingManager.setTyping(
        id,
        {
          agentId: agentId || name || 'user',
          name: name || 'Оператор',
          role: role || 'agent',
          avatar,
        },
        Boolean(isTyping)
      );

      const typingEvent = { type: 'typing:update', dialogId: id, typers };
      broadcastWs(typingEvent);
      chatManager.emit('change', typingEvent);

      res.json({ success: true, data: { dialogId: id, typers } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/chats/:id/typing
   * Get active typers for a specific dialog
   */
  app.get('/api/chats/:id/typing', (req, res) => {
    try {
      const typers = typingManager.getTypers(req.params.id);
      res.json({ success: true, data: { dialogId: req.params.id, typers } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/chats/typing/all
   * Get all active typers mapped across all dialogs
   */
  app.get('/api/chats/typing/all', (req, res) => {
    try {
      const all = typingManager.getAllActiveTypers();
      res.json({ success: true, data: all });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/simulate-typing
   * Simulate a customer or operator typing for a duration (e.g. 4 seconds)
   */
  app.post('/api/chats/:id/simulate-typing', (req, res) => {
    try {
      const { id } = req.params;
      const { name, role, durationMs } = req.body || {};
      const targetName = name || 'Харилцагч';
      const targetRole = role || 'customer';
      const duration = Number(durationMs) || 4000;
      const simId = `sim-typing-${Date.now()}`;

      const typers = typingManager.setTyping(
        id,
        { agentId: simId, name: targetName, role: targetRole },
        true
      );
      const startEvent = { type: 'typing:update', dialogId: id, typers };
      broadcastWs(startEvent);
      chatManager.emit('change', startEvent);

      setTimeout(() => {
        const afterTypers = typingManager.setTyping(
          id,
          { agentId: simId, name: targetName, role: targetRole },
          false
        );
        const stopEvent = { type: 'typing:update', dialogId: id, typers: afterTypers };
        broadcastWs(stopEvent);
        chatManager.emit('change', stopEvent);
      }, duration);

      res.json({ success: true, message: `${targetName} бичиж эхэллээ... (${duration / 1000}с)` });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/read
   * Чат дахь уншаагүй мессежийн тоог 0 болгож тэмдэглэх.
   */
  app.post('/api/chats/:id/read', (req, res) => {
    try {
      const dialog = chatManager.markAsRead(req.params.id);
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PATCH /api/chats/:id
   * Чатын статусыг (in_progress, closed, bot) эсвэл чухал тэмдэглэгээ (starred)-г шинэчлэх.
   * Хэрэв оператор чатыг өөртөө авсан бол (assignedAgentId эсвэл in_progress) ботыг салгана.
   */
  app.patch('/api/chats/:id', async (req, res) => {
    try {
      const updated = chatManager.updateDialog(req.params.id, req.body);
      const match = (updated.dialogId || updated.id)?.match(/\d+/);
      const numId = match ? parseInt(match[0], 10) : NaN;

      if (req.body.status === 'in_progress' && !isNaN(numId) && numId > 0) {
        let bxUserId: number | undefined;
        if (req.body.assignedAgentId) {
          const agent = worktimeManager.getAgentById(req.body.assignedAgentId);
          if (agent?.bitrixUserId) {
            bxUserId = agent.bitrixUserId;
          } else {
            const parsed = parseInt(String(req.body.assignedAgentId).replace(/^bx-/, ''), 10);
            if (!isNaN(parsed) && parsed > 0) bxUserId = parsed;
          }
        }
        await bitrixOpenlinesSync.answerOperatorChat(numId, bxUserId);
      } else if ((req.body.status === 'new' || req.body.assignedAgentId === null) && !isNaN(numId) && numId > 0) {
        bitrixOpenlinesSync.clearLocalAssignment(numId);
      }

      let isHandoff = false;
      // Хэрэв оператор өөртөө авсан эсвэл in_progress болсон бол ботыг чатнаас салгах (leave) ба AI сессийг цэвэрлэх
      if (req.body.assignedAgentId || req.body.status === 'in_progress') {
        const targetId = updated.dialogId || updated.id;
        if (targetId) {
          await botWorker.leaveChat(targetId);
        }
        botWorker.clearActiveSessionState(req.params.id, {
          reason: 'assigned_to_operator',
          transferredToAgent: updated.assignedAgentName || req.body.assignedAgentName,
        });
        isHandoff = true;
      }

      res.json({
        success: true,
        data: updated,
        handoff: isHandoff,
        signal: isHandoff ? 'handoff' : undefined,
        sessionCleared: isHandoff,
        chatId: req.params.id,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/return-to-bot
   * POST /api/chats/:id/connect-bot
   * Оператор харилцан яриаг эргүүлэн AI Туслах Бот руу шилжүүлэх (Re-activate/connect bot)
   */
  app.post(['/api/chats/:id/return-to-bot', '/api/chats/:id/connect-bot'], async (req, res) => {
    try {
      const config = botWorker.getConfig();
      const botName = config.botName || 'BSB AI Туслах';
      let dialog: any = null;
      try {
        dialog = chatManager.connectBotToChat(req.params.id, botName);
        if (dialog.dialogId) {
          await botWorker.rejoinChat(dialog.dialogId);
        }
      } catch (notFoundErr) {
        // If dialog was created dynamically or in simulator, rejoin directly
        await botWorker.rejoinChat(req.params.id);
      }
      botWorker.reactivateBotSession(req.params.id);

      // Оператор чатыг бот руу шилжүүлэх үед өмнө нь оператортой бичиж байсан хуучин чатад хариулахгүй.
      // Бот зөвхөн шилжүүлснээс хойш харилцагчаас ирэх шинэ асуултыг хүлээн авч хариулна.

      res.json({
        success: true,
        data: dialog,
        handoff: false,
        botActive: true,
        chatId: req.params.id,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/detach-bot
   * Бот-ыг тухайн чатнаас салгаж, операторын дараалалд шилжүүлэх
   */
  app.post('/api/chats/:id/detach-bot', async (req, res) => {
    try {
      const { operatorName } = req.body || {};
      const dialog = chatManager.detachBotFromChat(req.params.id, operatorName || 'Оператор');
      if (dialog.dialogId) {
        await botWorker.leaveChat(dialog.dialogId);
      }
      botWorker.clearActiveSessionState(req.params.id, {
        reason: 'detach_bot_to_operator',
        transferredToAgent: operatorName || 'Оператор',
      });
      res.json({
        success: true,
        data: dialog,
        handoff: true,
        signal: 'handoff',
        sessionCleared: true,
        chatId: req.params.id,
        transferredToAgent: operatorName || 'Оператор',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/transfer
   * Чатыг өөр мэргэшсэн оператор руу шилжүүлэх (Re-assign).
   * Идэвхтэй AI сесс ба санах ойг цэвэрлэж, handoff дохиог буцаана.
   */
  app.post('/api/chats/:id/transfer', async (req, res) => {
    try {
      const { targetAgentId, targetAgentName, targetAgentAvatar } = req.body;
      if (!targetAgentId || !targetAgentName) {
        return res.status(400).json({ success: false, error: { message: 'Target agent details required' } });
      }

      // Resolve Bitrix user ID for target agent
      let bxUserId: number | undefined;
      const agent = worktimeManager.getAgentById(targetAgentId);
      if (agent?.bitrixUserId) {
        bxUserId = agent.bitrixUserId;
      } else {
        const parsed = parseInt(String(targetAgentId).replace(/^bx-/, ''), 10);
        if (!isNaN(parsed) && parsed > 0) bxUserId = parsed;
      }

      const finalAgentId = agent?.id || targetAgentId;
      const finalAgentName = agent?.name || targetAgentName;
      const finalAgentAvatar = agent?.avatar || targetAgentAvatar;

      const dialog = chatManager.transferDialog(req.params.id, finalAgentId, finalAgentName, finalAgentAvatar);

      console.log(`[Transfer:StateSync] Chat ${req.params.id} transferred to ${finalAgentName} (${finalAgentId}):`, {
        dialogId: dialog.id,
        numericId: dialog.dialogId,
        assignedAgentId: dialog.assignedAgentId,
        assignedAgentName: dialog.assignedAgentName,
        status: dialog.status,
      });

      // Perform transfer in Bitrix24 Openlines
      const match = (dialog.dialogId || dialog.id)?.match(/\d+/);
      if (match && bxUserId) {
        const numId = parseInt(match[0], 10);
        if (!isNaN(numId) && numId > 0) {
          bitrixOpenlinesSync.recordLocalAssignment(numId, bxUserId);
          await bitrixOpenlinesSync.transferOperatorChat(numId, bxUserId);
          try {
            await bitrixOpenlinesSync.sendMessageToBitrixChat(
              dialog.dialogId || `chat${numId}`,
              `Систем: Харилцан яриаг оператор ${finalAgentName}-д шилжүүллээ.`
            );
          } catch (mErr: any) {
            console.warn('[Transfer] Failed to send bitrix transfer notice:', mErr.message);
          }
        }
      }

      if (dialog.dialogId) {
        await botWorker.leaveChat(dialog.dialogId);
      }
      botWorker.clearActiveSessionState(req.params.id, {
        reason: 'transferred_to_agent',
        transferredToAgent: finalAgentName,
      });

      res.json({
        success: true,
        data: dialog,
        handoff: true,
        signal: 'handoff',
        sessionCleared: true,
        chatId: req.params.id,
        transferredToAgent: finalAgentName,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/close
   * Асуудлыг шийдвэрлэж чатыг хаах, шалтгааны хураангуйг тэмдэглэх.
   * Мөн Bitrix24 дээрх CRM Lead-ийг хаах (CONVERTED эсвэл JUNK) болон Deal үүсгэх үйлдлийг хамт гүйцэтгэнэ.
   */
  app.post('/api/chats/:id/close', async (req, res) => {
    try {
      const {
        resolutionSummary,
        closedByAgentId,
        closedByAgentName,
        closedByAgentAvatar,
        leadAction, // 'keep_open' | 'close_converted' | 'close_junk' | 'create_deal'
        dealData, // { title: string; amount?: number; currency?: string; stageId?: string; comments?: string }
      } = req.body;

      let dialog = chatManager.closeDialog(
        req.params.id,
        resolutionSummary,
        closedByAgentId,
        closedByAgentName,
        closedByAgentAvatar
      );
      worktimeManager.incrementResolvedChat(closedByAgentId);

      // 1. Bitrix24 Openlines чатын сессийг дуусгах
      if (dialog.dialogId?.startsWith('chat')) {
        const numId = parseInt(dialog.dialogId.replace('chat', ''), 10);
        if (!isNaN(numId)) {
          await bitrixOpenlinesSync.finishOperatorChat(numId);
        }
      }

      // 2. Lead ID-г илрүүлэх (Харилцагчийн crmLeadId эсвэл холбогдох дугаараас)
      let numericLeadId: number | null = null;
      if (dialog.customer?.crmLeadId) {
        const match = dialog.customer.crmLeadId.match(/LEAD[-_]?(\d+)/i);
        if (match) {
          numericLeadId = parseInt(match[1], 10);
        }
      }

      // 3. CRM Lead болон Deal үйлдлүүд
      if (leadAction === 'close_converted' && numericLeadId) {
        try {
          await crmUpdateLead(numericLeadId, {
            stageId: 'CONVERTED',
            comments: `Чатын шийдвэрлэлт: ${resolutionSummary || 'Амжилттай хаагдсан'}. Оператор: ${closedByAgentName || 'Ажилтан'}`,
          });
          dialog = chatManager.updateCustomerCrm(
            dialog.id,
            `LEAD-${numericLeadId}`,
            'Lead амжилттай',
            `Систем: Bitrix24 дээрх Сэжим (LEAD-${numericLeadId})-ийн төлөв "Амжилттай / Converted" болж хаагдлаа.`
          );
        } catch (crmErr: any) {
          console.warn('[CRM] Failed to convert lead:', crmErr.message);
        }
      } else if (leadAction === 'close_junk' && numericLeadId) {
        try {
          await crmUpdateLead(numericLeadId, {
            stageId: 'JUNK',
            comments: `Цуцалсан шалтгаан: ${resolutionSummary || 'Хэрэггүй сэжим'}. Оператор: ${closedByAgentName || 'Ажилтан'}`,
          });
          dialog = chatManager.updateCustomerCrm(
            dialog.id,
            `LEAD-${numericLeadId}`,
            'Lead цуцалсан',
            `Систем: Bitrix24 дээрх Сэжим (LEAD-${numericLeadId}) "Хэрэггүй сэжим / Junk" төлөвт шилжиж хаагдлаа.`
          );
        } catch (crmErr: any) {
          console.warn('[CRM] Failed to junk lead:', crmErr.message);
        }
      } else if (leadAction === 'create_deal') {
        try {
          const dealTitle = dealData?.title || `Хэлцэл: ${dialog.customer.name || 'Харилцагч'}`;
          const dealAmount = Number(dealData?.amount) || 0;
          const dealCurrency = dealData?.currency || 'MNT';
          const dealStage = dealData?.stageId || 'NEW';

          const dealRes = await crmCreateDeal({
            title: dealTitle,
            amount: dealAmount,
            currency: dealCurrency,
            stageId: dealStage,
            leadId: numericLeadId || null,
            comments: `Чатаас хаах үед үүсгэсэн хэлцэл. Оператор: ${closedByAgentName || 'Ажилтан'}. Шийдвэрлэлт: ${resolutionSummary || 'Шийдвэрлэсэн'}.`,
          });

          // Lead-ийг давхар Converted болгох
          if (numericLeadId) {
            await crmUpdateLead(numericLeadId, {
              stageId: 'CONVERTED',
              comments: `Хэлцэл үүсгэж хаасан: ${dealTitle}`,
            });
          }

          if (dealRes?.data?.id) {
            const newDealId = dealRes.data.id;
            dialog = chatManager.updateCustomerCrm(
              dialog.id,
              `DEAL-${newDealId}`,
              'Deal үүссэн',
              `Систем: Bitrix24 CRM дээр шинэ хэлцэл (DEAL-${newDealId} - "${dealTitle}", ${dealAmount.toLocaleString()} ${dealCurrency}) амжилттай үүслээ.`
            );
          }
        } catch (crmErr: any) {
          console.warn('[CRM] Failed to create deal on chat close:', crmErr.message);
        }
      }

      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/create-deal
   * Чат явагдаж байх дундуур эсвэл дууссаны дараа Bitrix24 CRM дээр шинэ хэлцэл (Deal) шууд үүсгэх.
   */
  app.post('/api/chats/:id/create-deal', async (req, res) => {
    try {
      const dialog = chatManager.getDialogById(req.params.id);
      if (!dialog) {
        return res.status(404).json({ success: false, error: { message: 'Dialog not found' } });
      }

      const {
        title,
        amount,
        currency = 'MNT',
        stageId = 'NEW',
        comments,
        convertLead = true,
        operatorName,
      } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, error: { message: 'Deal title is required' } });
      }

      // 1. Lead ID-г илрүүлэх
      let numericLeadId: number | null = null;
      if (dialog.customer?.crmLeadId) {
        const match = dialog.customer.crmLeadId.match(/LEAD[-_]?(\d+)/i);
        if (match) {
          numericLeadId = parseInt(match[1], 10);
        }
      }

      // 2. Bitrix24 дээр Deal үүсгэх
      const dealRes = await crmCreateDeal({
        title,
        amount: Number(amount) || 0,
        currency,
        stageId,
        leadId: numericLeadId || null,
        comments: comments || `Чатын ажлын талбараас үүсгэсэн хэлцэл. Оператор: ${operatorName || dialog.assignedAgentName || 'Оператор'}`,
      });

      if (!dealRes?.data?.id) {
        return res.status(500).json({
          success: false,
          error: { message: dealRes?.error?.message || 'Failed to create deal in Bitrix24' },
        });
      }

      const createdDeal = dealRes.data;

      // 3. Хэрэв сонгосон бол холбогдох Lead-ийг "CONVERTED" болгож төлөвийг ахиулах
      if (convertLead && numericLeadId) {
        try {
          await crmUpdateLead(numericLeadId, {
            stageId: 'CONVERTED',
            comments: `Хэлцэл үүсгэсэн: DEAL-${createdDeal.id} - ${title}`,
          });
        } catch (err: any) {
          console.warn('[CRM] Lead convert failed:', err.message);
        }
      }

      // 4. Диалогийн харилцагчийн CRM холбоос болон чатын мессежийг шинэчлэх
      const updatedDialog = chatManager.updateCustomerCrm(
        dialog.id,
        `DEAL-${createdDeal.id}`,
        'Deal үүссэн',
        `Систем: Bitrix24 CRM дээр шинэ хэлцэл (DEAL-${createdDeal.id} - "${title}", ${(Number(amount) || 0).toLocaleString()} ${currency}) амжилттай үүслээ.`
      );

      res.json({
        success: true,
        data: {
          deal: createdDeal,
          dialog: updatedDialog,
          portalUrl: `https://${BITRIX_PORTAL_DOMAIN}/crm/deal/details/${createdDeal.id}/`,
        },
      });
    } catch (e: any) {
      console.error('[CRM] Error creating deal:', e);
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PATCH /api/chats/:id/lead-status
   * Харилцагчийн холбогдох Bitrix24 Lead-ийн төлөвийг (Status) шууд шинэчлэх.
   */
  app.patch('/api/chats/:id/lead-status', async (req, res) => {
    try {
      const dialog = chatManager.getDialogById(req.params.id);
      if (!dialog) {
        return res.status(404).json({ success: false, error: { message: 'Dialog not found' } });
      }

      const { stageId, comment, operatorName } = req.body;
      if (!stageId) {
        return res.status(400).json({ success: false, error: { message: 'stageId is required' } });
      }

      let numericLeadId: number | null = null;
      if (dialog.customer?.crmLeadId) {
        const match = dialog.customer.crmLeadId.match(/LEAD[-_]?(\d+)/i);
        if (match) {
          numericLeadId = parseInt(match[1], 10);
        }
      }

      if (!numericLeadId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Энэ харилцагч дээр холбогдсон Bitrix Lead дугаар олдсонгүй.' },
        });
      }

      const updateRes = await crmUpdateLead(numericLeadId, {
        stageId,
        comments: comment || `Төлөв өөрчилсөн: ${stageId}. Оператор: ${operatorName || 'Оператор'}`,
      });

      let updatedDialog = chatManager.updateCustomerCrm(
        dialog.id,
        `LEAD-${numericLeadId}`,
        `Lead ${stageId}`,
        `Систем: Bitrix24 дээрх Сэжим (LEAD-${numericLeadId})-ийн төлөв "${stageId}" болж шинэчлэгдлээ.`
      );

      if (stageId === 'CONVERTED' || stageId === 'JUNK') {
        const dialogNum = dialog.dialogId ? parseInt(dialog.dialogId.replace(/\D/g, ''), 10) : null;
        if (dialogNum) {
          await bitrixOpenlinesSync.finishOperatorChat(dialogNum).catch(() => {});
        }
        updatedDialog = chatManager.closeDialog(
          dialog.id,
          `Lead ${stageId === 'CONVERTED' ? 'Амжилттай' : 'Ашиггүй/Цуцалсан'}`,
          undefined,
          operatorName || 'Оператор'
        );
      }

      res.json({
        success: true,
        data: {
          lead: updateRes.data,
          dialog: updatedDialog,
          portalUrl: `https://${BITRIX_PORTAL_DOMAIN}/crm/lead/details/${numericLeadId}/`,
        },
      });
    } catch (e: any) {
      console.error('[CRM] Error updating lead status:', e);
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/crm/options
   * Bitrix24 CRM-ийн тохиргоо, Lead төлөвүүд болон Deal үе шатуудыг авах.
   */
  app.get('/api/crm/options', async (req, res) => {
    try {
      // Default standard Bitrix options
      const defaultLeadStatuses = [
        { statusId: 'NEW', name: 'Шинэ (New)', color: '#fff55a' },
        { statusId: 'IN_PROCESS', name: 'Тодруулж буй (Inquiry)', color: '#2fc6f6' },
        { statusId: 'UC_H2NTK9', name: 'Ангилсан / Шилжүүлсэн', color: '#a5de00' },
        { statusId: 'CONVERTED', name: 'Амжилттай / Deal үүсгэх', color: '#00ff00' },
        { statusId: 'JUNK', name: 'Ашиггүй / Цуцалсан (Junk)', color: '#ff5752' },
      ];

      const defaultDealStages = [
        { statusId: 'NEW', name: 'Шинэ (New)', color: '#39a8ef' },
        { statusId: 'PREPARATION', name: 'Санал бэлтгэх (Offer)', color: '#2fc6f6' },
        { statusId: 'PREPAYMENT_INVOICE', name: 'Нэхэмжлэх илгээсэн', color: '#55d0e0' },
        { statusId: 'EXECUTING', name: 'Гүйцэтгэж буй', color: '#47e4c2' },
        { statusId: 'WON', name: 'Амжилттай (Deal Won)', color: '#7bd500' },
        { statusId: 'LOSE', name: 'Цуцалсан (Deal Lost)', color: '#ff5752' },
      ];

      res.json({
        success: true,
        data: {
          portalDomain: BITRIX_PORTAL_DOMAIN,
          leadStatuses: defaultLeadStatuses,
          dealStages: defaultDealStages,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/crm/session-context/:dialogId
   * Чат сессийн одоогийн шийдвэрлэсэн CRM төлөв (Active Lead, Active Deal, Repeat Customer)-ийг авах.
   */
  app.get('/api/crm/session-context/:dialogId', async (req, res) => {
    try {
      const dialogId = req.params.dialogId;
      const dialog = chatManager.getDialogById(dialogId);
      const cached = crmContextResolver.getCachedContext(dialogId);

      if (cached) {
        return res.json({ success: true, data: cached });
      }

      if (dialog) {
        const match = dialogId.match(/\d+/);
        const numericChatId = match ? parseInt(match[0], 10) : undefined;
        const botCfg = botWorker.getConfig();
        const resolved = await crmContextResolver.resolveSessionContext({
          dialogId,
          chatId: numericChatId,
          customer: dialog.customer,
          messageText: dialog.lastMessageText || '',
          crmMode: botCfg.crmMode || 'classic',
          channelSource: dialog.channelType || 'openlines',
        });
        return res.json({ success: true, data: resolved });
      }

      res.status(404).json({ success: false, error: { message: 'Dialog not found' } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/crm/resolve-session-context
   * [SESSION CONTEXT RESOLUTION RULE] гаднаас эсвэл тестийн зорилгоор гар аргаар дуудах.
   */
  app.post('/api/crm/resolve-session-context', async (req, res) => {
    try {
      const { dialogId, chatId, userCode, customer, messageText, crmMode, channelSource } = req.body;
      const botCfg = botWorker.getConfig();
      const resolved = await crmContextResolver.resolveSessionContext({
        dialogId: dialogId || `chat${chatId || Date.now()}`,
        chatId: chatId ? Number(chatId) : undefined,
        userCode,
        customer,
        messageText: messageText || '',
        crmMode: crmMode || botCfg.crmMode || 'classic',
        channelSource: channelSource || 'openlines',
      });
      res.json({ success: true, data: resolved });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/crm/contacts
   * Системд бүртгэгдсэн болон кэшлэгдсэн CRM харилцагчдын жагсаалт.
   */
  app.get('/api/crm/contacts', (req, res) => {
    try {
      const contacts = crmContextResolver.getAllStoredContacts();
      res.json({ success: true, count: contacts.length, data: contacts });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/reopen
   * Хаагдсан чатыг дахин сэргээж нээх.
   */
  app.post('/api/chats/:id/reopen', async (req, res) => {
    try {
      const { agentId, agentName, agentAvatar } = req.body || {};
      const dialog = chatManager.reopenDialog(req.params.id, agentId, agentName, agentAvatar);
      if (dialog.dialogId?.startsWith('chat')) {
        const numId = parseInt(dialog.dialogId.replace('chat', ''), 10);
        if (!isNaN(numId)) {
          let bitrixUserId = 0;
          if (dialog.assignedAgentId) {
            bitrixUserId = parseInt(String(dialog.assignedAgentId).replace(/^bx-/, ''), 10);
          }
          bitrixOpenlinesSync.markChatReopened(numId, bitrixUserId > 0 ? bitrixUserId : undefined);
          if (bitrixUserId > 0) {
            bitrixOpenlinesSync.recordLocalAssignment(numId, bitrixUserId);
            await bitrixOpenlinesSync.answerOperatorChat(numId, bitrixUserId).catch(() => {});
          }
        }
      }
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/simulate
   * Сургалт болон тест хийх зорилгоор гаднаас шинэ харилцагчийн мессеж ирэх үйл явцыг дуурайлгах.
   */
  app.post('/api/chats/simulate', (req, res) => {
    try {
      const { customerName, message, channelType, channelName, channelId } = req.body;
      if (!customerName || !message) {
        return res.status(400).json({ success: false, error: { message: 'Customer name and message are required' } });
      }
      const dialog = chatManager.simulateIncomingCustomerMessage(
        customerName,
        message,
        channelType || 'facebook',
        channelName || 'БСБ Мебель - Facebook - Comments',
        channelId || 39
      );
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/ai-suggest
   * Операторт хариу бичихэд туслах AI бэлэн ноорог (Draft response)-ийг Мэдээллийн сангаас үндэслэн бэлтгэх.
   */
  app.post('/api/chats/ai-suggest', async (req, res) => {
    try {
      const { query, dialogId, conversation } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: { message: 'Query is required for AI suggestion' } });
      }
      const suggestion = await botWorker.suggestDraftResponse(query, {
        dialogId,
        conversation,
      });
      res.json({ success: true, data: suggestion });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 8. Agent Worktime & Clock-In / Clock-Out (Ажлын цагийн бүртгэл & Ээлж)
  // ==========================================================================
  /**
   * GET /api/worktime/status
   * Одоо нэвтэрсэн операторын ээлжийн статус (ажиллаж байгаа, завсарласан, нийт шийдсэн чат гэх мэт) болон багийн бүх гишүүд.
   * Bitrix24 timeman бодит төлөвтэй шууд синхрончлогдоно.
   */
  app.get('/api/worktime/status', async (req, res) => {
    try {
      const requestedAgentId = (req.query.agentId as string) || undefined;
      let currentAgent = requestedAgentId
        ? worktimeManager.getAgentById(requestedAgentId) || worktimeManager.getCurrentAgent()
        : worktimeManager.getCurrentAgent();

      let bitrixLiveStatus: any = null;

      // Bitrix24 portal-аас timeman төлөвийг шалгаж шууд синхрончлох
      if (currentAgent && currentAgent.bitrixUserId) {
        try {
          const bResp = await vibeRequest('GET', `/v1/workday/status?userId=${currentAgent.bitrixUserId}`);
          if (bResp.success && bResp.data) {
            bitrixLiveStatus = bResp.data;
            const synced = worktimeManager.syncAgentWorkdayFromBitrix(currentAgent.id, bResp.data);
            currentAgent = synced.agent;
          }
        } catch (err: any) {
          console.warn(`[WorkdaySync] /v1/workday/status error for user ${currentAgent.bitrixUserId}:`, err?.message || err);
        }
      }

      const currentShift = worktimeManager.getCurrentShift(currentAgent.id);
      const team = worktimeManager.getAllAgents();

      // Active agent personal performance today (chats handled today & current average response time)
      const todayStats = inquiryAnalyticsService.getAgentPerformanceStats(undefined, 'today');
      const activeAgentPerf = todayStats.find(
        (s) => s.agentId === currentAgent.id || s.name.trim().toLowerCase() === currentAgent.name.trim().toLowerCase()
      );

      const personalPerformance = activeAgentPerf
        ? {
            chatsHandledToday: activeAgentPerf.totalChatsHandled,
            resolvedToday: activeAgentPerf.resolvedChatsCount,
            activeChatsCount: activeAgentPerf.activeChatsCount,
            avgResponseTimeSeconds: activeAgentPerf.avgResponseTimeSeconds,
            avgResponseTimeFormatted: activeAgentPerf.avgResponseTimeFormatted,
            rating: activeAgentPerf.rating,
          }
        : {
            chatsHandledToday: currentShift?.chatsResolved || 0,
            resolvedToday: currentShift?.chatsResolved || 0,
            activeChatsCount: 0,
            avgResponseTimeSeconds: 45,
            avgResponseTimeFormatted: '45 сек',
            rating: 4.9,
          };

      res.json({
        success: true,
        data: {
          currentAgent,
          currentShift,
          team,
          bitrixLive: bitrixLiveStatus,
          personalPerformance,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/sync-bitrix
   * Bitrix24 timeman төлөвийг хүчээр дахин татаж бүхэлд нь синхрончлох
   */
  app.post('/api/worktime/sync-bitrix', async (req, res) => {
    try {
      const { agentId } = req.body;
      const targetAgent = agentId ? worktimeManager.getAgentById(agentId) : worktimeManager.getCurrentAgent();
      if (!targetAgent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      let bitrixLiveStatus: any = null;
      if (targetAgent.bitrixUserId) {
        const bResp = await vibeRequest('GET', `/v1/workday/status?userId=${targetAgent.bitrixUserId}`);
        if (bResp.success && bResp.data) {
          bitrixLiveStatus = bResp.data;
          worktimeManager.syncAgentWorkdayFromBitrix(targetAgent.id, bResp.data);
        }
      }

      const updatedAgent = worktimeManager.getAgentById(targetAgent.id);
      const shift = worktimeManager.getCurrentShift(targetAgent.id);

      // Active agent personal performance today
      const todayStats = inquiryAnalyticsService.getAgentPerformanceStats(undefined, 'today');
      const activeAgentPerf = todayStats.find(
        (s) => s.agentId === targetAgent.id || s.name.trim().toLowerCase() === targetAgent.name.trim().toLowerCase()
      );

      const personalPerformance = activeAgentPerf
        ? {
            chatsHandledToday: activeAgentPerf.totalChatsHandled,
            resolvedToday: activeAgentPerf.resolvedChatsCount,
            activeChatsCount: activeAgentPerf.activeChatsCount,
            avgResponseTimeSeconds: activeAgentPerf.avgResponseTimeSeconds,
            avgResponseTimeFormatted: activeAgentPerf.avgResponseTimeFormatted,
            rating: activeAgentPerf.rating,
          }
        : {
            chatsHandledToday: shift?.chatsResolved || 0,
            resolvedToday: shift?.chatsResolved || 0,
            activeChatsCount: 0,
            avgResponseTimeSeconds: 45,
            avgResponseTimeFormatted: '45 сек',
            rating: 4.9,
          };

      res.json({
        success: true,
        data: {
          agent: updatedAgent,
          shift,
          bitrixLive: bitrixLiveStatus,
          personalPerformance,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/worktime/current
   * Одоо сонгогдсон операторын дэлгэрэнгүй ээлжийн мэдээлэл.
   */
  app.get('/api/worktime/current', async (req, res) => {
    try {
      let agent = worktimeManager.getCurrentAgent();
      if (agent.bitrixUserId) {
        try {
          const bResp = await vibeRequest('GET', `/v1/workday/status?userId=${agent.bitrixUserId}`);
          if (bResp.success && bResp.data) {
            const synced = worktimeManager.syncAgentWorkdayFromBitrix(agent.id, bResp.data);
            agent = synced.agent;
          }
        } catch {}
      }
      const shift = worktimeManager.getCurrentShift(agent.id);
      res.json({ success: true, data: { agent, shift } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/worktime/team
   * Нийт операторын баг, тэдгээрийн онлайн төлөв, идэвхтэй ээлжүүд.
   */
  app.get('/api/worktime/team', (req, res) => {
    try {
      const team = worktimeManager.getAllAgents();
      const requestedAgentId = (req.query.agentId as string) || undefined;
      const currentAgent = requestedAgentId
        ? worktimeManager.getAgentById(requestedAgentId) || worktimeManager.getCurrentAgent()
        : worktimeManager.getCurrentAgent();
      const activeShifts = team.map((a) => worktimeManager.getCurrentShift(a.id));
      res.json({ success: true, data: { team, currentAgentId: currentAgent.id, activeShifts } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/switch-agent
   * Операторын нэвтрэх хэрэглэгчийг солих (эсвэл Bitrix24 хэрэглэгчийн ID-аар таних).
   */
  app.post('/api/worktime/switch-agent', async (req, res) => {
    try {
      let { agentId, bitrixUserId, chatId } = req.body;
      console.log('[API /api/worktime/switch-agent] Request payload:', { agentId, bitrixUserId, chatId });

      if (!agentId && !bitrixUserId && !chatId) {
        return res.status(400).json({ success: false, error: { message: 'agentId or bitrixUserId required' } });
      }

      // Check if agentId is in fact a chat ID (e.g. 'chat-8049', 'chat8049', or matches an existing dialog)
      const targetChatKey = chatId || (typeof agentId === 'string' && (agentId.startsWith('chat') || chatManager.getDialogById(agentId)) ? agentId : null);
      let matchedDialog = null;
      if (targetChatKey) {
        matchedDialog = chatManager.getDialogById(targetChatKey);
        if (matchedDialog) {
          console.log(`[SwitchAgent:StateSync] Recognized chat ID: ${matchedDialog.id} (Bitrix: ${matchedDialog.dialogId})`);
          if (matchedDialog.assignedAgentId && matchedDialog.assignedAgentId !== 'unassigned') {
            agentId = matchedDialog.assignedAgentId;
            console.log(`[SwitchAgent:StateSync] Resolved operator from chat assignment: ${agentId} (${matchedDialog.assignedAgentName || ''})`);
          } else {
            const current = worktimeManager.getCurrentAgent();
            agentId = current.id;
            console.log(`[SwitchAgent:StateSync] Chat has no assigned operator. Fallback to active operator: ${agentId}`);
          }
        }
      }

      let agent = worktimeManager.setCurrentAgent(agentId || `bx-${bitrixUserId}`, bitrixUserId ? Number(bitrixUserId) : undefined);
      
      // Сонгогдсон операторын Bitrix24 timeman төлөвийг синхрончлох
      if (agent.bitrixUserId) {
        try {
          const bResp = await vibeRequest('GET', `/v1/workday/status?userId=${agent.bitrixUserId}`);
          if (bResp.success && bResp.data) {
            const synced = worktimeManager.syncAgentWorkdayFromBitrix(agent.id, bResp.data);
            agent = synced.agent;
          }
        } catch (err: any) {
          console.warn(`[WorkdaySync] Error checking switch status:`, err?.message || err);
        }
      }

      const shift = worktimeManager.getCurrentShift(agent.id);
      const perf = inquiryAnalyticsService.getAgentPerformanceStats(undefined, 'today').find(
        (s) => s.agentId === agent.id || s.name.trim().toLowerCase() === agent.name.trim().toLowerCase()
      );
      const personalPerformance = perf
        ? {
            chatsHandledToday: perf.totalChatsHandled,
            resolvedToday: perf.resolvedChatsCount,
            activeChatsCount: perf.activeChatsCount,
            avgResponseTimeSeconds: perf.avgResponseTimeSeconds,
            avgResponseTimeFormatted: perf.avgResponseTimeFormatted,
            rating: perf.rating,
          }
        : null;

      console.log(`[SwitchAgent:StateSync] State synchronization complete:`, {
        switchedAgentId: agent.id,
        switchedAgentName: agent.name,
        targetChatId: matchedDialog?.id || targetChatKey,
        targetChatAssignedAgentId: matchedDialog?.assignedAgentId,
        targetChatAssignedAgentName: matchedDialog?.assignedAgentName,
      });

      res.json({
        success: true,
        data: {
          agent,
          shift,
          personalPerformance,
          targetChat: matchedDialog
            ? {
                id: matchedDialog.id,
                dialogId: matchedDialog.dialogId,
                assignedAgentId: matchedDialog.assignedAgentId,
                assignedAgentName: matchedDialog.assignedAgentName,
              }
            : null,
        },
      });
    } catch (e: any) {
      console.error('[SwitchAgent] Error during switch:', e.message);
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PATCH /api/worktime/agents/:id/permissions
   * Операторын эрхийн тохиргоо (admin / supervisor / agent) болон хариуцах сувгуудыг шинэчлэх.
   */
  app.patch('/api/worktime/agents/:id/permissions', (req, res) => {
    try {
      const { id } = req.params;
      const { accessRole, assignedChannelIds, assignedChannelNames, canAccessAllChannels } = req.body;
      const updated = worktimeManager.updateAgentPermissions(id, {
        accessRole,
        assignedChannelIds,
        assignedChannelNames,
        canAccessAllChannels,
      });
      res.json({
        success: true,
        data: updated,
        message: `${updated.name} операторын эрх, сувгийн тохиргоо амжилттай хадгалагдлаа.`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/clock-in
   * Ээлж эхлүүлэх (Clock-In). Bitrix24 timeman.open дуудаж, ажлын өдрийг албан ёсоор эхлүүлнэ.
   */
  app.post('/api/worktime/clock-in', async (req, res) => {
    try {
      const { agentId } = req.body;
      const targetAgent = agentId ? worktimeManager.getAgentById(agentId) : worktimeManager.getCurrentAgent();
      if (!targetAgent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      let bitrixResult: any = null;
      let bitrixError: any = null;

      // 1. Bitrix24 portal дээр timeman.open дуудах
      if (targetAgent.bitrixUserId) {
        try {
          console.log(`[WorkdaySync] Opening workday in Bitrix24 for user ${targetAgent.bitrixUserId} (${targetAgent.name})...`);
          const bxRes = await vibeRequest('POST', '/v1/workday/open', { userId: targetAgent.bitrixUserId });
          if (bxRes.success && bxRes.data && bxRes.data.status === 'OPENED') {
            bitrixResult = bxRes.data;
          } else {
            bitrixError = bxRes.error;
            // Handle WORKDAY_EXPIRED: If user had an expired shift from yesterday/earlier, close it first and open fresh
            if (bxRes.error?.code === 'WORKDAY_EXPIRED' || bxRes.error?.message?.toLowerCase().includes('expired')) {
              console.log(`[WorkdaySync] Workday was EXPIRED for user ${targetAgent.bitrixUserId}. Automatically closing expired shift to open new one...`);
              try {
                const statusCheck = await vibeRequest('GET', `/v1/workday/status?userId=${targetAgent.bitrixUserId}`);
                const expiredData = statusCheck.data;
                await vibeRequest('POST', '/v1/workday/close', {
                  userId: targetAgent.bitrixUserId,
                  report: 'Өмнөх хугацаа дууссан ээлжийг хааж шинэ өдөр нээв',
                  time: expiredData?.timeFinishDefault || expiredData?.timeStart || new Date().toISOString(),
                });
                // Re-open fresh workday in Bitrix24
                const retryOpen = await vibeRequest('POST', '/v1/workday/open', { userId: targetAgent.bitrixUserId });
                if (retryOpen.success && retryOpen.data && retryOpen.data.status === 'OPENED') {
                  bitrixResult = retryOpen.data;
                  bitrixError = null;
                  console.log(`[WorkdaySync] Successfully opened new Bitrix24 workday for user ${targetAgent.bitrixUserId}`);
                }
              } catch (autoCloseErr: any) {
                console.warn(`[WorkdaySync] Could not auto-close expired shift in Bitrix24:`, autoCloseErr.message);
              }
            }

            if (!bitrixResult) {
              // Хэрэв аль хэдийн нээгдсэн (OPENED) бол төлөвийг шалгах
              const check = await vibeRequest('GET', `/v1/workday/status?userId=${targetAgent.bitrixUserId}`);
              if (check.success && check.data && check.data.status === 'OPENED') {
                bitrixResult = check.data;
              }
            }
          }
        } catch (err: any) {
          console.error('[WorkdaySync] /v1/workday/open error:', err?.message || err);
        }
      }

      // 2. Системийн дотоод төлөвийг Bitrix24 эсвэл дотоод clockIn-ээр баталгаатай эхлүүлэх
      let outcome;
      if (bitrixResult && bitrixResult.status === 'OPENED') {
        outcome = worktimeManager.syncAgentWorkdayFromBitrix(targetAgent.id, bitrixResult);
      } else {
        // Баталгаатай Clock-In: Bitrix алдаатай эсвэл EXPIRED байсан ч операторын ээлжийг найдвартай эхлүүлнэ
        outcome = worktimeManager.clockIn(targetAgent.id);
      }

      res.json({
        success: true,
        data: outcome,
        bitrixResult,
        bitrixError,
        message: bitrixResult?.status === 'OPENED'
          ? `Bitrix24 портал дээр ${targetAgent.name} ажилтны өдөр амжилттай нээгдлээ.`
          : 'Ажлын ээлж амжилттай эхэллээ.',
      });
    } catch (e: any) {
      console.error('[ClockIn] Error:', e.message);
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/clock-out
   * Ээлж дуусгах (Clock-Out). Bitrix24 timeman.close дуудаж, тайлангийн хамт өдрийг хаана.
   */
  app.post('/api/worktime/clock-out', async (req, res) => {
    try {
      const { dailyReport, agentId } = req.body;
      const targetAgent = agentId ? worktimeManager.getAgentById(agentId) : worktimeManager.getCurrentAgent();
      if (!targetAgent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      let bitrixResult: any = null;
      let bitrixError: any = null;

      // 1. Bitrix24 portal дээр timeman.close дуудах
      if (targetAgent.bitrixUserId) {
        try {
          const reportText = dailyReport || 'Өдрийн ээлж дууссан';
          const bxRes = await vibeRequest('POST', '/v1/workday/close', {
            userId: targetAgent.bitrixUserId,
            report: reportText,
          });
          if (bxRes.success && bxRes.data) {
            bitrixResult = bxRes.data;
          } else {
            bitrixError = bxRes.error;
            const check = await vibeRequest('GET', `/v1/workday/status?userId=${targetAgent.bitrixUserId}`);
            if (check.success && check.data) {
              bitrixResult = check.data;
            }
          }
        } catch (err: any) {
          console.error('[WorkdaySync] /v1/workday/close error:', err?.message || err);
          try {
            const check = await vibeRequest('GET', `/v1/workday/status?userId=${targetAgent.bitrixUserId}`);
            if (check.success && check.data) {
              bitrixResult = check.data;
            }
          } catch {}
        }
      }

      // 2. Системийн дотоод ээлжийг хааж, тайланг хадгалах
      let outcome;
      if (bitrixResult) {
        outcome = worktimeManager.syncAgentWorkdayFromBitrix(targetAgent.id, bitrixResult);
        if (outcome.shift && dailyReport) {
          outcome.shift.dailyReport = dailyReport;
        }
      } else {
        outcome = worktimeManager.clockOut(dailyReport, targetAgent.id);
      }

      res.json({
        success: true,
        data: outcome,
        bitrixResult,
        bitrixError,
        message: bitrixResult
          ? `Bitrix24 портал дээр ${targetAgent.name} ажилтны өдөр амжилттай хаагдлаа.`
          : 'Ажлын ээлж амжилттай хаагдлаа.',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/break
   * Ажлын завсарлага эхлүүлэх (Break start). Bitrix24 дээр timeman.pause дуудна.
   */
  app.post(['/api/worktime/break', '/api/worktime/break/start'], async (req, res) => {
    try {
      const { agentId } = req.body;
      const targetAgent = agentId ? worktimeManager.getAgentById(agentId) : worktimeManager.getCurrentAgent();
      if (!targetAgent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      let bitrixResult: any = null;
      if (targetAgent.bitrixUserId) {
        try {
          const bxRes = await vibeRequest('POST', '/v1/workday/pause', { userId: targetAgent.bitrixUserId });
          if (bxRes.success && bxRes.data) {
            bitrixResult = bxRes.data;
          }
        } catch (err: any) {
          console.warn('[WorkdaySync] /v1/workday/pause error:', err?.message || err);
        }
      }

      let outcome;
      if (bitrixResult) {
        outcome = worktimeManager.syncAgentWorkdayFromBitrix(targetAgent.id, bitrixResult);
      } else {
        outcome = worktimeManager.startBreak(targetAgent.id);
      }

      res.json({ success: true, data: outcome, bitrixResult });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/resume
   * Завсарлага дуусгаж ажилдаа эргэн орох (Resume work). Bitrix24 дээр timeman.open дуудна.
   */
  app.post(['/api/worktime/resume', '/api/worktime/break/resume'], async (req, res) => {
    try {
      const { agentId } = req.body;
      const targetAgent = agentId ? worktimeManager.getAgentById(agentId) : worktimeManager.getCurrentAgent();
      if (!targetAgent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      let bitrixResult: any = null;
      if (targetAgent.bitrixUserId) {
        try {
          const bxRes = await vibeRequest('POST', '/v1/workday/open', { userId: targetAgent.bitrixUserId });
          if (bxRes.success && bxRes.data) {
            bitrixResult = bxRes.data;
          }
        } catch (err: any) {
          console.warn('[WorkdaySync] /v1/workday/open (resume) error:', err?.message || err);
        }
      }

      let outcome;
      if (bitrixResult) {
        outcome = worktimeManager.syncAgentWorkdayFromBitrix(targetAgent.id, bitrixResult);
      } else {
        outcome = worktimeManager.resumeWork(targetAgent.id);
      }

      res.json({ success: true, data: outcome, bitrixResult });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * PATCH /api/worktime/status
   * Операторын онлайн төлөвийг гар аргаар өөрчлөх ('online' | 'busy' | 'break' | 'offline').
   */
  app.patch('/api/worktime/status', (req, res) => {
    try {
      const { status, agentId } = req.body;
      if (!status) return res.status(400).json({ success: false, error: { message: 'status required' } });
      const agent = worktimeManager.setAgentStatus(status, agentId);
      res.json({ success: true, data: agent });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * GET /api/worktime/history
   * Өмнөх өдрүүдийн ээлжийн түүх, ажилласан цаг, шийдсэн чатын тоог жагсаана.
   */
  app.get('/api/worktime/history', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const shifts = worktimeManager.getShiftsHistory(limit);
      res.json({ success: true, data: shifts });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  // ==========================================================================
  // 8.5 System Build & VibeCode Cloud Infrastructure Redeploy
  // ==========================================================================
  const deployState: {
    status: 'idle' | 'building' | 'success' | 'failed';
    lastDeployedAt: string | null;
    logs: string[];
    durationMs?: number;
    error?: string;
    targetServer?: {
      id: string;
      name: string;
      displayName?: string;
      appUrl?: string;
      subdomain?: string;
      status: string;
    } | null;
  } = {
    status: 'idle',
    lastDeployedAt: new Date().toISOString(),
    logs: ['[Систем] VibeCode Үүлэн Дэд Бүтэц (Bitrix24 Cloud) холбогдсон.'],
    targetServer: {
      id: '48204c21-ddf0-4bfa-baa6-188da8e439c3',
      name: 'openlines-ai-bot',
      displayName: 'BSB Open Lines AI Bot & Workplace',
      appUrl: 'https://app-089481b3c344.vibecode.bitrix24.com',
      subdomain: 'app-089481b3c344',
      status: 'running',
    },
  };

  /**
   * GET /api/system/deploy-status
   * Бэлэн байдал, сүүлийн deploy хийсэн хугацаа болон терминалын логуудыг харах
   */
  app.get('/api/system/deploy-status', (req, res) => {
    res.json({ success: true, data: deployState });
  });

  /**
   * POST /api/system/redeploy
   * Кодонд өөрчлөлт орсон үед:
   * 1. npm run build хийж Frontend болон Backend-ийг шинэчлэн бүтээх
   * 2. tar.gz архив бэлтгэж VibeCode Үүлэн Дэд Бүтцийн сервер рүү (Galaxy container) шууд илгээн deploy хийх!
   */
  app.post('/api/system/redeploy', async (req, res) => {
    if (deployState.status === 'building') {
      return res.status(409).json({
        success: false,
        error: { message: 'Одоогоор VibeCode Үүлэн Дэд Бүтэц рүү байршуулалт хийгдэж байна. Түр хүлээнэ үү.' },
      });
    }

    const { targetServerId } = req.body || {};
    deployState.status = 'building';
    deployState.error = undefined;
    deployState.logs = [];
    const startTime = Date.now();

    const addLog = (msg: string) => {
      const line = `[${new Date().toLocaleTimeString('mn-MN')}] ${msg}`;
      deployState.logs.push(line);
      if (deployState.logs.length > 150) deployState.logs.shift();
      console.log(`[VibeCode Deploy] ${line}`);
    };

    addLog('🚀 VibeCode Үүлэн Дэд Бүтэц (Bitrix24 Cloud) рүү дахин Deploy хийж эхэллээ...');
    addLog('📦 Алхам 1/3: Frontend (Vite) & Backend (esbuild bundle) шинэчлэн барьж байна...');

    // Respond immediately so client UI tracks live progress
    res.json({
      success: true,
      message: 'VibeCode Үүлэн Дэд Бүтэц рүү дахин Deploy хийх процесс эхэллээ.',
      data: { status: 'building' },
    });

    (async () => {
      try {
        const { exec } = await import('child_process');
        const fs = await import('fs');

        // Step 1: Run npm run build
        await new Promise<void>((resolve, reject) => {
          exec('npm run build', { cwd: process.cwd(), timeout: 120000 }, (err, stdout, stderr) => {
            if (stdout) {
              const cleanLines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
              cleanLines.slice(-6).forEach((l) => addLog(`[Build] ${l}`));
            }
            if (err) {
              reject(new Error(`Build failed: ${err.message}`));
            } else {
              resolve();
            }
          });
        });

        addLog('📦 Алхам 2/3: Deploy багцыг архивлан (tar.gz) бэлтгэж байна...');
        const archivePath = `/tmp/vibecode_deploy_${Date.now()}.tar.gz`;
        await new Promise<void>((resolve, reject) => {
          exec(`tar -czf ${archivePath} dist package.json`, { cwd: process.cwd() }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        const fileBuffer = fs.readFileSync(archivePath);
        const archiveBase64 = fileBuffer.toString('base64');
        addLog(`✅ Архив бэлэн боллоо (${(fileBuffer.length / 1024).toFixed(1)} KB).`);

        // Find target server on VibeCode
        let serverId = targetServerId;
        if (!serverId) {
          try {
            const listResp = await vibeRequest('GET', '/v1/infra/servers');
            const servers = Array.isArray(listResp.data) ? listResp.data : [];
            const activeServer = servers.find((s: any) => s.kind === 'GALAXY_APP' || s.id === '48204c21-ddf0-4bfa-baa6-188da8e439c3') || servers[0];
            if (activeServer) {
              serverId = activeServer.id;
              deployState.targetServer = {
                id: activeServer.id,
                name: activeServer.name,
                displayName: activeServer.displayName,
                appUrl: activeServer.appUrl,
                subdomain: activeServer.subdomain,
                status: activeServer.status,
              };
            }
          } catch (e: any) {
            console.warn('Failed to query servers, using default:', e.message);
          }
        }

        if (!serverId) {
          serverId = '48204c21-ddf0-4bfa-baa6-188da8e439c3';
        }

        addLog(`🌐 Алхам 3/3: VibeCode Үүлэн Сервер (${serverId}) рүү илгээж контейнерийг дахин асааж байна...`);

        const deployPayload = {
          runtime: 'node20',
          source: {
            type: 'archive',
            content: archiveBase64,
          },
          start: 'node dist/server.cjs',
          env: {
            NODE_ENV: 'production',
            PORT: '3000',
            ...(process.env.VIBE_API_KEY ? { VIBE_API_KEY: process.env.VIBE_API_KEY } : {}),
            ...(process.env.GEMINI_API_KEY ? { GEMINI_API_KEY: process.env.GEMINI_API_KEY } : {}),
          },
        };

        const deployResp = await vibeRequest('POST', `/v1/infra/servers/${serverId}/deploy`, deployPayload);

        try {
          fs.unlinkSync(archivePath);
        } catch {
          // ignore cleanup error
        }

        const totalDuration = Date.now() - startTime;
        deployState.durationMs = totalDuration;

        if (deployResp.success || deployResp.data?.status === 'running') {
          deployState.status = 'success';
          deployState.lastDeployedAt = new Date().toISOString();
          if (deployResp.data?.appUrl) {
            deployState.targetServer = {
              ...(deployState.targetServer || { id: serverId, name: 'openlines-ai-bot', status: 'running' }),
              appUrl: deployResp.data.appUrl,
              status: deployResp.data.status || 'running',
            };
          }
          addLog(`🎉 VibeCode Үүлэн Дэд Бүтэц рүү амжилттай байршлаа! (${(totalDuration / 1000).toFixed(1)} сек)`);
          if (deployResp.data?.appUrl) {
            addLog(`🔗 Cloud App URL: ${deployResp.data.appUrl}`);
          }
        } else {
          deployState.status = 'failed';
          deployState.error = deployResp.error?.message || 'Deploy failed on VibeCode platform';
          addLog(`❌ VibeCode байршуулалт алдаа гарлаа: ${deployState.error}`);
          if ((deployResp as any).buildLog) {
            addLog(`[BuildLog] ${(deployResp as any).buildLog.slice(0, 300)}`);
          }
        }
      } catch (err: any) {
        const totalDuration = Date.now() - startTime;
        deployState.durationMs = totalDuration;
        deployState.status = 'failed';
        deployState.error = err.message;
        addLog(`❌ Алдаа: ${err.message}`);
      }
    })();
  });

  // ==========================================================================
  // 9. Vite Dev Middleware & Production Static SPA Serving
  // ==========================================================================
  // API хандалтууд Vite эсвэл SPA fallback руу унаж HTML буцаахаас сэргийлж 404 JSON буцаана
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: { message: `API endpoint not found: ${req.method} ${req.originalUrl}` },
    });
  });

  // Development орчинд Vite HMR болон шууд TSX хөрвүүлэлтийг Express дээр ачааллана.
  // Production горимд dist/ хавтаснаас урьдчилан build хийгдсэн index.html болон assets-ийг өгнө.
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ==========================================================================
  // 10. HTTP & WebSocket Server Setup (Real-Time Messaging & Typing Indicator)
  // ==========================================================================
  const server = http.createServer(app);

  // WebSocket Server on /ws path
  const wss = new WebSocketServer({ server, path: '/ws' });

  broadcastWs = (data: any, excludeWs?: WebSocket) => {
    try {
      const payload = JSON.stringify(data);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
          try {
            client.send(payload);
          } catch {
            // ignore
          }
        }
      }
    } catch {}
  };

  wss.on('connection', (ws) => {
    // Send active typers on connect
    try {
      ws.send(
        JSON.stringify({
          type: 'connected',
          allTypers: typingManager.getAllActiveTypers(),
          timestamp: Date.now(),
        })
      );
    } catch {}

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (msg.type === 'typing') {
          const { dialogId, isTyping, agentId, name, role, avatar } = msg;
          if (dialogId) {
            const typers = typingManager.setTyping(
              dialogId,
              {
                agentId: agentId || name || 'user',
                name: name || 'Оператор',
                role: role || 'agent',
                avatar,
              },
              Boolean(isTyping)
            );

            const typingEvent = { type: 'typing:update', dialogId, typers };
            broadcastWs(typingEvent);
            chatManager.emit('change', typingEvent);
          }
        }
      } catch (e) {
        console.warn('[WebSocket] Error processing message:', e);
      }
    });

    ws.on('error', () => {});
  });

  // Forward chatManager's events (new messages, dialog updates) to all connected WebSocket clients
  chatManager.on('change', (eventData: any) => {
    broadcastWs(eventData);
  });

  // ==========================================================================
  // 11. Server Listener & Startup Background Services
  // ==========================================================================
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Bot Server & WebSocket running on http://localhost:${PORT}`);

    // Алхам 1: Bitrix24 порталаас бүх нээлттэй суваг ба хуваарилагдсан операторуудыг татах
    bitrixAgentsService
      .syncAgents(false)
      .then((res) => {
        worktimeManager.syncWithBitrixAgents(res.uniqueAgents);
        console.log(
          `[Bitrix Sync] Ready: ${res.lines.length} channels, ${res.totalOperatorLinks} operator links, ${res.totalUniqueAgents} unique agents.`
        );
      })
      .catch((err) => {
        console.warn('[Bitrix Sync] Initial background sync error:', err.message);
      });

    // Алхам 2: Хэрэв бот тохируулагдсан ба полинг идэвхтэй байсан бол автоматаар асаах
    const cfg = botWorker.getConfig();
    if (cfg.botId && cfg.isPollingActive) {
      botWorker.startPolling().catch((err) => {
        console.warn('[BotWorker] Startup polling error:', err.message);
      });
    } else {
      botWorker.stopPolling();
    }

    // Алхам 3: Bitrix24 Open Lines-ийн бодит сесс, чатуудыг түргэн хугацаанд татах auto-sync-г асаах (1.8 секунд)
    bitrixOpenlinesSync.startAutoSync(1800);
  });
}

startServer();
