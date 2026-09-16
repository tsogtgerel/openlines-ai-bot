import { vibeRequest, getVibeRateLimitInfo } from './vibeApi';
import { chatManager, ChatDialog, ChatMessage, CustomerProfile } from './chatManager';
import { botWorker } from './botWorker';

function cleanBBCode(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[USER=\d+ REPLACE\](.*?)\[\/USER\]/g, '$1')
    .replace(/\[URL.*?\](.*?)\[\/URL\]/g, '$1')
    .replace(/\[b\](.*?)\[\/b\]/gi, '$1')
    .replace(/\[B\](.*?)\[\/B\]/g, '$1')
    .trim();
}

function resolveChannelType(source: string, channelName: string): ChatDialog['channelType'] {
  const s = (source || '').toLowerCase();
  const n = (channelName || '').toLowerCase();

  if (s.includes('facebook') || n.includes('facebook')) return 'facebook';
  if (s.includes('instagram') || n.includes('instagram')) return 'instagram';
  if (s.includes('telegram') || n.includes('telegram')) return 'telegram';
  if (s.includes('whatsapp') || n.includes('whatsapp')) return 'whatsapp';
  return 'webchat';
}

export class BitrixOpenlinesSyncService {
  private lineMap: Map<number, string> = new Map();
  private lastSyncTime: string | null = null;
  private isSyncing = false;
  private timer: NodeJS.Timeout | null = null;
  private activeChatTimer: NodeJS.Timeout | null = null;
  private isSingleSyncing = false;

  // Track session message counts & statuses to avoid wasteful calls to unchanged chats
  private knownSessionCounts: Map<number, number> = new Map();
  private knownSessionStatuses: Map<number, string> = new Map();
  private activeChatId: number | null = null;

  async loadLineConfigs(): Promise<void> {
    try {
      const resp = await vibeRequest<any[]>('GET', '/v1/openline-configs?limit=100');
      if (resp.success && Array.isArray(resp.data)) {
        for (const line of resp.data) {
          this.lineMap.set(Number(line.id), line.name);
        }
      }
    } catch (e: any) {
      console.warn('[OpenlinesSync] Failed to fetch line configs:', e.message);
    }
  }

  getLineName(configId: number): string {
    return this.lineMap.get(configId) || `Нээлттэй суваг #${configId}`;
  }

  /**
   * Операторын дэлгэц дээр одоо нээлттэй буй чатын ID-г бүртгэж,
   * тухайн чатыг арын синк дээр тэргүүн ээлжинд шалгах.
   */
  setActiveChatId(chatId: number | string | null) {
    if (!chatId) {
      this.activeChatId = null;
      return;
    }
    const num = typeof chatId === 'string' ? parseInt(chatId.replace(/^chat-?/, ''), 10) : chatId;
    this.activeChatId = isNaN(num) ? null : num;

    // Trigger immediate background sync for newly activated chat to minimize latency
    if (this.activeChatId) {
      this.syncSingleChat(this.activeChatId).catch(() => {});
    }
  }

  /**
   * Нэг тодорхой чатын хамгийн сүүлийн мессежүүдийг Bitrix24-өөс шуурхай татах (1-2 секундэд)
   */
  async syncSingleChat(chatIdOrDialogId: number | string): Promise<ChatDialog | null> {
    const rawStr = String(chatIdOrDialogId);
    const numChatId = parseInt(rawStr.replace(/^chat-?/, ''), 10);
    const existing = chatManager.getDialogById(`chat-${numChatId}`) || chatManager.getDialogById(`chat${numChatId}`) || chatManager.getDialogById(rawStr);

    if (isNaN(numChatId)) {
      return existing || null;
    }

    try {
      // 1. Шуурхай GET /v1/chats/:dialogId/messages хандалт (хөнгөн, хурдан, rate-limit бага)
      let messagesRes = await vibeRequest<any>('GET', `/v1/chats/chat${numChatId}/messages`);

      // 2. Хэрэв амжилтгүй бол openlines/sessions/history ашиглан нөөц хувилбараар татах
      let rawData: any = null;
      if (messagesRes.success && messagesRes.data?.messages) {
        rawData = messagesRes.data;
      } else {
        const histRes = await vibeRequest<any>('POST', '/v1/openlines/sessions/history', { chatId: numChatId });
        if (histRes.success && histRes.data?.messages) {
          rawData = histRes.data;
        }
      }

      if (!rawData) {
        return existing || null;
      }

      const configId = existing?.channelId ? Number(existing.channelId) : 39;
      const channelName = this.getLineName(configId);

      // Parse existing lead id if available so syncSingleChat does not wipe it out
      let crmEntityId: number | undefined = undefined;
      let crmEntityType: string | undefined = undefined;
      if (existing?.customer?.crmLeadId) {
        const parts = existing.customer.crmLeadId.split('-');
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          crmEntityType = parts[0];
          crmEntityId = Number(parts[1]);
        }
      }

      const fakeSession = {
        chatId: numChatId,
        configId,
        source: existing?.channelType || 'webchat',
        status: existing?.status || 'in_progress',
        userId: 0,
        operatorId: existing?.assignedAgentId ? Number(existing.assignedAgentId) : 0,
        dateCreate: existing?.createdAt || new Date().toISOString(),
        messageCount: rawData.messages.length,
        crmEntityId,
        crmEntityType,
      };

      const updatedDialog = this.mapRawToChatDialog(fakeSession, rawData, channelName);
      if (updatedDialog) {
        chatManager.upsertBitrixDialog(updatedDialog);
        this.knownSessionCounts.set(numChatId, rawData.messages.length);
        return chatManager.getDialogById(`chat-${numChatId}`) || updatedDialog;
      }
    } catch (e: any) {
      console.warn(`[OpenlinesSync] syncSingleChat error for ${numChatId}:`, e.message);
    }

    return existing || null;
  }

  /**
   * Түүхий өгөгдлөөс ChatDialog объект үүсгэх туслах функц
   */
  private mapRawToChatDialog(s: any, rawData: any, channelName: string): ChatDialog | null {
    try {
      const channelType = resolveChannelType(s.source, channelName);
      const botCfg = botWorker.getConfig();

      const existingDialog =
        chatManager.getDialogById(`chat-${s.chatId}`) ||
        chatManager.getDialogById(`chat${s.chatId}`);
      const existingCustomer = existingDialog?.customer;

      const customerUser =
        rawData.users?.find((u: any) => u.connector || u.type === 'extranet' || u.id === s.userId) ||
        rawData.users?.[0];

      const operatorUser = rawData.users?.find(
        (u: any) => !u.connector && u.type === 'user' && u.id !== 19170 && u.id !== botCfg.botId
      );

      // Clean and normalize avatar URL (resolving relative paths and Bitrix CDN)
      let cleanAvatar: string | undefined = undefined;
      const rawAvatar = customerUser?.avatar;
      if (rawAvatar && rawAvatar !== '/bitrix/js/im/images/blank.gif' && !rawAvatar.includes('blank.gif')) {
        if (rawAvatar.startsWith('//')) {
          cleanAvatar = `https:${rawAvatar}`;
        } else if (rawAvatar.startsWith('/')) {
          cleanAvatar = `https://vibecode.bitrix24.com${rawAvatar}`;
        } else {
          cleanAvatar = rawAvatar;
        }
      }

      // Preserve existing avatar if new rawAvatar is missing
      const finalAvatar = cleanAvatar || existingCustomer?.avatar;

      // Stable CRM Lead ID resolution:
      // Priority 1: session s.crmEntityId (and s.crmEntityType if available)
      // Priority 2: session s.crm or s.leadId if present
      // Priority 3: existingCustomer.crmLeadId (DO NOT WIPE OUT!)
      let finalCrmLeadId: string | undefined = undefined;
      if (s.crmEntityId) {
        const entityPrefix = s.crmEntityType ? s.crmEntityType.toUpperCase() : 'LEAD';
        finalCrmLeadId = `${entityPrefix}-${s.crmEntityId}`;
      } else if (s.crm && typeof s.crm === 'string' && s.crm.includes('_')) {
        const parts = s.crm.split('_');
        finalCrmLeadId = `${parts[0].toUpperCase()}-${parts[1]}`;
      } else if (existingCustomer?.crmLeadId) {
        finalCrmLeadId = existingCustomer.crmLeadId;
      }

      const customer: CustomerProfile = {
        name: customerUser?.name || existingCustomer?.name || 'Зочин харилцагч',
        avatar: finalAvatar,
        crmLeadId: finalCrmLeadId,
        tags: [s.source ? s.source.toUpperCase() : 'OPENLINE', 'Битрикс24 Live'],
        phone: existingCustomer?.phone,
        email: existingCustomer?.email,
        address: existingCustomer?.address,
        city: existingCustomer?.city,
        totalOrders: existingCustomer?.totalOrders,
        lastOrderDate: existingCustomer?.lastOrderDate,
      };

      const rawMessages = rawData.messages || [];

      // Sort messages chronologically (oldest first, newest last)
      const sortedRaw = [...rawMessages].sort((a: any, b: any) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });

      const messages: ChatMessage[] = sortedRaw.map((m: any) => {
        let sender: ChatMessage['sender'] = 'system';
        let senderName = 'Систем';

        const senderId = m.authorId !== undefined ? m.authorId : m.senderId;
        const msgText = cleanBBCode(m.text || m.textLegacy || '');

        const isBotMessage =
          senderId === 19170 ||
          senderId === botCfg.botId ||
          (msgText && (msgText.includes('[BSB AI') || msgText.includes('🤖')));

        if (senderId === 0) {
          sender = 'system';
          senderName = 'Систем';
        } else if (isBotMessage) {
          sender = 'bot';
          senderName = botCfg.botName || 'BSB AI Туслах';
        } else if (customerUser && senderId === customerUser.id) {
          sender = 'customer';
          senderName = customerUser.name;
        } else if (operatorUser && senderId === operatorUser.id) {
          sender = 'agent';
          senderName = operatorUser.name;
        } else {
          sender = senderId > 0 ? 'agent' : 'system';
          senderName = operatorUser?.name || 'Оператор';
        }

        return {
          id: `bx-${m.id}`,
          sender,
          senderName,
          text: msgText,
          timestamp: m.date,
          status: 'delivered',
        };
      });

      const visibleMsgs = messages.filter((m) => m.text && m.sender !== 'system');
      const lastMsg = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : messages[messages.length - 1];

      const isThisLineBotBound =
        Boolean(botCfg.isPollingActive) &&
        Boolean(botCfg.selectedLineId) &&
        Number(botCfg.selectedLineId) === Number(s.configId);

      // Bitrix24 session operator assignment:
      // A chat has an assigned operator ONLY IF s.operatorId is valid (> 0 and !== 19170 and !== botCfg.botId)
      // If s.operatorId is null/undefined/0, or s.status === 'new', the conversation is in the queue/unassigned.
      // Prior chat participants in rawData.users do NOT mean the chat is currently assigned to them!
      const hasActiveOperator = Boolean(
        s.operatorId &&
        Number(s.operatorId) > 0 &&
        Number(s.operatorId) !== 19170 &&
        Number(s.operatorId) !== botCfg.botId
      );

      const assignedOperatorUser = hasActiveOperator
        ? (rawData.users?.find((u: any) => u.id === Number(s.operatorId)) || operatorUser)
        : null;

      let status: ChatDialog['status'] = 'new';
      if (s.status === 'closed') {
        status = 'closed';
      } else if (isThisLineBotBound && lastMsg && lastMsg.sender === 'bot') {
        status = 'bot';
      } else if (hasActiveOperator || (s.status === 'answered' && operatorUser)) {
        status = 'in_progress';
      } else if (s.status === 'new') {
        status = 'new';
      } else {
        status = 'in_progress';
      }

      // If existing dialog was explicitly reopened locally, and no new close happened in Bitrix after reopening
      let closedAtDate: string | undefined = s.dateClose || undefined;
      let reopenedAtDate: string | undefined = existingDialog?.reopenedAt;
      if (existingDialog?.reopenedAt) {
        const reopenTime = new Date(existingDialog.reopenedAt).getTime();
        const bitrixCloseTime = s.dateClose ? new Date(s.dateClose).getTime() : 0;
        if (status === 'closed' && (!bitrixCloseTime || reopenTime >= bitrixCloseTime)) {
          status = existingDialog.status === 'closed' ? 'in_progress' : existingDialog.status;
          closedAtDate = undefined;
        } else if (status === 'closed' && bitrixCloseTime > reopenTime) {
          reopenedAtDate = undefined;
        }
      }

      return {
        id: `chat-${s.chatId}`,
        dialogId: `chat${s.chatId}`,
        customer,
        channelId: s.configId,
        channelName,
        channelType,
        status,
        priority: status === 'new' ? 'high' : 'normal',
        assignedAgentId: hasActiveOperator
          ? String(s.operatorId)
          : (status === 'in_progress' && operatorUser ? String(operatorUser.id) : null),
        assignedAgentName: hasActiveOperator
          ? (assignedOperatorUser?.name || (s.operatorId === 15 ? 'Цогтгэрэл Ч' : `Оператор #${s.operatorId}`))
          : (status === 'in_progress' && operatorUser ? operatorUser.name : null),
        assignedAgentAvatar: hasActiveOperator
          ? (assignedOperatorUser?.avatar && assignedOperatorUser.avatar !== '/bitrix/js/im/images/blank.gif' ? assignedOperatorUser.avatar : null)
          : (status === 'in_progress' && operatorUser?.avatar && operatorUser.avatar !== '/bitrix/js/im/images/blank.gif' ? operatorUser.avatar : null),
        lastMessageText: lastMsg ? lastMsg.text : 'Харилцан яриа эхэлсэн',
        lastMessageTime: lastMsg ? lastMsg.timestamp : s.dateCreate,
        lastMessageSender: lastMsg ? lastMsg.sender : 'system',
        unreadCount: status === 'new' ? 1 : 0,
        createdAt: s.dateCreate,
        closedAt: closedAtDate,
        reopenedAt: reopenedAtDate,
        messages,
      };
    } catch (e: any) {
      console.error('[OpenlinesSync] Error mapping raw dialog:', e);
      return null;
    }
  }

  /**
   * Бүх нээлттэй сувгуудын сешнүүдийг ухаалаг диффинг (Smart Diffing)-ээр шалгах:
   * 1. Rate-limit сааталтай үед хүлээх (дахин спамдаж хугацаа сунгахгүй).
   * 2. Мессежийн тоо өөрчлөгдөөгүй, өмнө нь татагдсан чатуудыг БИТРИКС-ээс дахин дахин татахгүй алгасах (95% хэмнэлт).
   * 3. Зөвхөн шинэ мессеж ирсэн сешнүүдийг л хурдан хугацаанд боловсруулах.
   */
  async syncOpenlineSessions(limit = 25): Promise<{ count: number; updated: number; error?: string }> {
    if (this.isSyncing) {
      return { count: 0, updated: 0 };
    }

    // Rate limit шалгалт: Хэрэв API rate limit хүлээгдэж байвал шууд гарна
    const rateLimit = getVibeRateLimitInfo();
    if (rateLimit.isRateLimited) {
      return { count: 0, updated: 0, error: `RATE_LIMITED_COOLDOWN_${rateLimit.retryAfterSec}s` };
    }

    this.isSyncing = true;
    const botCfg = botWorker.getConfig();

    try {
      if (this.lineMap.size === 0) {
        await this.loadLineConfigs();
      }

      const sessionsRes = await vibeRequest<any>('POST', '/v1/openlines/sessions/search', {
        limit,
      });

      if (!sessionsRes.success || !sessionsRes.data?.sessions) {
        return { count: 0, updated: 0, error: sessionsRes.error?.message || 'No sessions returned' };
      }

      const sessions = sessionsRes.data.sessions as any[];
      let updatedCount = 0;

      // Smart Diffing: Ямар сешнүүдэд ШИНЭ мессеж ирсэн эсвэл статус өөрчлөгдсөнийг тодорхойлох
      const sessionsToFetch: any[] = [];

      for (const s of sessions) {
        const dialogId = `chat${s.chatId}`;
        const existing = chatManager.getDialogById(`chat-${s.chatId}`) || chatManager.getDialogById(dialogId);

        const lastKnownCount = this.knownSessionCounts.get(s.chatId);
        const lastKnownStatus = this.knownSessionStatuses.get(s.chatId);

        const countChanged = lastKnownCount === undefined || s.messageCount !== lastKnownCount;
        const statusChanged = lastKnownStatus === undefined || s.status !== lastKnownStatus;
        const hasNoCachedMessages = !existing || existing.messages.length === 0;
        const isActiveChat = this.activeChatId !== null && Number(this.activeChatId) === Number(s.chatId);

        if (countChanged || statusChanged || hasNoCachedMessages || isActiveChat) {
          sessionsToFetch.push(s);
        } else {
          // Чатад шинэ мессеж байхгүй - орон нутгийн оператор тохиргоо болон төлөвийг синк хийнэ
          if (existing) {
            if (s.operatorId && Number(s.operatorId) > 0 && Number(s.operatorId) !== 19170 && Number(s.operatorId) !== botCfg.botId) {
              if (String(s.operatorId) !== existing.assignedAgentId) {
                existing.assignedAgentId = String(s.operatorId);
                existing.status = 'in_progress';
              }
            } else if (!s.operatorId && s.status === 'new') {
              // Bitrix operator unassigned/returned to queue
              if (existing.assignedAgentId && existing.status !== 'closed') {
                existing.assignedAgentId = null;
                existing.assignedAgentName = null;
                existing.status = 'new';
              }
            }
          }
        }
      }

      // Зөвхөн шинэчлэгдсэн сешнүүдийг зэрэгцээ (parallel) хурдтайгаар татаж боловсруулах
      const chunkSize = 4;
      for (let i = 0; i < sessionsToFetch.length; i += chunkSize) {
        const chunk = sessionsToFetch.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (s) => {
            try {
              const channelName = this.getLineName(s.configId);

              // 1. Эхлээд хурдан GET /v1/chats/:dialogId/messages ашиглах
              let rawData: any = null;
              const msgRes = await vibeRequest<any>('GET', `/v1/chats/chat${s.chatId}/messages`);
              if (msgRes.success && msgRes.data?.messages) {
                rawData = msgRes.data;
              } else {
                // 2. Шаардлагатай бол POST /v1/openlines/sessions/history
                const histRes = await vibeRequest<any>('POST', '/v1/openlines/sessions/history', {
                  chatId: s.chatId,
                });
                if (histRes.success && histRes.data?.messages) {
                  rawData = histRes.data;
                }
              }

              if (!rawData) {
                return;
              }

              const chatDialog = this.mapRawToChatDialog(s, rawData, channelName);
              if (!chatDialog) return;

              chatManager.upsertBitrixDialog(chatDialog);
              this.knownSessionCounts.set(s.chatId, s.messageCount || chatDialog.messages.length);
              this.knownSessionStatuses.set(s.chatId, s.status);
              updatedCount++;

              // Бот идэвхтэй бөгөөд харилцагч хамгийн сүүлд бичсэн бол AI хариулт илгээх
              const isThisLineBotBound =
                Boolean(botCfg.isPollingActive) &&
                Boolean(botCfg.selectedLineId) &&
                Number(botCfg.selectedLineId) === Number(s.configId);

              const visibleMsgs = chatDialog.messages.filter((m) => m.sender !== 'system');
              const lastMsg = visibleMsgs[visibleMsgs.length - 1];

              if (isThisLineBotBound && lastMsg && lastMsg.sender === 'customer' && s.status !== 'closed') {
                const hasBotReplied = visibleMsgs.some(
                  (m) =>
                    m.sender === 'bot' &&
                    new Date(m.timestamp).getTime() >= new Date(lastMsg.timestamp).getTime()
                );

                if (!hasBotReplied) {
                  botWorker
                    .processOpenlineCustomerMessage({
                      chatId: s.chatId,
                      dialogId: `chat${s.chatId}`,
                      messageId: Number(lastMsg.id.replace('bx-', '')) || 0,
                      text: lastMsg.text,
                      customerName: chatDialog.customer.name,
                      channelId: s.configId,
                      channelName,
                      channelType: chatDialog.channelType,
                    })
                    .catch((err) => console.error('[OpenlinesSync] AI Bot processing error:', err));
                }
              }
            } catch (err: any) {
              console.warn(`[OpenlinesSync] Error processing session ${s.chatId}:`, err.message);
            }
          })
        );
      }

      this.lastSyncTime = new Date().toISOString();
      return { count: sessions.length, updated: updatedCount };
    } catch (e: any) {
      console.error('[OpenlinesSync] Global sync error:', e);
      return { count: 0, updated: 0, error: e.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async sendMessageToBitrixChat(dialogIdOrChatId: string, message: string): Promise<any> {
    const dialogId = dialogIdOrChatId.startsWith('chat')
      ? dialogIdOrChatId
      : `chat${dialogIdOrChatId}`;

    const res = await vibeRequest('POST', `/v1/chats/${dialogId}/messages`, {
      message,
    });

    // Mark current session count as increased so next sync will refresh smoothly
    const num = parseInt(dialogId.replace('chat', ''), 10);
    if (!isNaN(num)) {
      const prev = this.knownSessionCounts.get(num) || 0;
      this.knownSessionCounts.set(num, prev + 1);
    }

    return res;
  }

  async answerOperatorChat(chatId: number): Promise<any> {
    try {
      return await vibeRequest('POST', '/v1/openlines/operator/answer', {
        chatId,
      });
    } catch (e: any) {
      console.warn('[OpenlinesSync] Error answering openline chat:', e.message);
      return null;
    }
  }

  async finishOperatorChat(chatId: number): Promise<any> {
    try {
      this.markChatClosed(chatId);
      return await vibeRequest('POST', '/v1/openlines/operator/finish', {
        chatId,
      });
    } catch (e: any) {
      console.warn('[OpenlinesSync] Error finishing openline chat:', e.message);
      return null;
    }
  }

  markChatReopened(chatId: number) {
    this.knownSessionStatuses.set(chatId, 'opened');
  }

  markChatClosed(chatId: number) {
    this.knownSessionStatuses.set(chatId, 'closed');
  }

  startAutoSync(intervalMs = 1800) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.activeChatTimer) {
      clearInterval(this.activeChatTimer);
    }

    // Initial sync
    this.syncOpenlineSessions().catch((err) => {
      console.warn('[OpenlinesSync] Initial sync error:', err.message);
    });

    // 1. Periodic background sync for all open sessions (1.8s for rapid chat delivery)
    this.timer = setInterval(() => {
      this.syncOpenlineSessions(25).catch((err) => {
        console.warn('[OpenlinesSync] Interval sync error:', err.message);
      });
    }, intervalMs);

    // 2. Ultra high-frequency sync for the active chat currently open on the operator screen (800ms interval)
    this.activeChatTimer = setInterval(() => {
      if (this.activeChatId && !this.isSingleSyncing) {
        this.isSingleSyncing = true;
        this.syncSingleChat(this.activeChatId)
          .catch((err) => {
            console.warn('[OpenlinesSync] High-frequency sync error:', err.message);
          })
          .finally(() => {
            this.isSingleSyncing = false;
          });
      }
    }, 800);
  }

  stopAutoSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activeChatTimer) {
      clearInterval(this.activeChatTimer);
      this.activeChatTimer = null;
    }
  }

  getStatus() {
    const rateLimit = getVibeRateLimitInfo();
    return {
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
      linesCount: this.lineMap.size,
      activeChatId: this.activeChatId,
      cachedSessionsCount: this.knownSessionCounts.size,
      isRateLimited: rateLimit.isRateLimited,
      retryAfterSec: rateLimit.retryAfterSec,
    };
  }
}

export const bitrixOpenlinesSync = new BitrixOpenlinesSyncService();

