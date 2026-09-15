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
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { vibeRequest } from './server/vibeApi';
import { knowledgeBase } from './server/knowledgeBase';
import { botWorker } from './server/botWorker';
import { chatManager } from './server/chatManager';
import { worktimeManager } from './server/worktimeManager';
import { bitrixAgentsService } from './server/bitrixAgentsService';
import { bitrixOpenlinesSync } from './server/bitrixOpenlinesSync';
import { inquiryAnalyticsService } from './server/inquiryAnalyticsService';

// .env файлын тохиргоог ачааллах
dotenv.config();

// Стандарт контейнер болон Nginx-ийн эхлэх порт
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

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
  // 5. Logs & Live Testing Simulator API
  // ==========================================================================
  /**
   * GET /api/logs
   * Ботын хамгийн сүүлийн харилцан ярианы лог (handoff шалтгаан, үргэлжилсэн хугацаа гэх мэт).
   */
  app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ success: true, data: botWorker.getLogs(limit) });
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
      res.json({ success: true, data: outcome });
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
      const { channels } = req.body || {};
      const channelIds = Array.isArray(channels) ? channels : undefined;
      const report = await inquiryAnalyticsService.generateReport(channelIds);
      res.json({
        success: true,
        data: report,
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
      const dialogs = chatManager.getAllDialogs();
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
   * GET /api/chats
   * Шүүлтүүр (status, channelId, channelType, search, isStarred)-тэйгээр бүх чатыг авах.
   */
  app.get('/api/chats', (req, res) => {
    try {
      const { status, channelId, channelType, assignedAgentId, search, isStarred, sortBy } = req.query;
      const dialogs = chatManager.getAllDialogs({
        status: status as string,
        channelId: channelId as string,
        channelType: channelType as string,
        assignedAgentId: assignedAgentId as string,
        search: search as string,
        isStarred: isStarred !== undefined ? isStarred === 'true' : undefined,
        sortBy: sortBy as any,
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
   * POST /api/chats/:id/messages
   * Чатад оператор хариу бичих, эсвэл дотоод санамж (whisper note) үлдээх.
   * Хэрэв бодит Bitrix чат бол мессежийг шууд Bitrix24 REST API-аар илгээнэ.
   */
  app.post('/api/chats/:id/messages', async (req, res) => {
    try {
      const { id } = req.params;
      const { text, sender, senderName, senderAvatar, isInternalNote } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: { message: 'Message text is required' } });
      }

      const outcome = chatManager.sendMessage(id, {
        text: text.trim(),
        sender: sender || 'agent',
        senderName,
        senderAvatar,
        isInternalNote: Boolean(isInternalNote),
      });

      // Хэрэв оператор бодит харилцагчид бичиж байгаа бол Bitrix24 чат руу илгээнэ
      if (sender === 'agent' && !isInternalNote) {
        const dialogId = outcome.dialog.dialogId;
        // Жишээ: "chat75344" хэлбэрийн ID байвал бодит Bitrix чат мөн
        if (dialogId && dialogId.startsWith('chat') && !dialogId.startsWith('chat-')) {
          try {
            await bitrixOpenlinesSync.sendMessageToBitrixChat(dialogId, text.trim());
            const numericChatId = parseInt(dialogId.replace('chat', ''), 10);
            if (!isNaN(numericChatId)) {
              await bitrixOpenlinesSync.answerOperatorChat(numericChatId);
            }
          } catch (sendErr: any) {
            console.warn('[Server] Could not send message to Bitrix Chat:', sendErr.message);
          }
        }
      }

      res.json({ success: true, data: outcome });
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
   */
  app.patch('/api/chats/:id', async (req, res) => {
    try {
      const updated = chatManager.updateDialog(req.params.id, req.body);
      if (req.body.status === 'in_progress' && updated.dialogId?.startsWith('chat')) {
        const numId = parseInt(updated.dialogId.replace('chat', ''), 10);
        if (!isNaN(numId)) {
          await bitrixOpenlinesSync.answerOperatorChat(numId);
        }
      }
      res.json({ success: true, data: updated });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/transfer
   * Чатыг өөр мэргэшсэн оператор руу шилжүүлэх (Re-assign).
   */
  app.post('/api/chats/:id/transfer', (req, res) => {
    try {
      const { targetAgentId, targetAgentName, targetAgentAvatar } = req.body;
      if (!targetAgentId || !targetAgentName) {
        return res.status(400).json({ success: false, error: { message: 'Target agent details required' } });
      }
      const dialog = chatManager.transferDialog(req.params.id, targetAgentId, targetAgentName, targetAgentAvatar);
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/close
   * Асуудлыг шийдвэрлэж чатыг хаах, шалтгааны хураангуйг тэмдэглэх.
   */
  app.post('/api/chats/:id/close', async (req, res) => {
    try {
      const { resolutionSummary } = req.body;
      const dialog = chatManager.closeDialog(req.params.id, resolutionSummary);
      worktimeManager.incrementResolvedChat();
      if (dialog.dialogId?.startsWith('chat')) {
        const numId = parseInt(dialog.dialogId.replace('chat', ''), 10);
        if (!isNaN(numId)) {
          await bitrixOpenlinesSync.finishOperatorChat(numId);
        }
      }
      res.json({ success: true, data: dialog });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/chats/:id/reopen
   * Хаагдсан чатыг дахин сэргээж нээх.
   */
  app.post('/api/chats/:id/reopen', (req, res) => {
    try {
      const dialog = chatManager.reopenDialog(req.params.id);
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
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: { message: 'Query is required for AI suggestion' } });
      }
      const suggestion = await botWorker.suggestDraftResponse(query);
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
   */
  app.get('/api/worktime/status', (req, res) => {
    try {
      const currentAgent = worktimeManager.getCurrentAgent();
      const currentShift = worktimeManager.getCurrentShift(currentAgent.id);
      const team = worktimeManager.getAllAgents();
      res.json({
        success: true,
        data: {
          currentAgent,
          currentShift,
          team,
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
  app.get('/api/worktime/current', (req, res) => {
    try {
      const agent = worktimeManager.getCurrentAgent();
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
      const currentAgent = worktimeManager.getCurrentAgent();
      const activeShifts = team.map((a) => worktimeManager.getCurrentShift(a.id));
      res.json({ success: true, data: { team, currentAgentId: currentAgent.id, activeShifts } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/switch-agent
   * Операторын нэвтрэх хэрэглэгчийг солих.
   */
  app.post('/api/worktime/switch-agent', (req, res) => {
    try {
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ success: false, error: { message: 'agentId required' } });
      const agent = worktimeManager.setCurrentAgent(agentId);
      const shift = worktimeManager.getCurrentShift(agent.id);
      res.json({ success: true, data: { agent, shift } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/clock-in
   * Ээлж эхлүүлэх (Clock-In). Тухайн өдрийн ажлын эхлэх цаг болон шинэ ээлжийн ID үүснэ.
   */
  app.post('/api/worktime/clock-in', (req, res) => {
    try {
      const { agentId } = req.body;
      const outcome = worktimeManager.clockIn(agentId);
      res.json({ success: true, data: outcome });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/clock-out
   * Ээлж дуусгах (Clock-Out). Нийт ажилласан секунд, завсарлага болон өдрийн товч тайланг хадгална.
   */
  app.post('/api/worktime/clock-out', (req, res) => {
    try {
      const { dailyReport, agentId } = req.body;
      const outcome = worktimeManager.clockOut(dailyReport, agentId);
      res.json({ success: true, data: outcome });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/break
   * Ажлын завсарлага эхлүүлэх (Break start). Операторын статус 'break' болж завсарлагын хугацаа тоологдоно.
   */
  app.post(['/api/worktime/break', '/api/worktime/break/start'], (req, res) => {
    try {
      const { agentId } = req.body;
      const outcome = worktimeManager.startBreak(agentId);
      res.json({ success: true, data: outcome });
    } catch (e: any) {
      res.status(500).json({ success: false, error: { message: e.message } });
    }
  });

  /**
   * POST /api/worktime/resume
   * Завсарлага дуусгаж ажилдаа эргэн орох (Resume work).
   */
  app.post(['/api/worktime/resume', '/api/worktime/break/resume'], (req, res) => {
    try {
      const { agentId } = req.body;
      const outcome = worktimeManager.resumeWork(agentId);
      res.json({ success: true, data: outcome });
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
  // 9. Vite Dev Middleware & Production Static SPA Serving
  // ==========================================================================
  // Development орчинд Vite HMR болон шууд TSX хөрвүүлэлтийг Express дээр ачааллана.
  // Production горимд dist/ хавтаснаас урьдчилан build хийгдсэн index.html болон assets-ийг өгнө.
  if (process.env.NODE_ENV !== 'production') {
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
  // 10. Server Listener & Startup Background Services
  // ==========================================================================
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Bot Server running on http://localhost:${PORT}`);

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
    if (cfg.botId && cfg.selectedLineId && cfg.isPollingActive) {
      botWorker.startPolling().catch((err) => {
        console.warn('[BotWorker] Startup polling error:', err.message);
      });
    } else {
      botWorker.stopPolling();
    }

    // Алхам 3: Bitrix24 Open Lines-ийн бодит сесс, чатуудыг 5 секунд тутамд татах auto-sync-г асаах
    bitrixOpenlinesSync.startAutoSync(5000);
  });
}

startServer();
