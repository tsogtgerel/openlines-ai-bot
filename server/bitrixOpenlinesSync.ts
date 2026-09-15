import { vibeRequest } from './vibeApi';
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

  async syncOpenlineSessions(limit = 40): Promise<{ count: number; updated: number; error?: string }> {
    if (this.isSyncing) {
      return { count: 0, updated: 0 };
    }
    this.isSyncing = true;

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

      // Process in batches of 5 concurrent history requests to stay well within rate limits
      const chunkSize = 5;
      for (let i = 0; i < sessions.length; i += chunkSize) {
        const chunk = sessions.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (s) => {
            try {
              const dialogId = `chat${s.chatId}`;
              const existing = chatManager.getDialogById(`chat-${s.chatId}`) || chatManager.getDialogById(dialogId);

              // Only skip if session is already closed and cached with messages
              if (
                s.status === 'closed' &&
                existing &&
                existing.status === 'closed' &&
                existing.messages.length > 0
              ) {
                return;
              }

              const histRes = await vibeRequest<any>('POST', '/v1/openlines/sessions/history', {
                chatId: s.chatId,
              });

              if (!histRes.success || !histRes.data) {
                return;
              }

              const hData = histRes.data;
              const channelName = this.getLineName(s.configId);
              const channelType = resolveChannelType(s.source, channelName);
              const botCfg = botWorker.getConfig();

              // Find customer user and operator
              const customerUser =
                hData.users?.find((u: any) => u.connector || u.type === 'extranet' || u.id === s.userId) ||
                hData.users?.[0];

              const operatorUser = hData.users?.find(
                (u: any) => !u.connector && u.type === 'user' && u.id !== 19170 && u.id !== botCfg.botId
              );

              const customer: CustomerProfile = {
                name: customerUser?.name || 'Зочин харилцагч',
                avatar: customerUser?.avatar && customerUser.avatar !== '/bitrix/js/im/images/blank.gif'
                  ? customerUser.avatar
                  : undefined,
                crmLeadId: s.crmEntityId ? `LEAD-${s.crmEntityId}` : undefined,
                tags: [s.source ? s.source.toUpperCase() : 'OPENLINE', 'Битрикс24 Live'],
              };

              // Map messages
              const rawMessages = hData.messages || [];
              const messages: ChatMessage[] = rawMessages.map((m: any) => {
                let sender: ChatMessage['sender'] = 'system';
                let senderName = 'Систем';

                const isBotMessage =
                  m.senderId === 19170 ||
                  m.senderId === botCfg.botId ||
                  (m.text && (m.text.includes('[BSB AI') || m.text.includes('🤖')));

                if (m.senderId === 0) {
                  sender = 'system';
                  senderName = 'Систем';
                } else if (isBotMessage) {
                  sender = 'bot';
                  senderName = botCfg.botName || 'BSB AI Туслах';
                } else if (customerUser && m.senderId === customerUser.id) {
                  sender = 'customer';
                  senderName = customerUser.name;
                } else if (operatorUser && m.senderId === operatorUser.id) {
                  sender = 'agent';
                  senderName = operatorUser.name;
                } else {
                  sender = m.senderId > 0 ? 'agent' : 'system';
                  senderName = operatorUser?.name || 'Оператор';
                }

                return {
                  id: `bx-${m.id}`,
                  sender,
                  senderName,
                  text: cleanBBCode(m.text || m.textLegacy || ''),
                  timestamp: m.date,
                  status: 'delivered',
                };
              });

              // Filter for last human or visible message
              const visibleMsgs = messages.filter((m) => m.text && m.sender !== 'system');
              const lastMsg = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : messages[messages.length - 1];

              // Bot is only actively handling if polling is active, selectedLineId is configured, and matches this line
              const isThisLineBotBound =
                Boolean(botCfg.isPollingActive) &&
                Boolean(botCfg.selectedLineId) &&
                Number(botCfg.selectedLineId) === Number(s.configId);

              // Status mapping
              let status: ChatDialog['status'] = 'new';
              if (s.status === 'closed') {
                status = 'closed';
              } else if (isThisLineBotBound && lastMsg && lastMsg.sender === 'bot') {
                status = 'bot';
              } else if (operatorUser && (s.status === 'answered' || (s.operatorId && s.operatorId > 0 && s.operatorId !== 19170 && s.operatorId !== botCfg.botId))) {
                status = 'in_progress';
              } else if (s.status === 'new') {
                status = 'new';
              } else {
                status = 'in_progress';
              }

              const chatDialog: ChatDialog = {
                id: `chat-${s.chatId}`,
                dialogId: `chat${s.chatId}`,
                customer,
                channelId: s.configId,
                channelName,
                channelType,
                status,
                priority: status === 'new' ? 'high' : 'normal',
                assignedAgentId: operatorUser ? String(operatorUser.id) : (s.operatorId && s.operatorId !== 19170 ? String(s.operatorId) : null),
                assignedAgentName: operatorUser ? operatorUser.name : null,
                assignedAgentAvatar: operatorUser?.avatar && operatorUser.avatar !== '/bitrix/js/im/images/blank.gif'
                  ? operatorUser.avatar
                  : null,
                lastMessageText: lastMsg ? lastMsg.text : 'Харилцан яриа эхэлсэн',
                lastMessageTime: lastMsg ? lastMsg.timestamp : s.dateCreate,
                lastMessageSender: lastMsg ? lastMsg.sender : 'system',
                unreadCount: status === 'new' ? 1 : 0,
                createdAt: s.dateCreate,
                closedAt: s.dateClose || undefined,
                messages,
              };

              chatManager.upsertBitrixDialog(chatDialog);
              updatedCount++;

              // Trigger AI Bot ONLY if bot is actively bound to this exact channel
              const isLineBotEnabled = isThisLineBotBound;

              const lastRawMsg = rawMessages[rawMessages.length - 1];
              const isCustomerLast =
                lastRawMsg &&
                customerUser &&
                lastRawMsg.senderId === customerUser.id &&
                Boolean(lastRawMsg.text?.trim());

              if (isLineBotEnabled && isCustomerLast && s.status !== 'closed') {
                // Ensure bot hasn't already replied to this message
                const hasBotReplied = rawMessages.some(
                  (m: any) =>
                    (m.senderId === 19170 || m.senderId === botCfg.botId || (m.text && m.text.includes('[BSB AI'))) &&
                    new Date(m.date).getTime() >= new Date(lastRawMsg.date).getTime()
                );

                if (!hasBotReplied) {
                  botWorker
                    .processOpenlineCustomerMessage({
                      chatId: s.chatId,
                      dialogId: `chat${s.chatId}`,
                      messageId: lastRawMsg.id,
                      text: cleanBBCode(lastRawMsg.text || lastRawMsg.textLegacy || ''),
                      customerName: customer.name,
                      channelId: s.configId,
                      channelName,
                      channelType,
                    })
                    .catch((err) => console.error('[OpenlinesSync] AI Bot processing error:', err));
                }
              }
            } catch (err: any) {
              console.warn(`[OpenlinesSync] Error syncing chat ${s.chatId}:`, err.message);
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

    return vibeRequest('POST', `/v1/chats/${dialogId}/messages`, {
      message,
    });
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
      return await vibeRequest('POST', '/v1/openlines/operator/finish', {
        chatId,
      });
    } catch (e: any) {
      console.warn('[OpenlinesSync] Error finishing openline chat:', e.message);
      return null;
    }
  }

  startAutoSync(intervalMs = 3000) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Initial sync
    this.syncOpenlineSessions().catch((err) => {
      console.warn('[OpenlinesSync] Initial sync error:', err.message);
    });

    this.timer = setInterval(() => {
      this.syncOpenlineSessions(20).catch((err) => {
        console.warn('[OpenlinesSync] Interval sync error:', err.message);
      });
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus() {
    return {
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
      linesCount: this.lineMap.size,
    };
  }
}

export const bitrixOpenlinesSync = new BitrixOpenlinesSyncService();
