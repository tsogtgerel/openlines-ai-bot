import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Star,
  MessageSquare,
  Send,
  Lock,
  Sparkles,
  Zap,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Users,
  Phone,
  Mail,
  MapPin,
  Tag,
  Share2,
  Check,
  ChevronDown,
  X,
  Bot,
  UserCheck,
  ShieldCheck,
  CornerDownRight,
  Plus,
  Radio,
  RefreshCw,
  Unlink,
  Link2,
  ArrowLeft,
  Info,
  RotateCcw,
  Calendar,
  ArrowDown,
} from 'lucide-react';
import { ChatDialog, ChatMessage, Agent, KnowledgeArticle, OpenLineItem, BotConfig } from '../types';
import { QuickRepliesPanel } from './QuickRepliesPanel';

interface OpenChannelChatWorkplaceProps {
  currentAgent: Agent | null;
  team: Agent[];
  openLines: OpenLineItem[];
  articles: KnowledgeArticle[];
  onOpenTeamModal: () => void;
  botConfig?: BotConfig | null;
  onBindLine?: (lineId: number, lineName: string) => Promise<void>;
  onUnbindLine?: (lineId: number) => Promise<void>;
}

export const OpenChannelChatWorkplace: React.FC<OpenChannelChatWorkplaceProps> = ({
  currentAgent,
  team,
  openLines,
  articles,
  onOpenTeamModal,
  botConfig,
  onBindLine,
  onUnbindLine,
}) => {
  // State
  const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [selectedDialog, setSelectedDialog] = useState<ChatDialog | null>(null);
  const [isLoadingDialogs, setIsLoadingDialogs] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'my' | 'my_closed' | 'bot' | 'closed' | 'starred'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'pending_ai' | 'closed_newest' | 'closed_oldest'>('newest');

  // Dedicated Closed Chats Filters
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [resolutionFilter, setResolutionFilter] = useState<string>('all');
  const [closedAgentFilter, setClosedAgentFilter] = useState<string>('all');

  // Input & Messaging
  const [inputText, setInputText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSuggestingAI, setIsSuggestingAI] = useState(false);

  // Popovers & Modals
  const [showQuickRepliesPanel, setShowQuickRepliesPanel] = useState(false);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [showKBModal, setShowKBModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [closeReason, setCloseReason] = useState('Амжилттай шийдвэрлэсэн');

  // Single-click insert quick reply helper
  const handleInsertQuickReply = (text: string) => {
    setInputText((prev) => {
      if (!prev.trim()) return text;
      return `${prev}\n${text}`;
    });
    setIsInternalNote(false);
    setTimeout(() => {
      const textarea = document.getElementById('chat-message-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
      }
    }, 50);
  };

  // Top 1-Click Quick Reply Chips for instant insertion
  const topQuickChips = [
    {
      label: '👋 Мэндчилгээ',
      text: 'Сайн байна уу! БСБ онлайн харилцагчийн үйлчилгээний төвтэй холбогдсонд баярлалаа. Танд ямар бараа, үйлчилгээгээр туслах вэ?',
    },
    {
      label: '⏳ Түр хүлээнэ үү',
      text: 'Би таны асуусан барааны үлдэгдэл болон дэлгэрэнгүй мэдээллийг системээс шалгаж байна. Түр хүлээнэ үү...',
    },
    {
      label: '💳 Дансны дугаар',
      text: 'Хүлээн авагч: "БСБ Электроникс" ХХК\nБанк: ХААН БАНК\nДансны дугаар: 5000000000\nГүйлгээний утга: [Таны утасны дугаар, захиалгын дугаар]',
    },
    {
      label: '🚚 Үнэгүй хүргэлт',
      text: 'Улаанбаатар хот дотор бүх төрлийн цахилгаан бараа, тавилгыг 24-48 цагийн дотор гэрийн хаягаар үнэгүй хүргэж, мэргэжлийн инженерүүд угсарч өгдөг. Орон нутгийн унаанд мөн 24 цагт найдвартай ачуулна.',
    },
    {
      label: '🏦 StorePay 0%',
      text: 'Та ямар ч урьдчилгаа төлбөргүй, 0% хүүтэйгээр StorePay болон PocketZero үйлчилгээгээр 4-өөс 6 хуваан төлөх боломжтой. Би танд шууд төлөлтийн холбоосыг бэлдэж өгөх үү?',
    },
    {
      label: '🙏 Баярлалаа',
      text: 'Биднийг сонгон үйлчлүүлсэн танд баярлалаа. Өдрийг сайхан өнгөрүүлээрэй! Дахин холбогдохдоо сэтгэл хангалуун байх болно.',
    },
  ];

  // Bitrix24 Live Sync & Real-time SSE state
  const [isSyncingBitrix, setIsSyncingBitrix] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isBotActionLoading, setIsBotActionLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const lastSyncVersionRef = useRef<number>(0);

  // Simulation form state
  const [simCustomerName, setSimCustomerName] = useState('Баярмаа Энх');
  const [simMessage, setSimMessage] = useState('Танайд 65 инчийн Samsung зурагт бэлэн байгаа юу, үнэ нь хэд вэ?');
  const [simChannelType, setSimChannelType] = useState<ChatDialog['channelType']>('facebook');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const prevDialogIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const [hasNewMessagesWhileScrolled, setHasNewMessagesWhileScrolled] = useState<boolean>(false);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  // Canned Responses
  const cannedResponses = [
    {
      title: 'Мэндчилгээ & Танилцуулга',
      text: 'Сайн байна уу! БСБ онлайн харилцагчийн үйлчилгээний төвтэй холбогдсонд баярлалаа. Танд ямар бараа, үйлчилгээгээр туслах вэ?',
    },
    {
      title: 'Хүргэлтийн хугацаа & Нөхцөл',
      text: 'Улаанбаатар хот дотор бүх төрлийн цахилгаан бараа, тавилгыг 24-48 цагийн дотор гэрийн хаягаар үнэгүй хүргэж, мэргэжлийн угсрагчид угсарч өгдөг. Орон нутгийн унаанд мөн 24 цагт найдвартай ачуулж байна.',
    },
    {
      title: 'StorePay & PocketZero 0% лизинг',
      text: 'Та ямар ч урьдчилгаа төлбөргүй, 0% хүүтэйгээр StorePay болон PocketZero үйлчилгээгээр 4-өөс 6 хуваан төлөх боломжтой. Би танд шууд төлөлтийн холбоосыг бэлдэж өгөх үү?',
    },
    {
      title: 'Хаан банкны дансны дугаар',
      text: 'Хүлээн авагч: "БСБ Электроникс" ХХК\nБанк: ХААН БАНК\nДансны дугаар: 5000000000\nГүйлгээний утга: [Утасны дугаар, Захиалгын дугаар]',
    },
    {
      title: 'Баталгаат хугацаа & Засвар үйлчилгээ',
      text: 'БСБ-ээс худалдан авсан цахилгаан бараа үйлдвэрийн 1-3 жилийн албан ёсны баталгаатай. Сервис төв: 7722-0222 дугаараар өдөр бүр 09:00-18:00 цагт үйлчилж байна.',
    },
    {
      title: 'Салбар их дэлгүүрүүдийн цагийн хуваарь',
      text: 'БСБ-гийн бүх салбар их дэлгүүрүүд Даваа-Ням гарагт өдөр бүр 10:00 - 20:00 цагийн хооронд завсарлагагүй ажиллаж байна.',
    },
  ];

  // Load all dialogs
  const loadDialogs = async () => {
    try {
      setIsLoadingDialogs(true);
      const params = new URLSearchParams();
      if (channelFilter !== 'all') params.append('channelId', channelFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (currentAgent?.id) params.append('requestingAgentId', currentAgent.id);

      const res = await fetch(`/api/chats?${params.toString()}`).then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        setDialogs(res.data);

        // Auto select first if none selected
        if (!selectedDialogId && res.data.length > 0) {
          setSelectedDialogId(res.data[0].id);
          setSelectedDialog(res.data[0]);
        } else if (selectedDialogId) {
          const matched = res.data.find((d: ChatDialog) => d.id === selectedDialogId);
          if (matched) setSelectedDialog(matched);
        }
      }
    } catch (e) {
      console.error('Failed to load dialogs:', e);
    } finally {
      setIsLoadingDialogs(false);
    }
  };

  // Background delta sync for live chat updates without transferring full payloads
  const loadDialogsDelta = async () => {
    try {
      const params = new URLSearchParams();
      params.append('since', String(lastSyncVersionRef.current));
      if (channelFilter !== 'all') params.append('channelId', channelFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (currentAgent?.id) params.append('requestingAgentId', currentAgent.id);

      const res = await fetch(`/api/chats/delta?${params.toString()}`).then((r) => r.json());
      if (res.success && res.data) {
        const { version, hasChanges, dialogs: changedDialogs } = res.data;
        if (typeof version === 'number') {
          lastSyncVersionRef.current = version;
        }

        if (hasChanges && Array.isArray(changedDialogs) && changedDialogs.length > 0) {
          setDialogs((prev) => {
            const map = new Map<string, ChatDialog>(prev.map((d) => [d.id, d]));
            for (const item of changedDialogs) {
              map.set(item.id, item);
            }
            const updated = Array.from(map.values());
            if (sortBy === 'newest') {
              updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
            }
            return updated;
          });

          if (selectedDialogId) {
            const matched = changedDialogs.find((d: ChatDialog) => d.id === selectedDialogId);
            if (matched) {
              setSelectedDialog((prev) => {
                if (!prev || prev.id !== matched.id) return matched;
                if (
                  prev.messages.length !== matched.messages.length ||
                  prev.status !== matched.status ||
                  prev.unreadCount !== matched.unreadCount ||
                  prev.assignedAgentId !== matched.assignedAgentId ||
                  prev.lastMessageTime !== matched.lastMessageTime
                ) {
                  return matched;
                }
                return prev;
              });
            }
          }
        }
      }
    } catch {
      // ignore silent poll failure
    }
  };

  // Manual trigger to force-sync latest open line sessions from Bitrix24
  const handleSyncBitrix = async () => {
    try {
      setIsSyncingBitrix(true);
      setSyncStatusMsg('Битрикс24-өөс шинэ чатуудыг татаж байна...');
      const res = await fetch('/api/chats/sync', { method: 'POST' }).then((r) => r.json());
      if (res.success && res.data) {
        if (Array.isArray(res.data.dialogs)) {
          setDialogs(res.data.dialogs);
          if (!selectedDialogId && res.data.dialogs.length > 0) {
            setSelectedDialogId(res.data.dialogs[0].id);
            setSelectedDialog(res.data.dialogs[0]);
          } else if (selectedDialogId) {
            const matched = res.data.dialogs.find((d: ChatDialog) => d.id === selectedDialogId);
            if (matched) setSelectedDialog(matched);
          }
        }
        const updated = res.data.updated ?? 0;
        const total = res.data.count ?? res.data.dialogs?.length ?? 0;
        setSyncStatusMsg(`Амжилттай: ${total} сешн шалгагдаж, ${updated} чат шинэчлэгдлээ.`);
      } else {
        setSyncStatusMsg(`Синк алдаа: ${res.error?.message || 'Серверээс мэдээлэл ирсэнгүй'}`);
      }
    } catch (e: any) {
      setSyncStatusMsg(`Холболтын алдаа: ${e.message}`);
    } finally {
      setIsSyncingBitrix(false);
      setTimeout(() => setSyncStatusMsg(null), 4500);
    }
  };

  // 1. Initial Load when filters or sorting change
  useEffect(() => {
    loadDialogs();
  }, [channelFilter, sortBy]);

  // 2. Real-time Server-Sent Events (SSE) Stream
  // Instantly delivers customer messages in <50ms without waiting for polling loops
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentAgent?.id) params.append('requestingAgentId', currentAgent.id);

    let eventSource: EventSource | null = null;
    let isCleanedUp = false;

    try {
      eventSource = new EventSource(`/api/chats/stream?${params.toString()}`);

      eventSource.onopen = () => {
        if (!isCleanedUp) setIsRealtimeConnected(true);
      };

      eventSource.addEventListener('connected', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.version) lastSyncVersionRef.current = data.version;
          if (!isCleanedUp) setIsRealtimeConnected(true);
        } catch {}
      });

      eventSource.addEventListener('message:new', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.version) lastSyncVersionRef.current = payload.version;
          const { dialogId, message, dialog: updatedDialog } = payload;
          if (!dialogId && !updatedDialog) return;

          const targetId = dialogId || updatedDialog?.id;

          // Immediately update open conversation if it matches
          setSelectedDialog((prev) => {
            if (!prev) return prev;
            if (prev.id !== targetId && prev.dialogId !== targetId) return prev;

            const messageAlreadyPresent = prev.messages.some(
              (m) =>
                m.id === message?.id ||
                (message?.text && m.text === message.text && Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
            );

            if (messageAlreadyPresent) {
              return updatedDialog ? { ...prev, ...updatedDialog } : prev;
            }

            const newMessages = message ? [...prev.messages, message] : prev.messages;
            return {
              ...prev,
              ...(updatedDialog || {}),
              messages: newMessages,
              lastMessageText: message?.text || prev.lastMessageText,
              lastMessageTime: message?.timestamp || prev.lastMessageTime,
              lastMessageSender: message?.sender || prev.lastMessageSender,
              unreadCount: 0,
            };
          });

          // Reflect immediately in the dialogs list
          setDialogs((prev) => {
            const index = prev.findIndex((d) => d.id === targetId || d.dialogId === targetId);
            if (index >= 0) {
              const updatedList = [...prev];
              const current = updatedList[index];
              const isCurrentSelected = selectedDialogId === current.id;

              const updatedItem: ChatDialog = {
                ...current,
                ...(updatedDialog || {}),
                lastMessageText: message?.text || current.lastMessageText,
                lastMessageTime: message?.timestamp || current.lastMessageTime,
                lastMessageSender: message?.sender || current.lastMessageSender,
                unreadCount: isCurrentSelected ? 0 : (updatedDialog?.unreadCount ?? (current.unreadCount + 1)),
              };

              updatedList[index] = updatedItem;

              if (sortBy === 'newest') {
                const [item] = updatedList.splice(index, 1);
                updatedList.unshift(item);
              }
              return updatedList;
            } else if (updatedDialog) {
              return [updatedDialog, ...prev];
            }
            return prev;
          });
        } catch (err) {
          console.error('Failed to parse message:new SSE event', err);
        }
      });

      eventSource.addEventListener('dialog:update', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.version) lastSyncVersionRef.current = payload.version;
          const { dialogId, dialog: updatedDialog } = payload;
          if (!dialogId && !updatedDialog) return;

          const targetId = dialogId || updatedDialog?.id;

          setSelectedDialog((prev) => {
            if (!prev) return prev;
            if (prev.id === targetId || prev.dialogId === targetId) {
              return updatedDialog ? { ...prev, ...updatedDialog } : prev;
            }
            return prev;
          });

          setDialogs((prev) =>
            prev.map((d) => {
              if (d.id === targetId || d.dialogId === targetId) {
                return updatedDialog ? { ...d, ...updatedDialog } : d;
              }
              return d;
            })
          );
        } catch (err) {
          console.error('Failed to parse dialog:update SSE event', err);
        }
      });

      eventSource.onerror = () => {
        if (!isCleanedUp) {
          setIsRealtimeConnected(false);
        }
      };
    } catch {
      setIsRealtimeConnected(false);
    }

    return () => {
      isCleanedUp = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentAgent?.id, selectedDialogId, sortBy]);

  // 3. Adaptive Background Delta Sync
  // Runs gently every 15s when SSE is active as reconciliation, or every 2.5s if SSE disconnects
  useEffect(() => {
    const pollInterval = isRealtimeConnected ? 15000 : 2500;
    const timer = setInterval(() => {
      loadDialogsDelta();
    }, pollInterval);
    return () => clearInterval(timer);
  }, [channelFilter, sortBy, isRealtimeConnected]);

  // 4. Prioritize active chat on server and fetch immediate state once on chat switch
  useEffect(() => {
    if (!selectedDialogId) return;

    // Notify backend about active chat for prioritized background polling
    fetch('/api/chats/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: selectedDialogId }),
    }).catch(() => {});

    // Instant one-off sync on opening a chat to ensure message freshness
    fetch(`/api/chats/${selectedDialogId}/sync`, { method: 'POST' })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const freshDialog: ChatDialog = json.data;
          setSelectedDialog((prev) => (prev && prev.id === freshDialog.id ? freshDialog : prev));
          setDialogs((prev) =>
            prev.map((d) => (d.id === freshDialog.id ? { ...d, ...freshDialog } : d))
          );
        }
      })
      .catch(() => {});
  }, [selectedDialogId]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      loadDialogs();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Scroll helper to snap to the bottom of the active conversation thread
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setHasNewMessagesWhileScrolled(false);
  };

  // Monitor user scrolling to detect if user has scrolled up to review previous history
  const handleScrollMessages = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Threshold of 120px to consider the user "at the bottom"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= 120;

    isNearBottomRef.current = isAtBottom;
    setShowScrollBottomBtn(!isAtBottom);

    if (isAtBottom) {
      setHasNewMessagesWhileScrolled(false);
    }
  };

  // Scroll messages container:
  // - Snaps to bottom on dialog switch
  // - Automatically snaps to bottom when a new message arrives IF the agent is near bottom
  // - Preserves scroll position if agent scrolled up to review previous history, and shows a badge/button
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const currentMsgCount = selectedDialog?.messages?.length || 0;
    const isDifferentDialog = prevDialogIdRef.current !== selectedDialog?.id;
    const hasNewMessages = currentMsgCount > prevMessageCountRef.current;

    prevDialogIdRef.current = selectedDialog?.id || null;
    prevMessageCountRef.current = currentMsgCount;

    if (isDifferentDialog) {
      // Switched to a new or different conversation: always snap immediately to bottom
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setHasNewMessagesWhileScrolled(false);
      setTimeout(() => {
        scrollToBottom('auto');
      }, 50);
    } else if (hasNewMessages) {
      // New message arrived in current thread
      if (isNearBottomRef.current) {
        // Agent is at or near the bottom: automatically snap down smoothly
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 50);
      } else {
        // Agent is scrolled up reviewing history: DO NOT disrupt their scroll position!
        // Show indicator that new messages have arrived below
        setHasNewMessagesWhileScrolled(true);
        setShowScrollBottomBtn(true);
      }
    }
  }, [selectedDialog?.id, selectedDialog?.messages?.length]);

  // Select a dialog and mark as read
  const handleSelectDialog = async (dialog: ChatDialog) => {
    setSelectedDialogId(dialog.id);
    setSelectedDialog(dialog);
    setMobileView('chat');

    if (dialog.unreadCount > 0) {
      try {
        await fetch(`/api/chats/${dialog.id}/read`, { method: 'POST' });
        setDialogs((prev) =>
          prev.map((d) => (d.id === dialog.id ? { ...d, unreadCount: 0 } : d))
        );
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    }
  };

  // Send message or note
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedDialog) return;

    // Check assignment requirement before sending
    const isAssignedToMe = isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent);
    if (!isAssignedToMe && selectedDialog.status !== 'closed') {
      setSendErrorMessage('Та энэ чатыг эхлээд "Өөртөө авах" товчоор өөртөө оноож байж хариу бичнэ үү.');
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');
    setSendErrorMessage(null);
    setIsSending(true);

    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          sender: 'agent',
          senderName: currentAgent?.name || 'Оператор',
          senderAvatar: currentAgent?.avatar,
          senderAgentId: currentAgent?.id,
          isInternalNote,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        setSelectedDialog(res.data.dialog);
        setDialogs((prev) =>
          prev.map((d) => (d.id === res.data.dialog.id ? res.data.dialog : d))
        );
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 50);
      } else if (!res.success) {
        const errorMsg = res.error?.message || 'Мессеж илгээхэд алдаа гарлаа';
        setSendErrorMessage(errorMsg);
        setInputText(textToSend);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendErrorMessage('Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.');
      setInputText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  // Assign to current agent
  const handleTakeDialog = async () => {
    if (!selectedDialog || !currentAgent) return;
    setSendErrorMessage(null);
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAgentId: currentAgent.id,
          assignedAgentName: currentAgent.name,
          assignedAgentAvatar: currentAgent.avatar,
          status: 'in_progress',
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      }
    } catch (e) {
      console.error('Failed to take dialog:', e);
    }
  };

  // Transfer to another agent
  const handleTransfer = async (targetAgent: Agent) => {
    if (!selectedDialog) return;
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAgentId: targetAgent.id,
          targetAgentName: targetAgent.name,
          targetAgentAvatar: targetAgent.avatar,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
        setShowTransferModal(false);
      }
    } catch (e) {
      console.error('Failed to transfer dialog:', e);
    }
  };

  // Close / Resolve dialog
  const handleCloseDialog = async () => {
    if (!selectedDialog) return;
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionSummary: closeReason,
          closedByAgentId: currentAgent?.id,
          closedByAgentName: currentAgent?.name,
          closedByAgentAvatar: currentAgent?.avatar,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
        setShowCloseModal(false);
      }
    } catch (e) {
      console.error('Failed to close dialog:', e);
    }
  };

  // Reopen dialog
  const handleReopenDialog = async () => {
    if (!selectedDialog) return;
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/reopen`, { method: 'POST' }).then((r) => r.json());
      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      }
    } catch (e) {
      console.error('Failed to reopen dialog:', e);
    }
  };

  // Toggle Star
  const handleToggleStar = async (dialogId: string, currentStarred: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${dialogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !currentStarred }),
      }).then((r) => r.json());

      if (res.success) {
        setDialogs((prev) => prev.map((d) => (d.id === dialogId ? { ...d, isStarred: !currentStarred } : d)));
        if (selectedDialog?.id === dialogId) {
          setSelectedDialog((prev) => (prev ? { ...prev, isStarred: !currentStarred } : null));
        }
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  // AI Suggestion based on customer last message
  const handleAISuggest = async () => {
    if (!selectedDialog) return;
    const lastCustomerMsg = [...selectedDialog.messages].reverse().find((m) => m.sender === 'customer');
    const queryText = lastCustomerMsg?.text || selectedDialog.lastMessageText;

    try {
      setIsSuggestingAI(true);
      const res = await fetch('/api/chats/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      }).then((r) => r.json());

      if (res.success && res.data?.suggestion) {
        setInputText(res.data.suggestion);
        setIsInternalNote(false);
      }
    } catch (err) {
      console.error('Failed to get AI suggestion:', err);
    } finally {
      setIsSuggestingAI(false);
    }
  };

  // Simulate Incoming Customer Query
  const handleSimulateIncoming = async () => {
    if (!simCustomerName || !simMessage) return;
    try {
      const lineObj = openLines?.find((l) => l.name.toLowerCase().includes(simChannelType)) || openLines?.[0];
      const res = await fetch('/api/chats/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: simCustomerName,
          message: simMessage,
          channelType: simChannelType,
          channelName: lineObj ? lineObj.name : `БСБ - ${simChannelType.toUpperCase()}`,
          channelId: lineObj ? lineObj.id : 39,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        setDialogs((prev) => [res.data, ...prev]);
        setSelectedDialogId(res.data.id);
        setSelectedDialog(res.data);
        setShowSimulateModal(false);
      }
    } catch (err) {
      console.error('Failed to simulate customer message:', err);
    }
  };

  // Helper to match agent by id or bitrix ID or name
  const isAgentMatch = (
    dialogAgentId?: string | null,
    dialogAgentName?: string | null,
    targetAgent?: Agent | null
  ): boolean => {
    if (!targetAgent) return false;
    const tId = String(targetAgent.id);
    const tBxId = targetAgent.bitrixUserId ? String(targetAgent.bitrixUserId) : null;
    const tName = targetAgent.name?.toLowerCase().trim();

    if (dialogAgentId) {
      const dId = String(dialogAgentId);
      if (dId === tId) return true;
      if (tBxId && (dId === tBxId || dId === `bx-${tBxId}`)) return true;
      if (tId.startsWith('bx-') && dId === tId.replace('bx-', '')) return true;
      if (dId.startsWith('bx-') && dId.replace('bx-', '') === tId) return true;
    }

    if (dialogAgentName && tName) {
      const dName = dialogAgentName.toLowerCase().trim();
      if (dName === tName) return true;
      const tFirst = tName.split(' ')[0];
      const dFirst = dName.split(' ')[0];
      if (tFirst && dFirst && tFirst.length > 2 && dFirst.length > 2 && tFirst === dFirst) {
        return true;
      }
    }

    return false;
  };

  // Helper to check if a closed or assigned dialog belongs to the current agent
  const isMyClosedDialog = (dialog: ChatDialog, agent: Agent | null): boolean => {
    if (!agent) return false;
    return (
      isAgentMatch(dialog.closedByAgentId, dialog.closedByAgentName, agent) ||
      isAgentMatch(dialog.assignedAgentId, dialog.assignedAgentName, agent)
    );
  };

  const isDateInRange = (dateStr?: string | null, range?: 'all' | 'today' | '7days' | '30days'): boolean => {
    if (!range || range === 'all') return true;
    if (!dateStr) return false;
    const date = new Date(dateStr).getTime();
    if (isNaN(date)) return false;
    const now = Date.now();
    const diffMs = now - date;

    if (range === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return date >= startOfToday.getTime();
    }
    if (range === '7days') {
      return diffMs <= 7 * 24 * 3600 * 1000;
    }
    if (range === '30days') {
      return diffMs <= 30 * 24 * 3600 * 1000;
    }
    return true;
  };

  const matchesResolution = (summary?: string | null, filter?: string): boolean => {
    if (!filter || filter === 'all') return true;
    if (!summary) return false;
    return summary.toLowerCase().includes(filter.toLowerCase());
  };

  // Filter accessible openlines based on currentAgent permissions
  const accessibleOpenLines = useMemo(() => {
    if (!currentAgent) return openLines;
    if (currentAgent.accessRole !== 'agent' || currentAgent.canAccessAllChannels) {
      return openLines;
    }
    const assigned = currentAgent.assignedChannelIds || [];
    return openLines.filter((l) => assigned.some((id) => String(id) === String(l.id)));
  }, [openLines, currentAgent]);

  // Filtered & Sorted Dialogs
  // Filters active chats by customer name, channel (name/type), or message content
  // Sorts conversations by 'Newest', 'Oldest', 'Pending AI Action', 'Closed Newest', 'Closed Oldest'
  const filteredDialogs = useMemo(() => {
    let result = dialogs.filter((d) => {
      if (statusFilter === 'new') return d.status === 'new';
      if (statusFilter === 'my') {
        return d.status !== 'closed' && (d.assignedAgentId === currentAgent?.id || isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent));
      }
      if (statusFilter === 'my_closed') return d.status === 'closed' && isMyClosedDialog(d, currentAgent);
      if (statusFilter === 'bot') return d.status === 'bot';
      if (statusFilter === 'closed') return d.status === 'closed';
      if (statusFilter === 'starred') return Boolean(d.isStarred);
      return true;
    });

    // Strict Role-Based Security: Agent can ONLY see assigned channels, unassigned chats, and their own chats
    if (currentAgent?.accessRole === 'agent') {
      // 1. Channel isolation: Agent only sees chats from assigned channels
      if (!currentAgent.canAccessAllChannels && Array.isArray(currentAgent.assignedChannelIds)) {
        const allowedChannelIds = currentAgent.assignedChannelIds.map(String);
        result = result.filter((d) => allowedChannelIds.includes(String(d.channelId)));
      }

      // 2. Chat isolation: Only unassigned (new queue) or assigned to this agent
      result = result.filter((d) => {
        const isUnassigned = !d.assignedAgentId || d.status === 'new' || d.assignedAgentId === 'unassigned';
        const isMine =
          d.assignedAgentId === currentAgent.id ||
          isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent) ||
          isMyClosedDialog(d, currentAgent);
        return isUnassigned || isMine;
      });
    }

    if (channelFilter !== 'all') {
      result = result.filter((d) => String(d.channelId) === String(channelFilter));
    }

    // Closed chat specific filters (date range, resolution reason, closed operator)
    if (statusFilter === 'my_closed' || statusFilter === 'closed') {
      if (dateRangeFilter !== 'all') {
        result = result.filter((d) => isDateInRange(d.closedAt || d.lastMessageTime, dateRangeFilter));
      }
      if (resolutionFilter !== 'all') {
        result = result.filter((d) => matchesResolution(d.resolutionSummary, resolutionFilter));
      }
      if (statusFilter === 'closed' && closedAgentFilter !== 'all') {
        const targetTeamAgent = team.find((a) => a.id === closedAgentFilter);
        result = result.filter((d) =>
          targetTeamAgent
            ? isAgentMatch(d.closedByAgentId, d.closedByAgentName, targetTeamAgent) || isAgentMatch(d.assignedAgentId, d.assignedAgentName, targetTeamAgent)
            : d.closedByAgentId === closedAgentFilter
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        // Customer name & phone & lead ID
        const matchesCustomer =
          d.customer.name.toLowerCase().includes(q) ||
          Boolean(d.customer.phone && d.customer.phone.includes(q)) ||
          Boolean(d.customer.crmLeadId && d.customer.crmLeadId.toLowerCase().includes(q));
        // Channel name & channel type
        const matchesChannel =
          d.channelName.toLowerCase().includes(q) ||
          d.channelType.toLowerCase().includes(q);
        // Message content (last message preview or any past message in history)
        const matchesMessage =
          d.lastMessageText.toLowerCase().includes(q) ||
          d.messages.some((m) => m.text.toLowerCase().includes(q));
        // Resolution summary
        const matchesResolutionText = Boolean(d.resolutionSummary && d.resolutionSummary.toLowerCase().includes(q));
        // Closed agent name or assigned agent name
        const matchesAgentName =
          Boolean(d.closedByAgentName && d.closedByAgentName.toLowerCase().includes(q)) ||
          Boolean(d.assignedAgentName && d.assignedAgentName.toLowerCase().includes(q));
        // Dialog ID
        const matchesId = d.id.toLowerCase().includes(q);

        return matchesCustomer || matchesChannel || matchesMessage || matchesResolutionText || matchesAgentName || matchesId;
      });
    }

    // Sort conversations by 'Newest', 'Oldest', 'Pending AI Action', 'Closed Newest', 'Closed Oldest'
    result.sort((a, b) => {
      if (sortBy === 'closed_newest') {
        const timeA = new Date(a.closedAt || a.lastMessageTime).getTime();
        const timeB = new Date(b.closedAt || b.lastMessageTime).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'closed_oldest') {
        const timeA = new Date(a.closedAt || a.lastMessageTime).getTime();
        const timeB = new Date(b.closedAt || b.lastMessageTime).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'oldest') {
        return new Date(a.lastMessageTime).getTime() - new Date(b.lastMessageTime).getTime();
      }
      if (sortBy === 'pending_ai') {
        const aPending = a.status === 'bot' || (a.status !== 'closed' && (a.lastMessageSender === 'customer' || a.status === 'new'));
        const bPending = b.status === 'bot' || (b.status !== 'closed' && (b.lastMessageSender === 'customer' || b.status === 'new'));
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      // Default: 'newest'
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return result;
  }, [dialogs, statusFilter, channelFilter, searchQuery, sortBy, dateRangeFilter, resolutionFilter, closedAgentFilter, currentAgent?.id, team]);

  // Auto-switch selected dialog when filter changes and current selection is not visible
  useEffect(() => {
    if (filteredDialogs.length > 0) {
      const isCurrentInFiltered = filteredDialogs.some((d) => d.id === selectedDialogId);
      if (!isCurrentInFiltered) {
        setSelectedDialogId(filteredDialogs[0].id);
        setSelectedDialog(filteredDialogs[0]);
      }
    }
  }, [statusFilter, channelFilter, sortBy, searchQuery, filteredDialogs.length]);

  // Channel badge styling helper
  const getChannelBadge = (type: ChatDialog['channelType']) => {
    switch (type) {
      case 'facebook':
        return { label: 'Facebook', bg: 'bg-blue-600 text-white', dot: 'bg-blue-500' };
      case 'instagram':
        return { label: 'Instagram', bg: 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white', dot: 'bg-pink-500' };
      case 'telegram':
        return { label: 'Telegram', bg: 'bg-sky-500 text-white', dot: 'bg-sky-400' };
      case 'whatsapp':
        return { label: 'WhatsApp', bg: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' };
      case 'webchat':
      default:
        return { label: 'Live Web Chat', bg: 'bg-indigo-600 text-white', dot: 'bg-indigo-400' };
    }
  };

  const getStatusBadge = (status: ChatDialog['status']) => {
    switch (status) {
      case 'new':
        return { label: 'Дараалалд (Шинэ)', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'assigned':
        return { label: 'Шилжсэн', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'in_progress':
        return { label: 'Хариуцаж буй', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'bot':
        return { label: 'AI хариулж буй', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'closed':
        return { label: 'Хаагдсан', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return 'Саяхан';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин өмнө`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} цаг өмнө`;
    return new Date(isoDate).toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  };

  const unassignedCount = dialogs.filter((d) => d.status === 'new').length;
  const myActiveCount = dialogs.filter(
    (d) =>
      d.status !== 'closed' &&
      (d.assignedAgentId === currentAgent?.id || isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent))
  ).length;
  const myClosedCount = dialogs.filter((d) => d.status === 'closed' && isMyClosedDialog(d, currentAgent)).length;
  const botCount = dialogs.filter((d) => d.status === 'bot').length;
  const allClosedCount = dialogs.filter((d) => d.status === 'closed').length;
  const starredCount = dialogs.filter((d) => Boolean(d.isStarred)).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-2xl shadow-none sm:shadow-sm overflow-hidden m-0 sm:m-3 lg:m-4">
      {/* 3-Column Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 h-full overflow-hidden">
        {/* ========================================================
            COLUMN 1: CHATS LIST & FILTERS (Left)
           ======================================================== */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 border-r border-slate-200 flex-col bg-slate-50/50 shrink-0 min-h-0 h-full overflow-hidden`}>
          {/* Top Bar: Title & New Simulation */}
          <div className="p-2.5 sm:p-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
              <h2 className="font-bold text-slate-900 text-xs sm:text-sm truncate">Бүх сувгийн чат</h2>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-semibold shrink-0">
                {dialogs.length}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                  isRealtimeConnected
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
                title={
                  isRealtimeConnected
                    ? 'Бодит цагийн шуурхай холболт идэвхтэй (SSE <50ms сааталгүй)'
                    : 'Холболтыг сэргээж байна (Delta fallback идэвхтэй)'
                }
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isRealtimeConnected ? 'Real-time' : 'Delta sync'}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                id="sync-bitrix-chats-btn"
                onClick={handleSyncBitrix}
                disabled={isSyncingBitrix}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition disabled:opacity-50"
                title="Битрикс24 нээлттэй сувгуудаас шууд шинэчлэн татах"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBitrix ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncingBitrix ? 'Синк...' : 'Битрикс24 синк'}</span>
                <span className="sm:hidden">{isSyncingBitrix ? '...' : 'Синк'}</span>
              </button>
              <button
                id="simulate-customer-chat-btn"
                onClick={() => setShowSimulateModal(true)}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition"
                title="Туршилтын шинэ хэрэглэгчийн чат илгээх"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Шинэ тест чат</span>
                <span className="sm:hidden">Тест</span>
              </button>
            </div>
          </div>

          {/* Sync status alert if present */}
          {syncStatusMsg && (
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-200 text-blue-800 text-[11px] font-medium flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-blue-600 animate-pulse" />
                <span>{syncStatusMsg}</span>
              </div>
              <button
                onClick={() => setSyncStatusMsg(null)}
                className="text-blue-500 hover:text-blue-700 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="search-chats-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Харилцагчийн нэр, суваг, мессеж хайх..."
                className="w-full pl-9 pr-7 py-1.5 rounded-lg bg-slate-100 border border-transparent focus:border-blue-500 focus:bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition"
                title="Харилцагчийн нэр, суваг, эсвэл мессежийн агуулгаар шүүх"
              />
              {searchQuery && (
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  title="Хайлт цэвэрлэх"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Active search filter feedback */}
            {searchQuery.trim() && (
              <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200/60">
                <span className="truncate">
                  Хайлт: <strong className="text-slate-900 font-semibold truncate">"{searchQuery.trim()}"</strong>
                </span>
                <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-blue-100">
                  {filteredDialogs.length} чат
                </span>
              </div>
            )}

            {/* Channel filter & Sorting Dropdowns */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <div>
                <select
                  id="filter-channel-select"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full text-[11px] font-medium py-1.5 px-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 truncate"
                  title="Сувгаар шүүх"
                >
                  <option value="all">
                    {currentAgent?.accessRole === 'agent' && !currentAgent.canAccessAllChannels
                      ? `Оноогдсон бүх суваг (${accessibleOpenLines.length})`
                      : 'Бүх суваг'}
                  </option>
                  {accessibleOpenLines.map((line) => {
                    const opsCount = line.operatorsCount ?? line.assignedAgents?.length ?? 0;
                    return (
                      <option key={line.id} value={line.id}>
                        {line.name} {opsCount > 0 ? `(${opsCount} агент)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <select
                  id="sort-chats-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-[11px] font-medium py-1.5 px-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 truncate"
                  title="Чатуудыг эрэмбэлэх: Newest, Oldest, Pending AI Action, Closed Newest, Closed Oldest"
                >
                  <option value="newest">Сүүлийн мессеж (Newest)</option>
                  <option value="closed_newest">Сүүлд хаагдсанаар (Closed Newest)</option>
                  <option value="closed_oldest">Эхэнд хаагдсанаар (Closed Oldest)</option>
                  <option value="oldest">Эхний мессеж (Oldest)</option>
                  <option value="pending_ai">Pending AI Action</option>
                </select>
              </div>
            </div>

            {/* Quick Channel Chips */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px]">
              {botConfig?.selectedLineId && (
                <button
                  type="button"
                  id="filter-bot-channel-quick-btn"
                  onClick={() => setChannelFilter(String(botConfig.selectedLineId))}
                  className={`px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 shrink-0 transition ${
                    String(channelFilter) === String(botConfig.selectedLineId)
                      ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-2xs font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Зөвхөн бот холбогдсон сувгийн чатуудыг харах"
                >
                  <Bot className="w-3 h-3 text-purple-600" />
                  <span>Бот: {botConfig.selectedLineName ? botConfig.selectedLineName.slice(0, 18) : `#${botConfig.selectedLineId}`}</span>
                </button>
              )}

              {channelFilter !== 'all' && (
                <button
                  type="button"
                  id="filter-all-channels-quick-btn"
                  onClick={() => setChannelFilter('all')}
                  className="px-2 py-0.5 rounded-full font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 shrink-0"
                >
                  Бүх суваг
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap text-[11px]">
            <button
              id="tab-all-chats-btn"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Бүгд ({dialogs.length})
            </button>
            <button
              id="tab-queue-chats-btn"
              onClick={() => setStatusFilter('new')}
              className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 flex items-center gap-1 ${
                statusFilter === 'new'
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Дараалал ({unassignedCount})</span>
            </button>
            <button
              id="tab-my-chats-btn"
              onClick={() => setStatusFilter('my')}
              className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 flex items-center gap-1 ${
                statusFilter === 'my'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <span>Минийх ({myActiveCount})</span>
            </button>
            <button
              id="tab-my-closed-chats-btn"
              onClick={() => {
                setStatusFilter('my_closed');
                setSortBy('closed_newest');
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'my_closed'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
              }`}
              title="Таны хаасан чатууд"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100" />
              <span>Миний хаасан ({myClosedCount})</span>
            </button>
            <button
              id="tab-bot-chats-btn"
              onClick={() => setStatusFilter('bot')}
              className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 flex items-center gap-1 ${
                statusFilter === 'bot'
                  ? 'bg-purple-600 text-white shadow-2xs font-semibold'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
              }`}
              title="AI Ботын хариулж буй болон хариулсан чатууд"
            >
              <Bot className="w-3 h-3" />
              <span>AI Бот ({botCount})</span>
            </button>
            {currentAgent?.accessRole !== 'agent' && (
              <button
                id="tab-closed-chats-btn"
                onClick={() => {
                  setStatusFilter('closed');
                  setSortBy('closed_newest');
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition shrink-0 ${
                  statusFilter === 'closed'
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Бүх хаагдсан ({allClosedCount})
              </button>
            )}
            <button
              id="tab-starred-chats-btn"
              onClick={() => setStatusFilter('starred')}
              className={`p-1.5 rounded-md transition shrink-0 ${
                statusFilter === 'starred'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-amber-500 hover:bg-amber-50'
              }`}
              title="Чухал тэмдэглэсэн"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          {/* Dedicated Closed Chats Filters Bar */}
          {(statusFilter === 'my_closed' || statusFilter === 'closed') && (
            <div className="p-2.5 bg-emerald-50/70 border-b border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-900">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {statusFilter === 'my_closed'
                      ? `Миний хаасан чатууд (${filteredDialogs.length})`
                      : `Бүх хаагдсан түүх (${filteredDialogs.length})`}
                  </span>
                </div>
                {statusFilter === 'my_closed' && currentAgent && (
                  <span className="text-[10px] font-normal text-emerald-700 bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                    Оператор: {currentAgent.name}
                  </span>
                )}
              </div>

              {/* Sub-filters grid: Date range, Resolution reason, Operator */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {/* Date range filter */}
                <div>
                  <label className="text-[10px] font-medium text-emerald-800 block mb-0.5">Огноо:</label>
                  <select
                    id="filter-closed-date-select"
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value as any)}
                    className="w-full py-1 px-1.5 rounded-md bg-white border border-emerald-200 text-slate-700 focus:outline-none focus:border-emerald-500 text-[11px]"
                  >
                    <option value="all">Бүх хугацаа</option>
                    <option value="today">Өнөөдөр</option>
                    <option value="7days">Сүүлийн 7 хоног</option>
                    <option value="30days">Сүүлийн 30 хоног</option>
                  </select>
                </div>

                {/* Resolution reason filter */}
                <div>
                  <label className="text-[10px] font-medium text-emerald-800 block mb-0.5">Шийдвэрлэлт:</label>
                  <select
                    id="filter-closed-reason-select"
                    value={resolutionFilter}
                    onChange={(e) => setResolutionFilter(e.target.value)}
                    className="w-full py-1 px-1.5 rounded-md bg-white border border-emerald-200 text-slate-700 focus:outline-none focus:border-emerald-500 text-[11px] truncate"
                  >
                    <option value="all">Бүх шийдвэрлэлт</option>
                    <option value="StorePay">StorePay / Лизинг</option>
                    <option value="Баталгаат">Баталгаа / Сервис</option>
                    <option value="Хүргэлт">Хүргэлт / Угсралт</option>
                    <option value="НӨАТ">И-Баримт / НӨАТ</option>
                    <option value="үлдэгдэл">Барааны үлдэгдэл</option>
                    <option value="буцаалт">Солих / Буцаалт</option>
                  </select>
                </div>

                {/* If statusFilter === 'closed', allow filtering by specific operator */}
                {statusFilter === 'closed' && (
                  <div className="col-span-2 pt-0.5">
                    <label className="text-[10px] font-medium text-emerald-800 block mb-0.5">Хаасан оператор:</label>
                    <select
                      id="filter-closed-operator-select"
                      value={closedAgentFilter}
                      onChange={(e) => setClosedAgentFilter(e.target.value)}
                      className="w-full py-1 px-1.5 rounded-md bg-white border border-emerald-200 text-slate-700 focus:outline-none focus:border-emerald-500 text-[11px] truncate"
                    >
                      <option value="all">Бүх операторууд</option>
                      {currentAgent && (
                        <option value={currentAgent.id}>★ Зөвхөн минийх ({currentAgent.name})</option>
                      )}
                      {team.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name} ({ag.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Reset button if any active filter */}
              {(dateRangeFilter !== 'all' || resolutionFilter !== 'all' || (statusFilter === 'closed' && closedAgentFilter !== 'all')) && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    id="reset-closed-filters-btn"
                    onClick={() => {
                      setDateRangeFilter('all');
                      setResolutionFilter('all');
                      setClosedAgentFilter('all');
                    }}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Шүүлтүүрүүдийг арилгах</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dialogs List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {isLoadingDialogs ? (
              <div className="py-12 text-center text-xs text-slate-400">Чатуудыг ачаалж байна...</div>
            ) : filteredDialogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 px-4 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Шүүлтүүрт тохирох чат олдсонгүй.</p>
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setChannelFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-blue-600 font-semibold text-xs hover:underline"
                >
                  Шүүлтүүрийг цэвэрлэх
                </button>
              </div>
            ) : (
              filteredDialogs.map((d) => {
                const isSelected = d.id === selectedDialogId;
                const channelBadge = getChannelBadge(d.channelType);
                const statusBadge = getStatusBadge(d.status);

                return (
                  <div
                    key={d.id}
                    id={`chat-item-${d.id}`}
                    onClick={() => handleSelectDialog(d)}
                    className={`p-3.5 cursor-pointer transition relative text-left ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-100/70 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {d.customer.avatar ? (
                            <img
                              src={d.customer.avatar}
                              alt={d.customer.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                              {d.customer.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${channelBadge.dot}`}
                            title={channelBadge.label}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-xs truncate max-w-[130px]">
                              {d.customer.name}
                            </span>
                            {d.customer.tags?.includes('VIP') && (
                              <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                                VIP
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {d.channelName}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTimeAgo(d.lastMessageTime)}
                        </span>
                        <button
                          onClick={(e) => handleToggleStar(d.id, Boolean(d.isStarred), e)}
                          className={`p-0.5 transition ${
                            d.isStarred ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${d.isStarred ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Last message preview */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate flex-1 ${
                          d.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {d.lastMessageSender === 'agent' && (
                          <span className="text-blue-600 font-medium">Та: </span>
                        )}
                        {d.lastMessageSender === 'bot' && (
                          <span className="text-purple-600 font-medium">Бот: </span>
                        )}
                        {d.lastMessageText}
                      </p>

                      {d.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px]">
                          {d.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Resolution snippet if closed */}
                    {d.status === 'closed' && d.resolutionSummary && (
                      <div className="mt-1.5 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-md px-2 py-1 flex items-start gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="truncate font-medium">{d.resolutionSummary}</span>
                      </div>
                    )}

                    {/* Status & Assignment pills */}
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        {d.status === 'closed' && isMyClosedDialog(d, currentAgent) && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Миний хаасан
                          </span>
                        )}
                        {(d.status === 'bot' || (d.status !== 'closed' && (d.lastMessageSender === 'customer' || d.status === 'new'))) && (
                          <span
                            className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium flex items-center gap-1 shrink-0"
                            title="AI хариулах эсвэл үйлдэл хүлээгдэж буй"
                          >
                            <Bot className="w-2.5 h-2.5 text-purple-600" />
                            <span>AI Pending</span>
                          </span>
                        )}
                      </div>

                      {d.status === 'closed' ? (
                        <span
                          className="text-emerald-700 font-medium flex items-center gap-1 truncate max-w-[130px]"
                          title={`Хаасан оператор: ${d.closedByAgentName || d.assignedAgentName || 'Оператор'}`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            {d.closedByAgentName ? d.closedByAgentName.split(' ')[0] : (d.assignedAgentName ? d.assignedAgentName.split(' ')[0] : 'Хаагдсан')}
                          </span>
                        </span>
                      ) : d.assignedAgentName ? (
                        <span className="text-slate-500 flex items-center gap-1 truncate max-w-[120px]">
                          <User className="w-2.5 h-2.5 text-slate-400" />
                          <span className="truncate">{d.assignedAgentName.split(' ')[0]}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-medium">Эзэнгүй</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================
            COLUMN 2: CONVERSATION AREA & CONTROLS (Middle)
           ======================================================== */}
        {selectedDialog ? (
          <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 bg-slate-50 min-h-0 h-full overflow-hidden`}>
            {/* Header */}
            <div className="p-2.5 sm:p-3.5 px-3 sm:px-5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 sm:gap-3 shadow-xs shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Back button for mobile view */}
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden p-1.5 -ml-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
                  title="Чатын жагсаалт руу буцах"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="relative shrink-0">
                  <img
                    src={selectedDialog.customer.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={selectedDialog.customer.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-white ${getChannelBadge(selectedDialog.channelType).dot}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{selectedDialog.customer.name}</h3>
                    <span className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full border shrink-0 ${getStatusBadge(selectedDialog.status).color}`}>
                      {getStatusBadge(selectedDialog.status).label}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1.5 sm:gap-2 flex-wrap truncate">
                    <span className="truncate">{selectedDialog.channelName}</span>
                    <span>•</span>
                    <span className="font-mono text-[10px] sm:text-[11px] text-slate-400">ID: {selectedDialog.dialogId}</span>
                    {(() => {
                      const line = openLines.find(
                        (l) => String(l.id) === selectedDialog.channelId || l.name === selectedDialog.channelName
                      );
                      const agents = line?.assignedAgents || [];
                      if (agents.length === 0) return null;
                      return (
                        <>
                          <span>•</span>
                          <span
                            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            title={`Битрикс24 дээр энэ сувагт оноогдсон операторууд:\n${agents.map((a) => `• ${a.fullName} (${a.workPosition}) - ${a.status}`).join('\n')}`}
                          >
                            <Users className="w-3 h-3 text-blue-500" />
                            <span>{agents.length} оператор</span>
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Mobile / Tablet CRM details trigger button */}
                <button
                  type="button"
                  onClick={() => setShowMobileDetails(true)}
                  className="xl:hidden inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition"
                  title="Харилцагчийн CRM дэлгэрэнгүй мэдээлэл харах"
                >
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">CRM мэдээлэл</span>
                  <span className="sm:hidden">CRM</span>
                </button>
                {/* Bot Connect/Disconnect Button right in chat header */}
                {(() => {
                  const channelLine = openLines.find(
                    (l) => String(l.id) === selectedDialog.channelId || l.name === selectedDialog.channelName
                  );
                  const hasWelcomeBot =
                    channelLine &&
                    (channelLine.welcomeBotEnable === true ||
                      channelLine.welcomeBotEnable === 'Y' ||
                      (channelLine.welcomeBotId && Number(channelLine.welcomeBotId) > 0));
                  const isBoundToOurBot =
                    (hasWelcomeBot && String(channelLine?.welcomeBotId) === String(botConfig?.botId)) ||
                    botConfig?.selectedLineId === Number(selectedDialog.channelId);

                  if (isBoundToOurBot) {
                    return (
                      onUnbindLine && (
                        <button
                          id="chat-header-unbind-bot-btn"
                          type="button"
                          onClick={async () => {
                            setIsBotActionLoading(true);
                            try {
                              await onUnbindLine(Number(selectedDialog.channelId));
                            } finally {
                              setIsBotActionLoading(false);
                            }
                          }}
                          disabled={isBotActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition disabled:opacity-50 shadow-2xs"
                          title={`'${selectedDialog.channelName}' сувгаас BSB AI ботыг салгах`}
                        >
                          <Unlink className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isBotActionLoading ? 'Салгаж байна...' : 'Бот салгах'}</span>
                        </button>
                      )
                    );
                  }

                  return (
                    onBindLine && (
                      <button
                        id="chat-header-bind-bot-btn"
                        type="button"
                        onClick={async () => {
                          setIsBotActionLoading(true);
                          try {
                            await onBindLine(Number(selectedDialog.channelId), selectedDialog.channelName);
                          } finally {
                            setIsBotActionLoading(false);
                          }
                        }}
                        disabled={isBotActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition disabled:opacity-50 shadow-2xs"
                        title={`'${selectedDialog.channelName}' сувагт BSB AI ботыг холбох`}
                      >
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>{isBotActionLoading ? 'Холбож байна...' : 'Боттой холбох'}</span>
                      </button>
                    )
                  );
                })()}

                {/* Take Dialog button */}
                {selectedDialog.status !== 'closed' && !isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent) && (
                  <button
                    id="take-dialog-btn"
                    onClick={handleTakeDialog}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Өөртөө авах</span>
                  </button>
                )}

                {/* Transfer button */}
                <button
                  id="transfer-dialog-btn"
                  onClick={() => setShowTransferModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                  title="Өөр операторт шилжүүлэх"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Шилжүүлэх</span>
                </button>

                {/* Close Dialog button */}
                {selectedDialog.status !== 'closed' ? (
                  <button
                    id="close-dialog-btn"
                    onClick={() => setShowCloseModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-medium transition"
                    title="Чатыг хаах, дуусгах"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Хаах</span>
                  </button>
                ) : (
                  <button
                    id="reopen-dialog-btn"
                    onClick={handleReopenDialog}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition"
                  >
                    <span>Дахин нээх</span>
                  </button>
                )}

                {/* Star toggle */}
                <button
                  onClick={() => handleToggleStar(selectedDialog.id, Boolean(selectedDialog.isStarred))}
                  className={`p-1.5 rounded-lg border transition ${
                    selectedDialog.isStarred
                      ? 'bg-amber-50 border-amber-300 text-amber-500'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Star className={`w-4 h-4 ${selectedDialog.isStarred ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>

            {/* Live Bot Awareness Banner */}
            {(() => {
              const channelLine = openLines.find(
                (l) => String(l.id) === selectedDialog.channelId || l.name === selectedDialog.channelName
              );
              const isBoundToOurBot =
                Boolean(botConfig?.isPollingActive) &&
                (botConfig?.selectedLineId === Number(selectedDialog.channelId) ||
                  (channelLine &&
                    (channelLine.welcomeBotEnable === true || channelLine.welcomeBotEnable === 'Y') &&
                    String(channelLine.welcomeBotId) === String(botConfig?.botId)));
              const isBotHandling = Boolean(isBoundToOurBot && selectedDialog.status === 'bot');

              if (!isBotHandling) return null;

              return (
                <div className="bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 border-b border-purple-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-purple-950 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs ring-2 ring-purple-200">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-2 text-purple-900">
                        <span>BSB AI Туслах бот энэ харилцагчтай харилцаж байна</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          AI Идэвхтэй
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-700 truncate">
                        Харилцагчийн асуултуудад БСБ Мэдээллийн сангаас хайж автоматаар хариулна. Та доорх чатнаас харилцагч болон ботын харилцааг бүрэн харах боломжтой.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedDialog.status === 'bot' && (
                      <button
                        type="button"
                        id="banner-takeover-btn"
                        onClick={handleTakeDialog}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs transition shadow-2xs"
                        title="Чат руу өөрөө орж, оператор биечлэн хариуцах"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Өөртөө авах (Оператор хариуцах)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Closed Dialog Banner */}
            {selectedDialog.status === 'closed' && (
              <div className="bg-emerald-50/95 border-b border-emerald-200 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-950 shrink-0 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 text-emerald-900 flex-wrap">
                      <span>Хаагдсан харилцан яриа</span>
                      {isMyClosedDialog(selectedDialog, currentAgent) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-200/90 px-2 py-0.5 rounded-full border border-emerald-300">
                          Таны хаасан
                        </span>
                      )}
                      <span className="text-emerald-400">•</span>
                      <span className="text-emerald-700 font-normal">
                        Оператор: <strong className="font-semibold">{selectedDialog.closedByAgentName || selectedDialog.assignedAgentName || 'БСБ Оператор'}</strong>
                      </span>
                      {selectedDialog.closedAt && (
                        <>
                          <span className="text-emerald-400">•</span>
                          <span className="text-emerald-700 font-normal">
                            {new Date(selectedDialog.closedAt).toLocaleString('mn-MN')}
                          </span>
                        </>
                      )}
                    </div>
                    {selectedDialog.resolutionSummary && (
                      <p className="text-[11px] text-emerald-800 truncate mt-0.5">
                        Шийдвэрлэлтийн тэмдэглэл: <span className="font-medium">{selectedDialog.resolutionSummary}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  id="banner-reopen-dialog-btn"
                  onClick={handleReopenDialog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-2xs shrink-0"
                  title="Харилцан яриаг дахин нээж үргэлжлүүлэх"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Дахин нээх</span>
                </button>
              </div>
            )}

            {/* Message Thread */}
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div
                ref={messagesContainerRef}
                onScroll={handleScrollMessages}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 min-h-0 scroll-smooth"
              >
                {selectedDialog.messages.map((msg) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="px-3 py-1 rounded-full bg-slate-200/80 text-slate-600 text-[11px] font-medium max-w-md text-center">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                if (msg.isInternalNote) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="max-w-lg w-full bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-xs text-xs space-y-1">
                        <div className="flex items-center justify-between text-amber-800 font-semibold text-[11px]">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Дотоод тэмдэглэл ({msg.senderName})</span>
                          </span>
                          <span className="text-slate-400 font-normal">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-amber-950 font-sans">{msg.text}</p>
                        <span className="text-[10px] text-amber-600/80 italic block">
                          Зөвхөн операторуудад харагдана, хэрэглэгчид харагдахгүй.
                        </span>
                      </div>
                    </div>
                  );
                }

                const isCustomer = msg.sender === 'customer';
                const isBot = msg.sender === 'bot';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isCustomer ? 'justify-start' : 'justify-end'}`}
                  >
                    {isCustomer && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 border border-slate-300">
                        {msg.senderName?.slice(0, 2).toUpperCase() || 'CU'}
                      </div>
                    )}

                    <div className={`max-w-lg space-y-1 ${isCustomer ? 'items-start' : 'items-end'}`}>
                      <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 px-1 ${!isCustomer ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-slate-700">{msg.senderName}</span>
                        {isBot && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-semibold text-[9px] flex items-center gap-0.5 border border-purple-200">
                            <Bot className="w-2.5 h-2.5 text-purple-600" /> AI Бот
                          </span>
                        )}
                        {!isCustomer && !isBot && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 font-semibold text-[9px] flex items-center gap-0.5 border border-emerald-200">
                            <User className="w-2.5 h-2.5 text-emerald-600" /> Оператор
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isCustomer
                            ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-none shadow-xs'
                            : isBot
                            ? 'bg-purple-50 text-purple-950 border border-purple-200 rounded-tr-none shadow-xs'
                            : 'bg-emerald-600 text-white rounded-tr-none shadow-xs'
                        }`}
                      >
                        {isBot && (
                          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-purple-200/80 text-[11px] font-semibold text-purple-800">
                            <Bot className="w-3.5 h-3.5 text-purple-600" />
                            <span>BSB AI Туслахын автомат хариулт</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {/* Inline Keyboard (if bot returned buttons) */}
                        {msg.keyboard && msg.keyboard.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-purple-200/80 flex flex-wrap gap-1.5">
                            {msg.keyboard.map((btn, idx) => (
                              <button
                                key={idx}
                                disabled
                                className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 text-[11px] font-semibold border border-purple-200"
                              >
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isCustomer && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                          isBot ? 'bg-purple-600 ring-2 ring-purple-200' : 'bg-emerald-600 ring-2 ring-emerald-200'
                        }`}
                      >
                        {isBot ? <Bot className="w-4 h-4" /> : msg.senderName?.slice(0, 1) || 'А'}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Floating Snap-to-Bottom Button when scrolled up */}
            {showScrollBottomBtn && (
              <div className="absolute bottom-3 right-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button
                  type="button"
                  id="chat-snap-to-bottom-btn"
                  onClick={() => scrollToBottom('smooth')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition transform hover:scale-105 active:scale-95 ${
                    hasNewMessagesWhileScrolled
                      ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                  title="Хамгийн сүүлийн мессеж рүү үсрэх"
                >
                  <ArrowDown className={`w-3.5 h-3.5 ${hasNewMessagesWhileScrolled ? 'animate-bounce' : ''}`} />
                  <span>{hasNewMessagesWhileScrolled ? 'Шинэ мессеж ирлээ' : 'Доош гүйлгэх'}</span>
                </button>
              </div>
            )}
          </div>

            {/* Bottom Composer Box */}
            <div className="p-2.5 sm:p-4 bg-white border-t border-slate-200 space-y-2 shadow-sm shrink-0">
              {/* Assignment Notice Banner if Chat is not assigned to current agent */}
              {(() => {
                const isAssignedToMe = isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent);
                if (!isAssignedToMe && selectedDialog.status !== 'closed') {
                  return (
                    <div id="unassigned-chat-warning-banner" className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-amber-950 truncate">
                            {selectedDialog.status === 'new' || !selectedDialog.assignedAgentId
                              ? 'Энэ чат операторт оноогдоогүй байна'
                              : `Чат өөр операторт оноогдсон байна (${selectedDialog.assignedAgentName || 'Оператор'})`}
                          </p>
                          <p className="text-[11px] text-amber-700 hidden sm:block">
                            Харилцагчид хариу бичих эсвэл дотоод тэмдэглэл үлдээхийн тулд чатыг өөртөө авна уу.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        id="take-dialog-banner-btn"
                        onClick={handleTakeDialog}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 transition shadow-sm active:scale-95"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Өөртөө авах</span>
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Error Alert Message if validation fails */}
              {sendErrorMessage && (
                <div id="send-error-alert" className="flex items-center justify-between gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="truncate">{sendErrorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSendErrorMessage(null)}
                    className="text-rose-500 hover:text-rose-700 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Toolbar: Mode switcher & Quick AI/KB Helpers */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none whitespace-nowrap pb-0.5">
                {/* Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`px-2.5 sm:px-3 py-1 rounded-md font-medium transition ${
                      !isInternalNote
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    💬 Хариу
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                      isInternalNote
                        ? 'bg-amber-100 text-amber-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Тэмдэглэл</span>
                  </button>
                </div>

                {/* Helper Buttons */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-xs shrink-0">
                  {/* AI Suggestion */}
                  <button
                    type="button"
                    id="ai-suggest-btn"
                    onClick={handleAISuggest}
                    disabled={isSuggestingAI || (!isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent) && selectedDialog.status !== 'closed')}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 transition disabled:opacity-50"
                    title="Хэрэглэгчийн асуултад хиймэл оюунаар бэлэн Монгол хариулт боловсруулах"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSuggestingAI ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isSuggestingAI ? 'AI тооцоолж байна...' : 'AI Санал болгох'}</span>
                    <span className="sm:hidden">{isSuggestingAI ? '...' : 'AI Санал'}</span>
                  </button>

                  {/* Canned / Quick Replies Toggle */}
                  <button
                    type="button"
                    id="quick-replies-panel-btn"
                    onClick={() => setShowQuickRepliesPanel((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg font-medium transition ${
                      showQuickRepliesPanel
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                    title="Хурдан хариултуудын (Quick Replies) самбарыг нээх/хаах"
                  >
                    <Zap className={`w-3.5 h-3.5 ${showQuickRepliesPanel ? 'fill-current' : 'text-amber-600'}`} />
                    <span className="hidden sm:inline">Хурдан хариулт</span>
                    <span className="sm:hidden">Хурдан</span>
                  </button>

                  {/* KB Article Insert */}
                  <button
                    type="button"
                    id="insert-kb-article-btn"
                    onClick={() => setShowKBModal(true)}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Мэдээллийн сан</span>
                    <span className="sm:hidden">Сан</span>
                  </button>
                </div>
              </div>

              {/* Quick Replies Expanded Panel */}
              <QuickRepliesPanel
                isOpen={showQuickRepliesPanel}
                onClose={() => setShowQuickRepliesPanel(false)}
                onInsertReply={handleInsertQuickReply}
              />

              {/* 1-Click Quick Response Chips Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 text-xs">
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-500 shrink-0 select-none">
                  <Zap className="w-3 h-3 text-amber-500 fill-current" />
                  <span className="hidden xs:inline">1-товшилт:</span>
                </div>
                {topQuickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertQuickReply(chip.text)}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 border border-slate-200/80 text-slate-700 text-[11px] font-medium whitespace-nowrap transition active:scale-95 shadow-2xs"
                    title={`Нэг товшилтоор оруулах: "${chip.text.slice(0, 45)}..."`}
                  >
                    {chip.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowQuickRepliesPanel((prev) => !prev)}
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition border ${
                    showQuickRepliesPanel
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                  title="Бүх хурдан хариултуудын самбар"
                >
                  {showQuickRepliesPanel ? 'Хумих ▴' : 'Бүгд (10+) ▾'}
                </button>
              </div>

              {/* Text Input Form */}
              {(() => {
                const isAssignedToMe = isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent);
                const isUnassignedChat = !isAssignedToMe && selectedDialog.status !== 'closed';

                return (
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    <div className="relative">
                      <textarea
                        id="chat-message-input"
                        value={inputText}
                        onChange={(e) => {
                          setInputText(e.target.value);
                          if (sendErrorMessage) setSendErrorMessage(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isUnassignedChat}
                        placeholder={
                          isUnassignedChat
                            ? 'Хариу бичихийн тулд эхлээд "Өөртөө авах" товчийг дарна уу...'
                            : isInternalNote
                            ? 'Дотоод тэмдэглэл бичих...'
                            : 'Хэрэглэгчид илгээх хариултаа бичнэ үү (Enter илгээх, Shift+Enter шинэ мөр)...'
                        }
                        rows={2}
                        className={`w-full p-2.5 sm:p-3 pr-20 sm:pr-32 rounded-xl text-xs focus:outline-none transition border resize-none ${
                          isUnassignedChat
                            ? 'bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed placeholder-slate-400'
                            : isInternalNote
                            ? 'bg-amber-50/50 border-amber-300 focus:border-amber-500 text-amber-950 placeholder-amber-600/60'
                            : 'bg-slate-50 border-slate-300 focus:border-blue-500 focus:bg-white text-slate-900'
                        }`}
                      />
                      <div className="absolute right-2 bottom-2 sm:right-2.5 sm:bottom-3 flex items-center gap-2">
                        {isUnassignedChat ? (
                          <button
                            type="button"
                            id="take-dialog-inline-btn"
                            onClick={handleTakeDialog}
                            className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition active:scale-95"
                            title="Чатыг өөртөө авах"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Өөртөө авах</span>
                          </button>
                        ) : (
                          <button
                            type="submit"
                            id="send-chat-message-btn"
                            disabled={isSending || !inputText.trim()}
                            className={`inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${
                              isInternalNote
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{isInternalNote ? 'Тэмдэглэл хадгалах' : 'Илгээх'}</span>
                            <span className="sm:hidden">{isInternalNote ? 'Хадгалах' : 'Илгээх'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col items-center justify-center p-6 sm:p-8 text-center text-slate-400 bg-slate-50 min-h-0 h-full`}>
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700 text-sm">Чат сонгоогүй байна</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Зүүн талын жагсаалтаас нэг харилцан яриаг сонгож хариу бичих эсвэл шинэ чатын симуляци хийнэ үү.
            </p>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="lg:hidden mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Чатын жагсаалт харах</span>
            </button>
          </div>
        )}

        {/* ========================================================
            COLUMN 3: CUSTOMER CRM & CHANNEL INFO (Right)
           ======================================================== */}
        {selectedDialog && (
          <div className="hidden xl:flex w-72 2xl:w-80 border-l border-slate-200 bg-white flex-col shrink-0 p-4 space-y-4 overflow-y-auto min-h-0 h-full">
            {/* Customer Profile Card */}
            <div className="text-center pb-3 border-b border-slate-100">
              <img
                src={selectedDialog.customer.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={selectedDialog.customer.name}
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-100 shadow-xs mb-2"
              />
              <h4 className="font-bold text-slate-900 text-sm">{selectedDialog.customer.name}</h4>
              <p className="text-xs text-slate-400">{selectedDialog.customer.city || 'Улаанбаатар'}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 justify-center mt-2.5">
                {(selectedDialog.customer.tags || ['Шинэ харилцагч']).map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2.5 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Харилцагчийн мэдээлэл
              </h5>

              {selectedDialog.customer.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{selectedDialog.customer.phone}</span>
                </div>
              )}

              {selectedDialog.customer.email && (
                <div className="flex items-center gap-2 text-slate-600 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedDialog.customer.email}</span>
                </div>
              )}

              {selectedDialog.customer.address && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px]">{selectedDialog.customer.address}</span>
                </div>
              )}
            </div>

            {/* CRM & Orders stats */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>CRM Lead / Deal:</span>
                <span className="font-mono font-semibold text-blue-700">
                  {selectedDialog.customer.crmLeadId || 'LEAD-9912'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Өмнөх захиалга:</span>
                <span className="font-semibold text-slate-800">
                  {selectedDialog.customer.totalOrders ?? 1} удаа
                </span>
              </div>
              {selectedDialog.customer.lastOrderDate && (
                <div className="flex justify-between items-center text-slate-500">
                  <span>Сүүлийн худалдан авалт:</span>
                  <span className="text-slate-700">{selectedDialog.customer.lastOrderDate}</span>
                </div>
              )}
            </div>

            {/* Channel origin & Bot Binding */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Сувгийн холболт
              </h5>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900 truncate text-[11px]">
                    {selectedDialog.channelName}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{selectedDialog.channelId}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Төрөл: {selectedDialog.channelType.toUpperCase()}
                </div>

                {/* Live Welcome Bot info & Controls */}
                {(() => {
                  const channelLine = openLines.find(
                    (l) => String(l.id) === String(selectedDialog.channelId)
                  );
                  const hasWelcomeBot = channelLine?.welcomeBotEnable === 'Y';
                  const isBoundToOurBot =
                    (hasWelcomeBot && String(channelLine?.welcomeBotId) === String(botConfig?.botId)) ||
                    botConfig?.selectedLineId === Number(selectedDialog.channelId);

                  return (
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">Угтах бот:</span>
                        {isBoundToOurBot ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Манай бот холбогдсон</span>
                          </span>
                        ) : hasWelcomeBot ? (
                          <span
                            className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                            title={`Бот ID: ${channelLine?.welcomeBotId}`}
                          >
                            Бот #{channelLine?.welcomeBotId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Бот залгаагүй</span>
                        )}
                      </div>

                      {/* Bot Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1">
                        {isBoundToOurBot ? (
                          onUnbindLine && (
                            <button
                              id={`workplace-unbind-btn-${selectedDialog.channelId}`}
                              type="button"
                              onClick={async () => {
                                setIsBotActionLoading(true);
                                try {
                                  await onUnbindLine(Number(selectedDialog.channelId));
                                } finally {
                                  setIsBotActionLoading(false);
                                }
                              }}
                              disabled={isBotActionLoading}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition shadow-xs disabled:opacity-50"
                              title="Энэ сувгаас BSB AI ботыг салгах"
                            >
                              <Unlink className="w-3.5 h-3.5 text-rose-600" />
                              <span>{isBotActionLoading ? 'Салгаж байна...' : 'Бот салгах'}</span>
                            </button>
                          )
                        ) : (
                          <>
                            {onBindLine && (
                              <button
                                id={`workplace-bind-btn-${selectedDialog.channelId}`}
                                type="button"
                                onClick={async () => {
                                  setIsBotActionLoading(true);
                                  try {
                                    await onBindLine(
                                      Number(selectedDialog.channelId),
                                      selectedDialog.channelName
                                    );
                                  } finally {
                                    setIsBotActionLoading(false);
                                  }
                                }}
                                disabled={isBotActionLoading}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition shadow-xs disabled:opacity-50"
                                title="Энэ сувагт BSB AI ботыг холбох"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>{isBotActionLoading ? 'Холбож байна...' : 'Боттой холбох'}</span>
                              </button>
                            )}
                            {hasWelcomeBot && onUnbindLine && (
                              <button
                                id={`workplace-unbind-other-btn-${selectedDialog.channelId}`}
                                type="button"
                                onClick={async () => {
                                  setIsBotActionLoading(true);
                                  try {
                                    await onUnbindLine(Number(selectedDialog.channelId));
                                  } finally {
                                    setIsBotActionLoading(false);
                                  }
                                }}
                                disabled={isBotActionLoading}
                                className="inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition shadow-xs disabled:opacity-50"
                                title="Суваг дээрх одоогийн угтах ботыг салгах"
                              >
                                <Unlink className="w-3.5 h-3.5 text-rose-600" />
                                <span>Бот салгах</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Assigned Operator details */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Хариуцсан оператор
              </h5>
              {selectedDialog.assignedAgentName ? (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <img
                    src={selectedDialog.assignedAgentAvatar || currentAgent?.avatar}
                    alt={selectedDialog.assignedAgentName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">
                      {selectedDialog.assignedAgentName}
                    </div>
                    <div className="text-[10px] text-slate-400">Хариуцаж ажиллаж байна</div>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
                  Одоогоор оператор томилогдоогүй
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MOBILE / TABLET CRM DRAWER (Slide-over for < xl screens)
         ======================================================== */}
      {showMobileDetails && selectedDialog && (
        <div className="xl:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">CRM & Харилцагчийн мэдээлэл</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileDetails(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Profile Card */}
            <div className="text-center pb-3 border-b border-slate-100">
              <img
                src={selectedDialog.customer.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={selectedDialog.customer.name}
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-100 shadow-xs mb-2"
              />
              <h4 className="font-bold text-slate-900 text-sm">{selectedDialog.customer.name}</h4>
              <p className="text-xs text-slate-400">{selectedDialog.customer.city || 'Улаанбаатар'}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 justify-center mt-2.5">
                {(selectedDialog.customer.tags || ['Шинэ харилцагч']).map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2.5 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Харилцагчийн холбоос
              </h5>

              {selectedDialog.customer.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`tel:${selectedDialog.customer.phone}`} className="font-mono text-blue-600 hover:underline">
                    {selectedDialog.customer.phone}
                  </a>
                </div>
              )}

              {selectedDialog.customer.email && (
                <div className="flex items-center gap-2 text-slate-600 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedDialog.customer.email}</span>
                </div>
              )}

              {selectedDialog.customer.address && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px]">{selectedDialog.customer.address}</span>
                </div>
              )}
            </div>

            {/* CRM & Orders stats */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>CRM Lead / Deal:</span>
                <span className="font-mono font-semibold text-blue-700">
                  {selectedDialog.customer.crmLeadId || 'LEAD-9912'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Өмнөх захиалга:</span>
                <span className="font-semibold text-slate-800">
                  {selectedDialog.customer.totalOrders ?? 1} удаа
                </span>
              </div>
              {selectedDialog.customer.lastOrderDate && (
                <div className="flex justify-between items-center text-slate-500">
                  <span>Сүүлийн худалдан авалт:</span>
                  <span className="text-slate-700">{selectedDialog.customer.lastOrderDate}</span>
                </div>
              )}
            </div>

            {/* Channel origin */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Сувгийн холболт
              </h5>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900 truncate text-[11px]">
                    {selectedDialog.channelName}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{selectedDialog.channelId}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Төрөл: {selectedDialog.channelType.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Assigned Operator details */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <h5 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Хариуцсан оператор
              </h5>
              {selectedDialog.assignedAgentName ? (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <img
                    src={selectedDialog.assignedAgentAvatar || currentAgent?.avatar}
                    alt={selectedDialog.assignedAgentName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">
                      {selectedDialog.assignedAgentName}
                    </div>
                    <div className="text-[10px] text-slate-400">Хариуцаж ажиллаж байна</div>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
                  Одоогоор оператор томилогдоогүй
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS & POPUPS
         ======================================================== */}

      {/* 1. Canned Responses Modal */}
      {showCannedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900">Шуурхай хариултын загварууд</h3>
              </div>
              <button onClick={() => setShowCannedModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto divide-y divide-slate-100 space-y-2">
              {cannedResponses.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    handleInsertQuickReply(item.text);
                    setShowCannedModal(false);
                  }}
                  className="p-3 rounded-xl hover:bg-blue-50/60 cursor-pointer transition space-y-1 text-left"
                >
                  <div className="font-semibold text-xs text-slate-900">{item.title}</div>
                  <p className="text-xs text-slate-500 line-clamp-2">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Knowledge Base Article Insert Modal */}
      {showKBModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Мэдээллийн сангаас хариу оруулах</h3>
              </div>
              <button onClick={() => setShowKBModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {articles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => {
                    setInputText(`[${art.title}]\n${art.content}`);
                    setIsInternalNote(false);
                    setShowKBModal(false);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition text-left space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{art.title}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                      {art.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{art.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Transfer Dialog Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Чатыг өөр операторт шилжүүлэх</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 block">Шилжүүлэх оператороо сонгоно уу:</label>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(() => {
                  const lineIdNum = selectedDialog ? parseInt(selectedDialog.channelId, 10) : null;
                  const currentLine = openLines.find(
                    (l) => String(l.id) === selectedDialog?.channelId || l.name === selectedDialog?.channelName
                  );

                  const isAssigned = (a: Agent) => {
                    if (lineIdNum && a.assignedChannelIds?.includes(lineIdNum)) return true;
                    if (
                      currentLine?.assignedAgents?.some(
                        (ca) =>
                          ca.userId === a.bitrixUserId ||
                          ca.fullName.toLowerCase() === a.name.toLowerCase()
                      )
                    ) {
                      return true;
                    }
                    return false;
                  };

                  const channelAgents = team.filter(isAssigned);
                  const otherAgents = team.filter((a) => !isAssigned(a));

                  return (
                    <>
                      {channelAgents.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>Энэ сувагт оноогдсон Битрикс операторууд ({channelAgents.length})</span>
                          </div>
                          <div className="space-y-1.5 mb-3">
                            {channelAgents.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => handleTransfer(agent)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl border-2 border-blue-200 bg-blue-50/40 hover:border-blue-500 hover:bg-blue-50 transition text-left"
                              >
                                <img
                                  src={agent.avatar}
                                  alt={agent.name}
                                  className="w-8 h-8 rounded-full object-cover border border-blue-200"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-slate-900">{agent.name}</span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-600 text-white">
                                      Сувгийн оператор
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">{agent.role}</div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    agent.status === 'online'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {agent.status === 'online' ? 'Online' : 'Offline'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {otherAgents.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Бусад операторууд ({otherAgents.length})
                          </div>
                          <div className="space-y-1.5">
                            {otherAgents.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => handleTransfer(agent)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition text-left"
                              >
                                <img
                                  src={agent.avatar}
                                  alt={agent.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-xs text-slate-900">{agent.name}</div>
                                  <div className="text-[10px] text-slate-400 truncate">{agent.role}</div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    agent.status === 'online'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {agent.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Close Dialog Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 border-b border-slate-100 pb-3">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-900">Харилцан яриаг дуусгах / Хаах</h3>
            </div>
            <div className="space-y-2 text-xs">
              <label className="font-medium text-slate-700 block">Шийдвэрлэлтийн үндсэн шалтгаан / Тэмдэглэл:</label>
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="Амжилттай шийдвэрлэсэн">Амжилттай шийдвэрлэсэн</option>
                <option value="Барааны мэдээлэл & Үнэ өгсөн">Барааны мэдээлэл & Үнэ өгсөн</option>
                <option value="Захиалга үүсгэсэн & Төлбөр хийгдсэн">Захиалга үүсгэсэн & Төлбөр хийгдсэн</option>
                <option value="Сервис төв, баталгаа руу чиглүүлсэн">Сервис төв, баталгаа руу чиглүүлсэн</option>
                <option value="Харилцагч хариу өгөөгүй">Харилцагч хариу өгөөгүй</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Цуцлах
              </button>
              <button
                type="button"
                id="confirm-close-chat-btn"
                onClick={handleCloseDialog}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              >
                Чатыг хаах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Simulate Incoming Customer Message Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Шинэ хэрэглэгчийн чат симуляци хийх</h3>
              </div>
              <button onClick={() => setShowSimulateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Хэрэглэгчийн нэр:</label>
                <input
                  type="text"
                  value={simCustomerName}
                  onChange={(e) => setSimCustomerName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ирсэн суваг:</label>
                <select
                  value={simChannelType}
                  onChange={(e) => setSimChannelType(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 text-xs font-medium"
                >
                  <option value="facebook">Facebook Comments & Messenger</option>
                  <option value="webchat">БСБ Онлайн Их Дэлгүүр (Web Live Chat)</option>
                  <option value="instagram">Instagram Direct (@bsb_mongolia)</option>
                  <option value="telegram">Telegram Support Bot</option>
                  <option value="whatsapp">WhatsApp Business</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Хэрэглэгчийн мессеж:</label>
                <textarea
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  rows={3}
                  className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Цуцлах
              </button>
              <button
                type="button"
                id="submit-sim-chat-btn"
                onClick={handleSimulateIncoming}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                Чат үүсгэж илгээх
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
