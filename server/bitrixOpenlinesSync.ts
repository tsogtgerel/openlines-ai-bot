import { vibeRequest, getVibeRateLimitInfo } from './vibeApi';
import { chatManager, ChatDialog, ChatMessage, CustomerProfile } from './chatManager';
import { worktimeManager } from './worktimeManager';
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
  private latestSessionsCache: Map<number, any> = new Map();
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

      const cachedSession = this.latestSessionsCache.get(numChatId);
      const configId = cachedSession?.configId || (existing?.channelId ? Number(existing.channelId) : 39);
      const channelName = this.getLineName(configId);

      // Prefer cached latest session CRM entity to avoid flipping to older stale records
      let crmEntityId: number | undefined = cachedSession?.crmEntityId;
      let crmEntityType: string | undefined = cachedSession?.crmEntityType;

      if (!crmEntityId && existing?.customer?.crmLeadId) {
        const parts = existing.customer.crmLeadId.split('-');
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          crmEntityType = parts[0];
          crmEntityId = Number(parts[1]);
        }
      }

      const rawMsgs = rawData.messages || [];
      const lastCloseMsg = [...rawMsgs].reverse().find((m: any) => {
        const txt = (m.text || '').toLowerCase();
        return txt.includes('диалог хаагдлаа') || txt.includes('conversation closed');
      });
      const lastCloseTime = lastCloseMsg ? new Date(lastCloseMsg.date).getTime() : 0;
      const lastCustMsg = [...rawMsgs].reverse().find((m: any) => {
        return m.authorId === undefined || m.authorId === 0 || (rawData.users?.find((u: any) => (u.id === m.authorId || u.id === m.senderId) && (u.connector || u.type === 'extranet')));
      });
      const lastCustTime = lastCustMsg ? new Date(lastCustMsg.date).getTime() : 0;
      const hasCustomerAfterClose = lastCloseTime > 0 && lastCustTime > lastCloseTime;
      const localTakeTime = (existing as any)?.localAssignedAt ? Number((existing as any).localAssignedAt) : 0;
      const hasLocalTakeAfterCust = localTakeTime > 0 && localTakeTime >= lastCustTime;

      const botCfg = botWorker.getConfig();
      const hasCachedBitrixOp = Boolean(
        cachedSession?.operatorId &&
        Number(cachedSession.operatorId) > 0 &&
        Number(cachedSession.operatorId) !== 19170 &&
        Number(cachedSession.operatorId) !== botCfg.botId &&
        (cachedSession.status === 'answered' || cachedSession.status === 'in_progress' || Boolean(cachedSession.dateOperatorAnswer))
      );

      const isCurrentlyUnassignedOrQueue =
        !hasCachedBitrixOp &&
        ((hasCustomerAfterClose && !hasLocalTakeAfterCust) ||
        existing?.status === 'new' ||
        !existing?.assignedAgentId ||
        existing?.assignedAgentId === 'unassigned');

      const localOperatorId = (hasLocalTakeAfterCust && existing?.assignedAgentId) ? parseInt(String(existing.assignedAgentId).replace(/^bx-/, ''), 10) : 0;
      const validLocalOpId = !isNaN(localOperatorId) && localOperatorId > 0 ? localOperatorId : 0;

      // If local state has an active assigned operator (from recent take or transfer), respect it!
      // But if the chat is in queue ('new') or unassigned, NEVER restore an old operator!
      const effectiveOperatorId = isCurrentlyUnassignedOrQueue
        ? 0
        : (validLocalOpId > 0
          ? validLocalOpId
          : ((cachedSession?.operatorId && Number(cachedSession.operatorId) > 0) ? Number(cachedSession.operatorId) : 0));

      if (effectiveOperatorId > 0) {
        this.recordLocalAssignment(numChatId, effectiveOperatorId);
      } else if (isCurrentlyUnassignedOrQueue) {
        this.clearLocalAssignment(numChatId);
      }

      const sessionObj = {
        chatId: numChatId,
        id: cachedSession?.id,
        configId,
        source: cachedSession?.source || existing?.channelType || 'webchat',
        status: isCurrentlyUnassignedOrQueue ? 'new' : (cachedSession?.status || existing?.status || 'new'),
        userId: cachedSession?.userId || 0,
        userCode: cachedSession?.userCode,
        operatorId: effectiveOperatorId || null,
        dateCreate: cachedSession?.dateCreate || existing?.createdAt || new Date().toISOString(),
        messageCount: rawData.messages.length,
        crmEntityId,
        crmEntityType,
      };

      const updatedDialog = this.mapRawToChatDialog(sessionObj, rawData, channelName);
      if (updatedDialog) {
        chatManager.upsertBitrixDialog(updatedDialog);
        this.knownSessionCounts.set(numChatId, rawData.messages.length);

        const currentDialog = chatManager.getDialogById(`chat-${numChatId}`) || updatedDialog;
        const botCfg = botWorker.getConfig();
        const isExplicitlyConnected = Boolean(currentDialog?.botActive || currentDialog?.status === 'bot');
        const isBotActiveForThisChat =
          isExplicitlyConnected ||
          (botCfg.botAssignmentMode === 'all_chats' &&
            currentDialog.status !== 'in_progress' &&
            currentDialog.status !== 'assigned' &&
            currentDialog.botActive !== false &&
            !currentDialog.assignedAgentId &&
            (!botCfg.selectedLineId || Number(botCfg.selectedLineId) === Number(configId)));

        const visibleMsgs = currentDialog.messages.filter((m) => m.sender !== 'system');
        const lastMsg = visibleMsgs[visibleMsgs.length - 1];

        if (isBotActiveForThisChat && lastMsg && lastMsg.sender === 'customer' && currentDialog.status !== 'closed') {
          const lastMsgTime = new Date(lastMsg.timestamp).getTime();
          const botConnectedTime = currentDialog.botConnectedAt ? new Date(currentDialog.botConnectedAt).getTime() : 0;
          const isSentBeforeBotConnected = botConnectedTime > 0 && lastMsgTime < botConnectedTime - 2000;

          const lastMsgIdx = currentDialog.messages.map((m) => m.id).lastIndexOf(lastMsg.id);
          const hasReplied =
            lastMsgIdx >= 0 &&
            currentDialog.messages
              .slice(lastMsgIdx + 1)
              .some((m) => m.sender === 'agent' || m.sender === 'bot');

          const rawMsgNum = Number(lastMsg.id.replace('bx-', '')) || 0;
          // syncSingleChat is only for UI data synchronization; automated AI responses are handled centrally by syncSessions
        }

        return currentDialog;
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

      // Check for locally assigned or transferred operator in cache or existingDialog
      const cachedAssignment = this.latestSessionsCache.get(Number(s.chatId));
      const hasRecentLocalCache = Boolean(
        cachedAssignment?.localAssignedAt && (Date.now() - cachedAssignment.localAssignedAt < 86400000)
      );
      const hasRecentExistingAssign = Boolean(
        (existingDialog as any)?.localAssignedAt && (Date.now() - (existingDialog as any).localAssignedAt < 86400000)
      );

      let finalAssignedAgentId: string | null = null;
      let finalAssignedAgentName: string | null = null;
      let finalAssignedAgentAvatar: string | null = null;

      const rawMsgsList = rawData.messages || [];
      const closeMsgInRaw = [...rawMsgsList].reverse().find((m: any) => {
        const txt = (m.text || '').toLowerCase();
        return txt.includes('диалог хаагдлаа') || txt.includes('conversation closed');
      });
      const closeTimeInRaw = closeMsgInRaw ? new Date(closeMsgInRaw.date).getTime() : 0;
      const custMsgInRaw = [...rawMsgsList].reverse().find((m: any) => {
        return m.authorId === undefined || m.authorId === 0 || (rawData.users?.find((u: any) => (u.id === m.authorId || u.id === m.senderId) && (u.connector || u.type === 'extranet')));
      });
      const custTimeInRaw = custMsgInRaw ? new Date(custMsgInRaw.date).getTime() : 0;
      const hasCustomerAfterLastClose = closeTimeInRaw > 0 && custTimeInRaw > closeTimeInRaw;
      const localAssignedTime = (existingDialog as any)?.localAssignedAt ? Number((existingDialog as any).localAssignedAt) : 0;
      const isTakenLocallyAfterCust = localAssignedTime > 0 && localAssignedTime >= custTimeInRaw;

      // Check if an operator picked the conversation in Bitrix messages (e.g. "[USER=4605 REPLACE]Энхзаяа А.[/USER] picked conversation")
      const pickMsgInRaw = [...rawMsgsList].reverse().find((m: any) => {
        const txt = (m.text || '').toLowerCase();
        return txt.includes('picked conversation') || txt.includes('харилцан яриаг өөртөө авлаа') || txt.includes('взял диалог');
      });
      const pickTimeInRaw = pickMsgInRaw ? new Date(pickMsgInRaw.date).getTime() : 0;
      const isPickedInBitrixAfterCust = pickTimeInRaw > 0 && pickTimeInRaw >= custTimeInRaw;

      // Check if operator answered or session is marked answered/in_progress in Bitrix
      const opAnswerTime = s.dateOperatorAnswer ? new Date(s.dateOperatorAnswer).getTime() : 0;
      const isAnsweredByOpInBitrix = opAnswerTime > 0 && opAnswerTime >= custTimeInRaw;

      const isPickedOrAnsweredInBitrix = hasActiveOperator && (
        s.status === 'answered' ||
        s.status === 'in_progress' ||
        isPickedInBitrixAfterCust ||
        isAnsweredByOpInBitrix
      );

      const isQueueChatSession =
        !isPickedOrAnsweredInBitrix &&
        !isTakenLocallyAfterCust &&
        (
          (hasCustomerAfterLastClose && !isTakenLocallyAfterCust && !isPickedInBitrixAfterCust) ||
          s.status === 'new' ||
          !s.operatorId
        );

      // prevAgentId can ONLY be preserved if the chat was actively in progress and not returned to queue
      const prevAgentId = (!isQueueChatSession && existingDialog?.status === 'in_progress' && existingDialog?.assignedAgentId && existingDialog.assignedAgentId !== 'unassigned')
        ? existingDialog.assignedAgentId
        : null;
      const prevAgentName = prevAgentId ? existingDialog?.assignedAgentName : null;
      const prevAgentAvatar = prevAgentId ? existingDialog?.assignedAgentAvatar : null;

      if (!isQueueChatSession) {
        if (isTakenLocallyAfterCust && cachedAssignment?.operatorId) {
          const opUser = worktimeManager.getAgentById(String(cachedAssignment.operatorId));
          finalAssignedAgentId = opUser?.id || `bx-${cachedAssignment.operatorId}`;
          finalAssignedAgentName = opUser?.name || `Оператор #${cachedAssignment.operatorId}`;
          finalAssignedAgentAvatar = opUser?.avatar || null;
        } else if (isTakenLocallyAfterCust && prevAgentId) {
          finalAssignedAgentId = prevAgentId;
          finalAssignedAgentName = prevAgentName || null;
          finalAssignedAgentAvatar = prevAgentAvatar || null;
        } else if (hasActiveOperator) {
          const opUser = worktimeManager.getAgentById(String(s.operatorId));
          finalAssignedAgentId = opUser?.id || `bx-${s.operatorId}`;
          finalAssignedAgentName = opUser?.name || assignedOperatorUser?.name || `Оператор #${s.operatorId}`;
          finalAssignedAgentAvatar = opUser?.avatar || (assignedOperatorUser?.avatar && assignedOperatorUser.avatar !== '/bitrix/js/im/images/blank.gif' ? assignedOperatorUser.avatar : null);
        }
      }

      // Sort messages chronologically (oldest first, newest last)
      const sortedRaw = [...rawMessages].sort((a: any, b: any) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });

      // Find the latest transfer notice timestamp (if any) to distinguish messages before vs after operator switch
      const transferNoticeMsg = [...sortedRaw].reverse().find((m: any) => {
        const t = (m.text || '').toLowerCase();
        return t.includes('шилжүүллээ') || t.includes('transferred');
      });
      const transferTimestamp = transferNoticeMsg
        ? new Date(transferNoticeMsg.date).getTime()
        : (cachedAssignment?.localAssignedAt || (existingDialog as any)?.localAssignedAt || 0);

      const allAgentsList = worktimeManager.getAllAgents();

      const messages: ChatMessage[] = sortedRaw.map((m: any) => {
        let sender: ChatMessage['sender'] = 'system';
        let senderName = 'Систем';

        const senderId = m.authorId !== undefined ? m.authorId : m.senderId;
        let msgText = cleanBBCode(m.text || m.textLegacy || '');

        const isBotMessage =
          senderId === 19170 ||
          senderId === botCfg.botId ||
          (msgText && (msgText.includes('[BSB AI') || msgText.includes('🤖')));

        // Check if message text has an operator prefix, e.g. "Хосмөнх Түвшинбаяр: сайн байна уу" or "[Хосмөнх]: сайн байна уу"
        let parsedOperatorName: string | null = null;
        const prefixMatch = msgText.match(/^\[?([A-Za-zА-Яа-яӨөҮү\s\.\-]+)\]?:\s*(.+)$/s);
        if (prefixMatch) {
          const potName = prefixMatch[1].trim();
          const matched = allAgentsList.find(
            (a) =>
              (a.name && a.name.toLowerCase() === potName.toLowerCase()) ||
              ((a as any).fullName && (a as any).fullName.toLowerCase() === potName.toLowerCase()) ||
              (a.name && potName.toLowerCase().includes(a.name.toLowerCase()))
          );
          if (matched) {
            parsedOperatorName = matched.name;
            msgText = prefixMatch[2].trim();
          } else if (finalAssignedAgentName && potName.toLowerCase() === finalAssignedAgentName.toLowerCase()) {
            parsedOperatorName = finalAssignedAgentName;
            msgText = prefixMatch[2].trim();
          }
        }

        // Check if existingDialog already has a local record of this message with accurate senderName
        const existingLocalMatch = existingDialog?.messages?.find(
          (em) => em.sender === 'agent' && (em.id === `bx-${m.id}` || em.text === msgText)
        );

        const isSystemText =
          msgText.startsWith('Систем:') ||
          msgText.includes('шилжүүллээ') ||
          msgText.toLowerCase().includes('invited');

        const msgTime = new Date(m.date).getTime();
        const isPostTransfer = transferTimestamp > 0 && msgTime > transferTimestamp;

        if (senderId === 0 || isSystemText) {
          sender = 'system';
          senderName = 'Систем';
        } else if (isBotMessage) {
          sender = 'bot';
          senderName = botCfg.botName || 'BSB AI Туслах';
        } else if (customerUser && senderId === customerUser.id) {
          sender = 'customer';
          senderName = customerUser.name;
        } else if (parsedOperatorName) {
          sender = 'agent';
          senderName = parsedOperatorName;
        } else if (isPostTransfer && finalAssignedAgentName) {
          // Message was sent AFTER the chat was transferred to the new operator
          sender = 'agent';
          senderName =
            existingLocalMatch?.senderName && existingLocalMatch.senderName !== operatorUser?.name
              ? existingLocalMatch.senderName
              : finalAssignedAgentName;
        } else if (existingLocalMatch && existingLocalMatch.senderName) {
          sender = 'agent';
          senderName = existingLocalMatch.senderName;
        } else {
          // Message came from an operator. Determine whether it was the new or old operator:
          sender = 'agent';
          const specificUser = rawData.users?.find(
            (u: any) => Number(u.id) === Number(senderId) && !u.connector && u.type === 'user' && u.id !== 19170 && u.id !== botCfg.botId
          );
          if (specificUser && specificUser.id !== 15) {
            senderName = specificUser.name;
          } else if (finalAssignedAgentName) {
            senderName = finalAssignedAgentName;
          } else {
            senderName = operatorUser?.name || 'Оператор';
          }
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

      // Preserve local system transfer / handoff notes from existingDialog
      const localSysMsgs = existingDialog?.messages?.filter((m) => m.sender === 'system' && m.id.startsWith('sys-')) || [];
      const mergedMessages = [...messages];
      for (const sm of localSysMsgs) {
        if (!mergedMessages.some((m) => m.text === sm.text)) {
          mergedMessages.push(sm);
        }
      }
      mergedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const visibleMsgs = mergedMessages.filter((m) => m.text && m.sender !== 'system');
      const lastMsg = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : mergedMessages[mergedMessages.length - 1];

      const isThisLineBotBound =
        Boolean(botCfg.isPollingActive) &&
        Boolean(botCfg.selectedLineId) &&
        Number(botCfg.selectedLineId) === Number(s.configId);

      // Check if bot is invited in messages or present in users list
      const isBotInvitedInMessages = sortedRaw.some((m: any) => {
        const t = (m.text || '').toLowerCase();
        return (
          t.includes('invited bsb ai assistant') ||
          t.includes('invited bsb') ||
          t.includes('invited bot') ||
          (botCfg.botName && t.includes(`invited ${botCfg.botName.toLowerCase()}`))
        );
      });
      const isBotUserInChat = Boolean(
        rawData.users?.some(
          (u: any) => Number(u.id) === Number(botCfg.botId) || Number(u.id) === 19170
        )
      );

      const isBotActiveNow =
        existingDialog?.botActive !== undefined
          ? existingDialog.botActive
          : (isBotInvitedInMessages || isBotUserInChat || (isThisLineBotBound && lastMsg && lastMsg.sender === 'bot'));

      const isChatClosedInMessages = closeTimeInRaw > 0 && closeTimeInRaw >= custTimeInRaw;

      let status: ChatDialog['status'] = 'new';
      if (isQueueChatSession || (hasCustomerAfterLastClose && !isTakenLocallyAfterCust && !isPickedInBitrixAfterCust)) {
        status = 'new';
        finalAssignedAgentId = null;
        finalAssignedAgentName = null;
        finalAssignedAgentAvatar = null;
      } else if (s.status === 'closed' || isChatClosedInMessages) {
        status = 'closed';
      } else if (isBotActiveNow) {
        status = 'bot';
      } else if (finalAssignedAgentId && (hasActiveOperator || s.status === 'answered' || s.status === 'in_progress')) {
        status = 'in_progress';
      } else {
        status = 'new';
      }

      // If existing dialog was explicitly reopened locally, and no new close happened in Bitrix after reopening
      let closedAtDate: string | undefined = s.dateClose || undefined;
      let reopenedAtDate: string | undefined = existingDialog?.reopenedAt;
      if (hasCustomerAfterLastClose && !isTakenLocallyAfterCust) {
        status = 'new';
        closedAtDate = undefined;
        reopenedAtDate = undefined;
        finalAssignedAgentId = null;
        finalAssignedAgentName = null;
        finalAssignedAgentAvatar = null;
      } else if (existingDialog?.reopenedAt) {
        const reopenTime = new Date(existingDialog.reopenedAt).getTime();
        const bitrixCloseTime = s.dateClose ? new Date(s.dateClose).getTime() : 0;
        if (bitrixCloseTime && bitrixCloseTime > reopenTime + 3000) {
          // Bitrix closed this session AFTER the user reopened
          status = 'closed';
          closedAtDate = s.dateClose;
          reopenedAtDate = undefined;
        } else {
          // Keep active/in_progress
          status = 'in_progress';
          closedAtDate = undefined;
        }
      } else if (existingDialog?.status === 'closed') {
        const existingCloseTime = existingDialog.closedAt ? new Date(existingDialog.closedAt).getTime() : 0;
        const lastCustomerMsg = mergedMessages.slice().reverse().find((m) => m.sender === 'customer');
        const lastCustTime = lastCustomerMsg ? new Date(lastCustomerMsg.timestamp).getTime() : 0;
        const sessionCreateTime = s.dateCreate ? new Date(s.dateCreate).getTime() : 0;
        const isNewSession = sessionCreateTime > existingCloseTime + 2000;
        const isCustMsgAfter = lastCustTime > existingCloseTime + 2000;

        if (isNewSession || isCustMsgAfter) {
          status = 'new';
          closedAtDate = undefined;
          finalAssignedAgentId = null;
          finalAssignedAgentName = null;
          finalAssignedAgentAvatar = null;
        } else {
          status = 'closed';
          closedAtDate = existingDialog.closedAt || s.dateClose || new Date().toISOString();
        }
      }

      let botConnectedAt = existingDialog?.botConnectedAt;
      if (!botConnectedAt && isBotActiveNow) {
        const inviteMsg = sortedRaw.find((m: any) => {
          const t = (m.text || '').toLowerCase();
          return t.includes('invited') && (t.includes('ai') || t.includes('assistant') || t.includes('bot') || t.includes('bsb'));
        });
        botConnectedAt = inviteMsg?.date || new Date().toISOString();
      }

      // Use already computed finalAssignedAgentId, finalAssignedAgentName, finalAssignedAgentAvatar from above

      return {
        id: `chat-${s.chatId}`,
        dialogId: `chat${s.chatId}`,
        customer,
        channelId: s.configId,
        channelName,
        channelType,
        status,
        priority: status === 'new' ? 'high' : 'normal',
        assignedAgentId: finalAssignedAgentId,
        assignedAgentName: finalAssignedAgentName,
        assignedAgentAvatar: finalAssignedAgentAvatar,
        lastMessageText: lastMsg ? lastMsg.text : 'Харилцан яриа эхэлсэн',
        lastMessageTime: lastMsg ? lastMsg.timestamp : s.dateCreate,
        lastMessageSender: lastMsg ? lastMsg.sender : 'system',
        unreadCount: status === 'new' ? 1 : 0,
        createdAt: s.dateCreate,
        closedAt: closedAtDate,
        reopenedAt: reopenedAtDate,
        botActive: isBotActiveNow,
        botConnectedAt,
        messages: mergedMessages,
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

      const rawSessions = sessionsRes.data.sessions as any[];
      let updatedCount = 0;

      // Deduplicate sessions by chatId so that only the LATEST authoritative session represents each chat.
      // Bitrix Openlines returns all historical sessions for each chat. An older closed session (e.g. DEAL-1727)
      // must NOT overwrite or conflict with the latest active session (e.g. LEAD-60102).
      const latestSessionsByChat = new Map<number, any>();
      for (const s of rawSessions) {
        if (!s.chatId) continue;
        const prev = latestSessionsByChat.get(s.chatId);
        if (!prev) {
          latestSessionsByChat.set(s.chatId, s);
        } else {
          const sId = Number(s.id) || 0;
          const prevId = Number(prev.id) || 0;
          const sDate = s.dateCreate ? new Date(s.dateCreate).getTime() : 0;
          const prevDate = prev.dateCreate ? new Date(prev.dateCreate).getTime() : 0;

          // The authoritative session is ALWAYS the latest one created in Bitrix
          let isNewer = false;
          if (sDate && prevDate && Math.abs(sDate - prevDate) > 1000) {
            isNewer = sDate > prevDate;
          } else if (sId && prevId) {
            isNewer = sId > prevId;
          } else {
            isNewer = sDate >= prevDate;
          }

          if (isNewer) {
            latestSessionsByChat.set(s.chatId, s);
          }
        }
      }

      // Update the class-level cache with latest session information while preserving local assignments
      for (const [chatId, s] of latestSessionsByChat.entries()) {
        const prevCached = this.latestSessionsCache.get(chatId);
        const existingDialog = chatManager.getDialogById(`chat-${chatId}`) || chatManager.getDialogById(`chat${chatId}`);
        const hasBitrixOp = s.operatorId && Number(s.operatorId) > 0 && Number(s.operatorId) !== 19170 && Number(s.operatorId) !== botCfg.botId;
        const isBitrixAnsweredOrPicked = hasBitrixOp && (s.status === 'answered' || s.status === 'in_progress' || Boolean(s.dateOperatorAnswer));
        const isQueueChat = !isBitrixAnsweredOrPicked && (s.status === 'new' || !s.operatorId);
        const hasRecentLocal = !isQueueChat && Boolean(
          (prevCached?.localAssignedAt && (Date.now() - prevCached.localAssignedAt < 86400000)) ||
          ((existingDialog as any)?.localAssignedAt && (Date.now() - (existingDialog as any).localAssignedAt < 86400000))
        );

        if (hasRecentLocal) {
          const preservedOpId = prevCached?.operatorId || (existingDialog?.assignedAgentId ? parseInt(String(existingDialog.assignedAgentId).replace(/^bx-/, ''), 10) : s.operatorId);
          this.latestSessionsCache.set(chatId, {
            ...s,
            operatorId: preservedOpId,
            localAssignedAt: prevCached?.localAssignedAt || (existingDialog as any)?.localAssignedAt || Date.now(),
          });
        } else {
          this.latestSessionsCache.set(chatId, {
            ...s,
            operatorId: isQueueChat ? null : s.operatorId,
            status: isQueueChat ? 'new' : s.status,
          });
        }
      }

      const sessions = Array.from(latestSessionsByChat.values());

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

        const hasBitrixOp = s.operatorId && Number(s.operatorId) > 0 && Number(s.operatorId) !== 19170 && Number(s.operatorId) !== botCfg.botId;
        const isBitrixAnsweredOrPicked = hasBitrixOp && (s.status === 'answered' || s.status === 'in_progress' || Boolean(s.dateOperatorAnswer));
        const isBitrixOpAnsweredQueue = isBitrixAnsweredOrPicked && existing && (existing.status === 'new' || !existing.assignedAgentId || existing.assignedAgentId === 'unassigned');

        if (countChanged || statusChanged || hasNoCachedMessages || isActiveChat || isBitrixOpAnsweredQueue) {
          sessionsToFetch.push(s);
        } else {
          // Чатад шинэ мессеж байхгүй - Bitrix дээр оператор авсан эсвэл өөрчлөгдсөн эсэхийг шалгана
          if (existing && existing.status !== 'closed') {
            if (isBitrixAnsweredOrPicked) {
              const cached = this.latestSessionsCache.get(Number(s.chatId));
              const isRecentLocalAssignment = cached?.localAssignedAt && (Date.now() - cached.localAssignedAt < 86400000);
              const isRecentExistingAssignment = (existing as any)?.localAssignedAt && (Date.now() - (existing as any).localAssignedAt < 86400000);
              if (!isRecentLocalAssignment && !isRecentExistingAssignment) {
                const opStr = String(s.operatorId);
                const existingOpNum = existing.assignedAgentId ? String(existing.assignedAgentId).replace(/^bx-/, '') : null;
                if (opStr !== existingOpNum && opStr !== existing.assignedAgentId) {
                  const resolvedAgent = worktimeManager.getAgentById(opStr);
                  existing.assignedAgentId = resolvedAgent?.id || `bx-${opStr}`;
                  existing.assignedAgentName = resolvedAgent?.name || existing.assignedAgentName || `Оператор #${opStr}`;
                  existing.assignedAgentAvatar = resolvedAgent?.avatar || null;
                  existing.status = 'in_progress';
                  chatManager.updateDialog(existing.id, {
                    assignedAgentId: existing.assignedAgentId,
                    assignedAgentName: existing.assignedAgentName,
                    assignedAgentAvatar: existing.assignedAgentAvatar,
                    status: existing.status,
                  });
                }
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
              const isExplicitlyConnected = Boolean(chatDialog.botActive || chatDialog.status === 'bot');

              const isBotActiveForThisChat =
                isExplicitlyConnected ||
                (botCfg.botAssignmentMode === 'all_chats' &&
                  chatDialog.status !== 'in_progress' &&
                  chatDialog.status !== 'assigned' &&
                  chatDialog.botActive !== false &&
                  !chatDialog.assignedAgentId &&
                  (!botCfg.selectedLineId || Number(botCfg.selectedLineId) === Number(s.configId)));

              const customerMsgs = chatDialog.messages.filter((m) => m.sender === 'customer');
              const lastCustomerMsg = customerMsgs[customerMsgs.length - 1];

              if (isBotActiveForThisChat && lastCustomerMsg && s.status !== 'closed') {
                const customerTime = new Date(lastCustomerMsg.timestamp).getTime();
                const botConnectedTime = chatDialog.botConnectedAt ? new Date(chatDialog.botConnectedAt).getTime() : 0;
                const isSentBeforeBotConnected = botConnectedTime > 0 && customerTime < botConnectedTime - 2000;

                const lastCustomerIdx = chatDialog.messages.map((m) => m.id).lastIndexOf(lastCustomerMsg.id);
                const hasReplied =
                  lastCustomerIdx >= 0 &&
                  chatDialog.messages
                    .slice(lastCustomerIdx + 1)
                    .some((m) => m.sender === 'agent' || m.sender === 'bot');

                const rawCustomerMsgNum = Number(lastCustomerMsg.id.replace('bx-', '')) || 0;
                const isAlreadyProcessed = botWorker.isMessageProcessed(`chat${s.chatId}`, rawCustomerMsgNum);
                const isCurrentlyProcessing = botWorker.isProcessingChat(`chat${s.chatId}`);
                const isPromptRecent = botWorker.isPromptRecentlyProcessed(`chat${s.chatId}`, lastCustomerMsg.text);

                if (!hasReplied && !isSentBeforeBotConnected && !isAlreadyProcessed && !isCurrentlyProcessing && !isPromptRecent) {
                  // Mark message processed immediately so concurrent loops skip
                  botWorker.markMessageProcessed(`chat${s.chatId}`, rawCustomerMsgNum);
                  botWorker
                    .processOpenlineCustomerMessage({
                      chatId: s.chatId,
                      dialogId: `chat${s.chatId}`,
                      messageId: rawCustomerMsgNum,
                      text: lastCustomerMsg.text,
                      customerName: chatDialog.customer.name,
                      channelId: s.configId,
                      channelName,
                      channelType: chatDialog.channelType,
                      userCode: s.userCode || (chatDialog.customer as any)?.socialId,
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

  async sendMessageToBitrixChat(
    dialogIdOrChatId: string,
    message: string,
    senderAgentName?: string
  ): Promise<any> {
    const match = dialogIdOrChatId.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : NaN;
    const dialogId = match ? `chat${match[0]}` : dialogIdOrChatId;

    let finalMessage = message;
    if (senderAgentName && senderAgentName.trim()) {
      const trimmedName = senderAgentName.trim();
      const startsWithName = finalMessage.startsWith(`${trimmedName}:`) || finalMessage.startsWith(`[${trimmedName}]:`);
      if (!startsWithName && !finalMessage.startsWith('Систем:') && !finalMessage.startsWith('[BSB AI')) {
        finalMessage = `${trimmedName}: ${finalMessage}`;
      }
    }

    const res = await vibeRequest(
      'POST',
      `/v1/chats/${dialogId}/messages`,
      {
        message: finalMessage,
      },
      undefined,
      { isOutgoingMessage: true }
    );

    // Mark current session count as increased so next sync will refresh smoothly
    if (!isNaN(num)) {
      const prev = this.knownSessionCounts.get(num) || 0;
      this.knownSessionCounts.set(num, prev + 1);
    }

    return res;
  }

  recordLocalAssignment(chatId: number, operatorId: number) {
    const existing = this.latestSessionsCache.get(chatId) || {};
    this.latestSessionsCache.set(chatId, {
      ...existing,
      chatId,
      operatorId,
      status: 'answered',
      localAssignedAt: Date.now(),
    });
    this.knownSessionStatuses.set(chatId, 'answered');
  }

  clearLocalAssignment(chatId: number) {
    const existing = this.latestSessionsCache.get(chatId);
    if (existing) {
      existing.operatorId = null;
      delete existing.localAssignedAt;
      existing.status = 'new';
    }
    this.knownSessionStatuses.set(chatId, 'new');
  }

  async transferOperatorChat(chatId: number, targetUserId: number): Promise<any> {
    try {
      this.recordLocalAssignment(chatId, targetUserId);
      // Ensure target user is added as chat participant in Bitrix
      await vibeRequest('POST', `/v1/chats/${chatId}/users`, { users: [targetUserId] }).catch(() => {});
      return { success: true };
    } catch (e: any) {
      console.warn('[OpenlinesSync] Error transferring openline chat:', e.message);
      return null;
    }
  }

  async answerOperatorChat(chatId: number, userId?: number): Promise<any> {
    try {
      if (userId && !isNaN(userId) && userId > 0) {
        this.recordLocalAssignment(chatId, userId);
      }
      const payload: any = { chatId };
      if (userId && !isNaN(userId) && userId > 0) {
        payload.userId = userId;
      }
      const answerRes = await vibeRequest('POST', '/v1/openlines/operator/answer', payload);
      // Also intercept the session to guarantee immediate operator takeover
      const interceptRes = await vibeRequest('POST', '/v1/openlines/sessions/intercept', payload);
      return interceptRes?.success ? interceptRes : answerRes;
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

  markChatReopened(chatId: number, operatorId?: number) {
    this.knownSessionStatuses.set(chatId, 'opened');
    const existing = this.latestSessionsCache.get(chatId);
    if (existing) {
      existing.status = 'in_progress';
      delete existing.dateClose;
      if (operatorId) {
        existing.operatorId = operatorId;
        existing.localAssignedAt = Date.now();
      }
    } else {
      this.latestSessionsCache.set(chatId, {
        chatId,
        status: 'in_progress',
        operatorId: operatorId || null,
        localAssignedAt: Date.now(),
      });
    }
  }

  markChatClosed(chatId: number) {
    this.knownSessionStatuses.set(chatId, 'closed');
    const existing = this.latestSessionsCache.get(chatId);
    if (existing) {
      existing.status = 'closed';
      existing.dateClose = new Date().toISOString();
    } else {
      this.latestSessionsCache.set(chatId, {
        chatId,
        status: 'closed',
        dateClose: new Date().toISOString(),
      });
    }
  }

  startAutoSync(intervalMs = 4500) {
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

    // 1. Periodic background sync for all open sessions (4.5s prevents rate limiting)
    this.timer = setInterval(() => {
      this.syncOpenlineSessions(25).catch((err) => {
        console.warn('[OpenlinesSync] Interval sync error:', err.message);
      });
    }, intervalMs);

    // 2. Focused sync for the active chat currently open on the operator screen (2.5s interval)
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
    }, 2500);
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

