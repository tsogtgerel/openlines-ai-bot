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
  Volume2,
  VolumeX,
  Bell,
  BellRing,
  BellOff,
  Keyboard,
  Briefcase,
  DollarSign,
  ExternalLink,
  MoreVertical,
  Package,
} from 'lucide-react';
import { ChatDialog, ChatMessage, Agent, KnowledgeArticle, OpenLineItem, BotConfig, TypingUser } from '../types';
import { QuickRepliesPanel } from './QuickRepliesPanel';
import { ProductSearchModal } from './ProductSearchModal';
import { FormattedMessageText } from './FormattedMessageText';
import {
  playIncomingMessageSound,
  playOutgoingMessageSound,
  playTypingBlipSound,
  playNewInquiryAlertSound,
  isChatSoundEnabled,
  setChatSoundEnabled,
  testChatSound,
  unlockAudioContext,
} from '../utils/chatSound';
import {
  isBrowserNotificationSupported,
  isBrowserNotificationEnabled,
  setBrowserNotificationEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  sendNewChatNotification,
} from '../utils/browserNotification';

interface OpenChannelChatWorkplaceProps {
  currentAgent: Agent | null;
  team: Agent[];
  openLines: OpenLineItem[];
  articles: KnowledgeArticle[];
  onOpenTeamModal: () => void;
  botConfig?: BotConfig | null;
  targetChatId?: string | null;
  onBindLine?: (lineId: number, lineName: string) => Promise<void>;
  onUnbindLine?: (lineId: number) => Promise<void>;
}

/**
 * Server/Vite HTML fallback үед JSON алдаа шидэхээс сэргийлэх аюулгүй fetch туслах
 */
async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch (err) {
    return null;
  }
}

export const OpenChannelChatWorkplace: React.FC<OpenChannelChatWorkplaceProps> = ({
  currentAgent,
  team,
  openLines,
  articles,
  onOpenTeamModal,
  botConfig,
  targetChatId,
  onBindLine,
  onUnbindLine,
}) => {
  // State
  const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(targetChatId || null);
  const [selectedDialog, setSelectedDialog] = useState<ChatDialog | null>(null);
  const [isLoadingDialogs, setIsLoadingDialogs] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);

  // Jump to targeted chat if passed
  useEffect(() => {
    if (targetChatId) {
      setSelectedDialogId(targetChatId);
      setMobileView('chat');
      const found = dialogs.find((d) => d.id === targetChatId || d.dialogId === targetChatId);
      if (found) {
        setSelectedDialog(found);
      }
    }
  }, [targetChatId, dialogs]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'my' | 'my_closed' | 'bot' | 'closed' | 'starred'>(() => {
    if (currentAgent?.accessRole === 'agent') return 'my';
    return 'all';
  });
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'pending_ai' | 'closed_newest' | 'closed_oldest'>('newest');

  // Ensure agent is never stuck in supervisor-only tabs (all, closed, bot)
  useEffect(() => {
    if (currentAgent?.accessRole === 'agent') {
      if (statusFilter === 'all' || statusFilter === 'closed' || statusFilter === 'bot') {
        setStatusFilter('my');
      }
    }
  }, [currentAgent?.accessRole, statusFilter]);

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
  const [showProductSearchModal, setShowProductSearchModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('Амжилттай шийдвэрлэсэн');

  // Bitrix24 CRM Lead / Deal actions on Close
  const [closeLeadAction, setCloseLeadAction] = useState<'keep_open' | 'close_converted' | 'create_deal' | 'close_junk'>('close_converted');
  const [closeDealTitle, setCloseDealTitle] = useState('');
  const [closeDealAmount, setCloseDealAmount] = useState('');
  const [closeDealStage, setCloseDealStage] = useState('NEW');

  // Standalone Create Deal Modal
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [createDealTitle, setCreateDealTitle] = useState('');
  const [createDealAmount, setCreateDealAmount] = useState('');
  const [createDealStage, setCreateDealStage] = useState('NEW');
  const [createDealConvertLead, setCreateDealConvertLead] = useState(true);
  const [createDealComments, setCreateDealComments] = useState('');
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);

  // Chat header More Actions menu dropdown
  const [showChatActionsMenu, setShowChatActionsMenu] = useState(false);

  useEffect(() => {
    setShowChatActionsMenu(false);
  }, [selectedDialog?.id]);

  // CRM notifications & inline status updates
  const [isUpdatingLeadStatus, setIsUpdatingLeadStatus] = useState(false);
  const [crmNotification, setCrmNotification] = useState<{ message: string; type: 'success' | 'error'; url?: string } | null>(null);

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

  // Real-time Typing Indicator & Chat Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isChatSoundEnabled());
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState<boolean>(() => isBrowserNotificationEnabled());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [newInquiryBanner, setNewInquiryBanner] = useState<{
    id: string;
    customerName: string;
    channelName: string;
    text: string;
    dialog: ChatDialog;
  } | null>(null);
  const knownDialogIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadCompletedRef = useRef<boolean>(false);

  // Helper to check if a channel is assigned to the current agent
  const isChannelAssignedToCurrentAgent = (channelId: string | number): boolean => {
    if (!currentAgent) return true;
    if (currentAgent.accessRole !== 'agent' || currentAgent.canAccessAllChannels) return true;
    if (!Array.isArray(currentAgent.assignedChannelIds) || currentAgent.assignedChannelIds.length === 0) {
      return false;
    }
    return currentAgent.assignedChannelIds.some((id) => String(id) === String(channelId));
  };

  // Trigger alert when a brand-new chat inquiry arrives in an assigned channel
  const triggerNewInquiryAlert = (dialog: ChatDialog, firstMessageText?: string) => {
    // Check channel assignment permission
    if (!isChannelAssignedToCurrentAgent(dialog.channelId)) {
      return;
    }

    // 1. Subtle, distinct 3-tone arpeggio chime for new inquiries
    playNewInquiryAlertSound();

    // 2. Browser Desktop Notification (if enabled and granted)
    const snippet = firstMessageText || dialog.lastMessageText || 'Шинэ харилцагчийн лавлагаа ирлээ';
    sendNewChatNotification({
      title: `🔔 Шинэ чат: ${dialog.customer.name}`,
      body: `${dialog.channelName} • ${snippet}`,
      tag: `chat-new-${dialog.id}`,
      onClick: () => {
        setSelectedDialogId(dialog.id);
        setSelectedDialog(dialog);
        setMobileView('chat');
      },
    });

    // 3. Subtle floating in-app banner for 7 seconds
    setNewInquiryBanner({
      id: dialog.id,
      customerName: dialog.customer.name,
      channelName: dialog.channelName,
      text: snippet,
      dialog,
    });
  };

  // Handle incoming message audio & alert dispatching
  const handleIncomingMessageAlert = (dialogId?: string, updatedDialog?: ChatDialog, message?: ChatMessage) => {
    const targetId = dialogId || updatedDialog?.id;
    if (!targetId) return;

    const isAlreadyKnown = knownDialogIdsRef.current.has(targetId);
    if (!isAlreadyKnown) {
      knownDialogIdsRef.current.add(targetId);
      // If initial load already completed, this is a brand new incoming inquiry!
      if (isInitialLoadCompletedRef.current) {
        const dialogCandidate = updatedDialog || dialogs.find((d) => d.id === targetId);
        if (dialogCandidate && (dialogCandidate.status === 'new' || !dialogCandidate.assignedAgentId)) {
          triggerNewInquiryAlert(dialogCandidate, message?.text);
          return;
        }
      }
    }

    // Standard incoming message sound for existing conversations
    if (message && message.sender !== 'agent') {
      playIncomingMessageSound();
    }
  };

  const handleToggleBrowserNotif = async () => {
    if (!isBrowserNotificationSupported()) {
      return;
    }
    const currentPerm = getNotificationPermission();
    if (currentPerm === 'default') {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        setBrowserNotifEnabled(true);
        setBrowserNotificationEnabled(true);
        sendNewChatNotification({
          title: 'Шинэ чатын мэдэгдэл идэвхжлээ',
          body: 'Таны хариуцсан сувгийн шинэ чатууд ирэх үед шууд мэдэгдэх болно.',
        });
        playNewInquiryAlertSound();
      }
    } else if (currentPerm === 'granted') {
      const next = !browserNotifEnabled;
      setBrowserNotifEnabled(next);
      setBrowserNotificationEnabled(next);
      if (next) {
        playNewInquiryAlertSound();
      }
    }
  };

  // Auto-dismiss in-app floating banner after 7 seconds
  useEffect(() => {
    if (!newInquiryBanner) return;
    const timer = setTimeout(() => {
      setNewInquiryBanner(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [newInquiryBanner]);

  const [activeTypers, setActiveTypers] = useState<Record<string, TypingUser[]>>({});
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const typingHeartbeatTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const prevLastMessageKeyRef = useRef<string | null>(null);
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

  // Auto-scroll helper to smoothly bring the chat message thread to the bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Direct scroll attempt immediately
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });

    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({
          behavior,
          block: 'end',
          inline: 'nearest',
        });
      } catch {}
    }

    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setHasNewMessagesWhileScrolled(false);

    // Multi-stage frame checks to guarantee scroll reaches the bottom even if images or layout repainted
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end', inline: 'nearest' });
      }
    });

    setTimeout(() => {
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end', inline: 'nearest' });
      }
    }, 60);

    setTimeout(() => {
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end', inline: 'nearest' });
      }
    }, 180);
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

  // Load all dialogs
  const loadDialogs = async () => {
    try {
      setIsLoadingDialogs(true);
      const params = new URLSearchParams();
      if (channelFilter !== 'all') params.append('channelId', channelFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (currentAgent?.id) params.append('requestingAgentId', currentAgent.id);

      const res = await apiFetch(`/api/chats?${params.toString()}`);
      if (res?.success && Array.isArray(res.data)) {
        setDialogs(res.data);

        // Track known dialog IDs and alert only on new arrivals after initial load
        if (!isInitialLoadCompletedRef.current) {
          res.data.forEach((d: ChatDialog) => knownDialogIdsRef.current.add(d.id));
          isInitialLoadCompletedRef.current = true;
        } else {
          for (const d of res.data) {
            if (!knownDialogIdsRef.current.has(d.id)) {
              knownDialogIdsRef.current.add(d.id);
              if (d.status === 'new' || !d.assignedAgentId) {
                triggerNewInquiryAlert(d);
              }
            }
          }
        }

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

      const res = await apiFetch(`/api/chats/delta?${params.toString()}`);
      if (res?.success && res.data) {
        const { version, hasChanges, dialogs: changedDialogs } = res.data;
        if (typeof version === 'number') {
          lastSyncVersionRef.current = version;
        }

        if (hasChanges && Array.isArray(changedDialogs) && changedDialogs.length > 0) {
          // Detect brand-new incoming inquiries during delta sync
          if (isInitialLoadCompletedRef.current) {
            for (const d of changedDialogs) {
              if (!knownDialogIdsRef.current.has(d.id)) {
                knownDialogIdsRef.current.add(d.id);
                if (d.status === 'new' || !d.assignedAgentId) {
                  triggerNewInquiryAlert(d);
                }
              }
            }
          }

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
          if (isInitialLoadCompletedRef.current) {
            for (const d of res.data.dialogs) {
              if (!knownDialogIdsRef.current.has(d.id)) {
                knownDialogIdsRef.current.add(d.id);
                if (d.status === 'new' || !d.assignedAgentId) {
                  triggerNewInquiryAlert(d);
                }
              }
            }
          }
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

          // Sound & Notification alert for incoming message or new inquiry
          handleIncomingMessageAlert(dialogId, updatedDialog, message);

          const targetId = dialogId || updatedDialog?.id;
          const isActiveChannel =
            Boolean(targetId) &&
            ((selectedDialogId && (selectedDialogId === targetId || String(selectedDialogId) === String(targetId))) ||
              (selectedDialog &&
                (selectedDialog.id === targetId ||
                  selectedDialog.dialogId === targetId ||
                  String(selectedDialog.id) === String(targetId) ||
                  String(selectedDialog.dialogId) === String(targetId))));

          // Immediately update open conversation if it matches
          setSelectedDialog((prev) => {
            if (!prev) return prev;
            if (
              prev.id !== targetId &&
              prev.dialogId !== targetId &&
              String(prev.id) !== String(targetId) &&
              String(prev.dialogId) !== String(targetId)
            ) {
              return prev;
            }

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

          // Trigger auto-scroll-to-bottom effect if message was received in the currently active channel
          if (isActiveChannel) {
            scrollToBottom('smooth');
          }

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

          if (targetId && !knownDialogIdsRef.current.has(targetId)) {
            knownDialogIdsRef.current.add(targetId);
            if (isInitialLoadCompletedRef.current && updatedDialog && (updatedDialog.status === 'new' || !updatedDialog.assignedAgentId)) {
              triggerNewInquiryAlert(updatedDialog);
            }
          }

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

      // Real-time 'Agent is typing...' SSE event stream
      eventSource.addEventListener('typing:update', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          const { dialogId, typers } = payload;
          if (dialogId) {
            setActiveTypers((prev) => {
              const prevTypers = prev[dialogId] || [];
              const isNewlyTyping = prevTypers.length === 0 && Array.isArray(typers) && typers.length > 0;
              if (isNewlyTyping && (selectedDialogId === dialogId || selectedDialog?.dialogId === dialogId)) {
                const notMe = typers.some((t: TypingUser) => t.agentId !== currentAgent?.id && t.name !== currentAgent?.name);
                if (notMe) playTypingBlipSound();
              }
              return {
                ...prev,
                [dialogId]: typers || [],
              };
            });
          }
        } catch (err) {
          console.error('Failed to parse typing:update SSE event', err);
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
  // Runs rapidly every 2.5s when SSE is active as reconciliation, or every 1.2s if SSE disconnects
  useEffect(() => {
    const pollInterval = isRealtimeConnected ? 2500 : 1200;
    const timer = setInterval(() => {
      loadDialogsDelta();
    }, pollInterval);
    return () => clearInterval(timer);
  }, [channelFilter, sortBy, isRealtimeConnected]);

  // 4. Real-time WebSocket connection for bi-directional typing indicators & live broadcast
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCleanedUp = false;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      if (isCleanedUp) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isCleanedUp) {
            setIsWsConnected(true);
            try {
              ws?.send(
                JSON.stringify({
                  type: 'join',
                  agentId: currentAgent?.id,
                  agentName: currentAgent?.name,
                })
              );
            } catch {}
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected' && data.allTypers) {
              setActiveTypers(data.allTypers);
            } else if (data.type === 'typing:update') {
              const { dialogId, typers } = data;
              if (dialogId) {
                setActiveTypers((prev) => {
                  const prevTypers = prev[dialogId] || [];
                  const isNewlyTyping = prevTypers.length === 0 && Array.isArray(typers) && typers.length > 0;
                  if (isNewlyTyping && (selectedDialogId === dialogId || selectedDialog?.dialogId === dialogId)) {
                    const notMe = typers.some((t: TypingUser) => t.agentId !== currentAgent?.id && t.name !== currentAgent?.name);
                    if (notMe) playTypingBlipSound();
                  }
                  return {
                    ...prev,
                    [dialogId]: typers || [],
                  };
                });
              }
            } else if (data.type === 'message:new') {
              const msg = data.message;
              handleIncomingMessageAlert(data.dialogId, data.dialog, msg);
              const targetId = data.dialogId || data.dialog?.id;
              const isActiveChannel =
                Boolean(targetId) &&
                ((selectedDialogId && (selectedDialogId === targetId || String(selectedDialogId) === String(targetId))) ||
                  (selectedDialog &&
                    (selectedDialog.id === targetId ||
                      selectedDialog.dialogId === targetId ||
                      String(selectedDialog.id) === String(targetId) ||
                      String(selectedDialog.dialogId) === String(targetId))));

              if (isActiveChannel && msg) {
                setSelectedDialog((prev) => {
                  if (!prev) return prev;
                  if (
                    prev.id !== targetId &&
                    prev.dialogId !== targetId &&
                    String(prev.id) !== String(targetId) &&
                    String(prev.dialogId) !== String(targetId)
                  ) {
                    return prev;
                  }
                  const messageAlreadyPresent = prev.messages.some(
                    (m) =>
                      m.id === msg.id ||
                      (msg.text &&
                        m.text === msg.text &&
                        Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
                  );
                  if (messageAlreadyPresent) {
                    return data.dialog ? { ...prev, ...data.dialog } : prev;
                  }
                  return {
                    ...prev,
                    ...(data.dialog || {}),
                    messages: [...prev.messages, msg],
                    lastMessageText: msg.text || prev.lastMessageText,
                    lastMessageTime: msg.timestamp || prev.lastMessageTime,
                    lastMessageSender: msg.sender || prev.lastMessageSender,
                    unreadCount: 0,
                  };
                });
                scrollToBottom('smooth');
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!isCleanedUp) {
            setIsWsConnected(false);
            reconnectTimeout = setTimeout(connectWebSocket, 3500);
          }
        };

        ws.onerror = () => {
          try {
            ws?.close();
          } catch {}
        };
      } catch (err) {
        if (!isCleanedUp) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    // Periodic heartbeat to refresh typing states
    const pollTypersTimer = setInterval(() => {
      fetch('/api/chats/typing/all')
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setActiveTypers(res.data);
          }
        })
        .catch(() => {});
    }, 6000);

    return () => {
      isCleanedUp = true;
      clearInterval(pollTypersTimer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      try {
        ws?.close();
      } catch {}
    };
  }, [selectedDialogId, selectedDialog, currentAgent?.id, currentAgent?.name]);

  // Broadcast typing status
  const sendTypingStatus = (isTyping: boolean) => {
    if (!selectedDialogId || !currentAgent) return;

    const payload = {
      type: 'typing',
      dialogId: selectedDialogId,
      isTyping,
      agentId: currentAgent.id,
      name: currentAgent.name,
      role: 'agent',
      avatar: currentAgent.avatar,
    };

    // Send via WebSocket (instant <10ms)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch {}
    }

    // Also send via REST API for server-side persistence & SSE fallback
    fetch(`/api/chats/${selectedDialogId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  // Handle typing inside message input with throttled heartbeat
  const handleInputTyping = (text: string) => {
    setInputText(text);
    unlockAudioContext();
    if (sendErrorMessage) setSendErrorMessage(null);

    if (!selectedDialogId || !currentAgent) return;

    if (text.trim().length > 0) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 1800) {
        lastTypingSentRef.current = now;
        sendTypingStatus(true);
      }

      if (typingHeartbeatTimeoutRef.current) {
        clearTimeout(typingHeartbeatTimeoutRef.current);
      }
      typingHeartbeatTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2500);
    } else {
      if (typingHeartbeatTimeoutRef.current) {
        clearTimeout(typingHeartbeatTimeoutRef.current);
      }
      sendTypingStatus(false);
    }
  };

  // Toggle sound feedback
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setChatSoundEnabled(next);
    if (next) {
      testChatSound();
    }
  };

  // 4. Prioritize active chat on server and fetch immediate state once on chat switch
  useEffect(() => {
    if (!selectedDialogId) return;

    // Notify backend about active chat for prioritized background polling
    fetch('/api/chats/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: selectedDialogId }),
    }).catch(() => {});

    // Instant sync on opening a chat, followed by periodic fast refresh (1000ms)
    let isSubscribed = true;
    const syncActive = () => {
      fetch(`/api/chats/${selectedDialogId}/sync`, { method: 'POST' })
        .then((r) => r.json())
        .then((json) => {
          if (!isSubscribed) return;
          if (json.success && json.data) {
            const freshDialog: ChatDialog = json.data;
            setSelectedDialog((prev) => {
              if (!prev || prev.id !== freshDialog.id) return prev;
              if (
                freshDialog.messages.length !== prev.messages.length ||
                freshDialog.lastMessageTime !== prev.lastMessageTime ||
                freshDialog.status !== prev.status
              ) {
                return { ...prev, ...freshDialog };
              }
              return prev;
            });
            setDialogs((prev) =>
              prev.map((d) => (d.id === freshDialog.id ? { ...d, ...freshDialog } : d))
            );
          }
        })
        .catch(() => {});
    };

    syncActive();
    const activePollTimer = setInterval(syncActive, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(activePollTimer);
    };
  }, [selectedDialogId]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      loadDialogs();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Auto-scroll-to-bottom effect in the chat message thread:
  // - Triggers whenever a new message is received or added in the active channel
  // - Snaps to the bottom immediately when switching to another active conversation
  useEffect(() => {
    if (!messagesContainerRef.current || !selectedDialog) return;

    const messages = selectedDialog.messages || [];
    const currentMsgCount = messages.length;
    const lastMsg = currentMsgCount > 0 ? messages[currentMsgCount - 1] : null;
    const lastMsgKey = lastMsg ? `${lastMsg.id || ''}-${lastMsg.timestamp || ''}` : '';

    const isDifferentDialog = prevDialogIdRef.current !== selectedDialog.id;
    const hasNewMessages =
      currentMsgCount > prevMessageCountRef.current ||
      (lastMsgKey !== '' && lastMsgKey !== prevLastMessageKeyRef.current);

    prevDialogIdRef.current = selectedDialog.id;
    prevMessageCountRef.current = currentMsgCount;
    prevLastMessageKeyRef.current = lastMsgKey;

    if (isDifferentDialog) {
      // Switched to a new or different conversation: always snap immediately to bottom
      scrollToBottom('auto');
    } else if (hasNewMessages) {
      // New message received in the active channel: trigger smooth auto-scroll to bottom
      scrollToBottom('smooth');
    }
  }, [
    selectedDialog?.id,
    selectedDialog?.messages?.length,
    selectedDialog?.messages?.[(selectedDialog?.messages?.length || 1) - 1]?.id,
    selectedDialog?.messages?.[(selectedDialog?.messages?.length || 1) - 1]?.timestamp,
  ]);

  // When active typing indicator appears in current channel, smoothly ensure it is visible if already at bottom
  useEffect(() => {
    if (!selectedDialog) return;
    const currentTypers = (
      activeTypers[selectedDialog.id] ||
      (selectedDialog.dialogId ? activeTypers[selectedDialog.dialogId] : null) ||
      []
    ).filter((t: TypingUser) => t.agentId !== currentAgent?.id);

    if (currentTypers.length > 0 && isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [activeTypers, selectedDialog?.id, selectedDialog?.dialogId, currentAgent?.id]);

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

    // Stop typing status immediately and play outgoing sound
    if (typingHeartbeatTimeoutRef.current) {
      clearTimeout(typingHeartbeatTimeoutRef.current);
    }
    sendTypingStatus(false);
    playOutgoingMessageSound();

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
    if (!selectedDialog) return;
    setSendErrorMessage(null);

    // Fallback if currentAgent is not yet available in props
    let agent = currentAgent;
    if (!agent) {
      try {
        const wt = await fetch('/api/worktime/status').then((r) => r.json());
        if (wt.success && wt.data?.currentAgent) {
          agent = wt.data.currentAgent;
        }
      } catch (err) {
        console.error('Failed to get currentAgent:', err);
      }
    }

    if (!agent) {
      setSendErrorMessage('Операторын мэдээлэл олдсонгүй. Дахин нэвтэрнэ үү.');
      return;
    }

    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAgentId: agent.id,
          assignedAgentName: agent.name,
          assignedAgentAvatar: agent.avatar,
          status: 'in_progress',
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      }
    } catch (e) {
      console.error('Failed to take dialog:', e);
    }
  };

  // Connect AI Bot to dialog (or Return dialog back to AI Bot)
  const handleConnectBot = async () => {
    if (!selectedDialog) return;
    setIsBotActionLoading(true);
    try {
      const res = await apiFetch(`/api/chats/${selectedDialog.id}/connect-bot`, {
        method: 'POST',
      });

      if (res?.success && res.data) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      }
    } catch (e) {
      console.error('Failed to connect bot to dialog:', e);
    } finally {
      setIsBotActionLoading(false);
    }
  };

  // Detach bot from dialog (Send to operator queue)
  const handleDetachBot = async () => {
    if (!selectedDialog) return;
    setIsBotActionLoading(true);
    try {
      const res = await apiFetch(`/api/chats/${selectedDialog.id}/detach-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: currentAgent?.name || 'Оператор' }),
      });

      if (res?.success && res.data) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      }
    } catch (e) {
      console.error('Failed to detach bot from dialog:', e);
    } finally {
      setIsBotActionLoading(false);
    }
  };

  const handleReturnToBot = handleConnectBot;

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

  // Close / Resolve dialog with CRM Lead/Deal actions
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
          leadAction: closeLeadAction,
          dealData:
            closeLeadAction === 'create_deal'
              ? {
                  title: closeDealTitle.trim() || `Хэлцэл: ${selectedDialog.customer.name}`,
                  amount: Number(closeDealAmount) || 0,
                  currency: 'MNT',
                  stageId: closeDealStage || 'NEW',
                  comments: `Шийдвэрлэлт: ${closeReason}`,
                }
              : undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSelectedDialog(res.data);
        setDialogs((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
        setShowCloseModal(false);

        let actionMsg = 'Чат амжилттай хаагдлаа.';
        if (closeLeadAction === 'close_converted') {
          actionMsg = 'Чат хаагдаж, Bitrix Lead төлөв "Амжилттай / Converted" боллоо.';
        } else if (closeLeadAction === 'create_deal') {
          actionMsg = 'Чат хаагдаж, Bitrix24 CRM дээр шинэ хэлцэл амжилттай үүслээ.';
        } else if (closeLeadAction === 'close_junk') {
          actionMsg = 'Чат хаагдаж, Bitrix Lead "Хэрэггүй сэжим (Junk)" төлөвт шилжлээ.';
        }

        setCrmNotification({
          type: 'success',
          message: actionMsg,
        });
      }
    } catch (e) {
      console.error('Failed to close dialog:', e);
    }
  };

  // Standalone Deal creation
  const handleCreateDeal = async () => {
    if (!selectedDialog || !createDealTitle.trim()) return;
    setIsSubmittingDeal(true);
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/create-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createDealTitle.trim(),
          amount: Number(createDealAmount) || 0,
          currency: 'MNT',
          stageId: createDealStage,
          comments: createDealComments,
          convertLead: createDealConvertLead,
          operatorName: currentAgent?.name || 'Оператор',
        }),
      }).then((r) => r.json());

      if (res.success) {
        if (res.data?.dialog) {
          setSelectedDialog(res.data.dialog);
          setDialogs((prev) => prev.map((d) => (d.id === res.data.dialog.id ? res.data.dialog : d)));
        }
        setShowCreateDealModal(false);
        setCrmNotification({
          type: 'success',
          message: `Bitrix24 CRM дээр DEAL-${res.data?.deal?.id} (${createDealTitle}) амжилттай үүслээ!`,
          url: res.data?.portalUrl,
        });
      } else {
        alert(res.error?.message || 'Хэлцэл үүсгэхэд алдаа гарлаа');
      }
    } catch (e: any) {
      console.error('Failed to create deal:', e);
      alert('Хэлцэл үүсгэхэд алдаа гарлаа: ' + e.message);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  // Quick Lead status update
  const handleUpdateLeadStatus = async (stageId: string, label: string) => {
    if (!selectedDialog) return;
    setIsUpdatingLeadStatus(true);
    try {
      const res = await fetch(`/api/chats/${selectedDialog.id}/lead-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          comment: `Оператор төлөв шинэчилсэн: ${label}`,
          operatorName: currentAgent?.name || 'Оператор',
        }),
      }).then((r) => r.json());

      if (res.success) {
        if (res.data?.dialog) {
          setSelectedDialog(res.data.dialog);
          setDialogs((prev) => prev.map((d) => (d.id === res.data.dialog.id ? res.data.dialog : d)));
        }
        setCrmNotification({
          type: 'success',
          message: `Bitrix Lead төлөв "${label}" болж амжилттай шинэчлэгдлээ!`,
          url: res.data?.portalUrl,
        });
      } else {
        alert(res.error?.message || 'Lead төлөв шинэчлэхэд алдаа гарлаа');
      }
    } catch (e: any) {
      console.error('Failed to update lead status:', e);
    } finally {
      setIsUpdatingLeadStatus(false);
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

  // AI Suggestion based on customer last message and conversation context
  const handleAISuggest = async () => {
    if (!selectedDialog) return;
    const lastCustomerMsg = [...selectedDialog.messages].reverse().find((m) => m.sender === 'customer');
    const queryText = lastCustomerMsg?.text || selectedDialog.lastMessageText;

    try {
      setIsSuggestingAI(true);
      const res = await fetch('/api/chats/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          dialogId: selectedDialog.dialogId || selectedDialog.id,
          conversation: (selectedDialog.messages || []).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
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
        return (
          (d.status === 'in_progress' || d.status === 'assigned') &&
          (d.assignedAgentId === currentAgent?.id || isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent))
        );
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

  const isAgent = currentAgent?.accessRole === 'agent';

  // Agent-specific accessible dialogs pool:
  // ONLY unassigned in assigned channels, chats handled by this agent, and chats closed by this agent
  const agentAccessibleDialogs = useMemo(() => {
    if (!isAgent || !currentAgent) return dialogs;
    let list = dialogs;
    if (!currentAgent.canAccessAllChannels && Array.isArray(currentAgent.assignedChannelIds)) {
      const allowed = currentAgent.assignedChannelIds.map(String);
      list = list.filter((d) => allowed.includes(String(d.channelId)));
    }
    return list.filter((d) => {
      const isUnassigned = !d.assignedAgentId || d.status === 'new' || d.assignedAgentId === 'unassigned';
      const isMine =
        d.assignedAgentId === currentAgent.id ||
        isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent) ||
        isMyClosedDialog(d, currentAgent);
      return isUnassigned || isMine;
    });
  }, [dialogs, currentAgent, isAgent]);

  const unassignedCount = (isAgent ? agentAccessibleDialogs : dialogs).filter((d) => d.status === 'new').length;
  const myActiveCount = (isAgent ? agentAccessibleDialogs : dialogs).filter(
    (d) =>
      (d.status === 'in_progress' || d.status === 'assigned') &&
      (d.assignedAgentId === currentAgent?.id || isAgentMatch(d.assignedAgentId, d.assignedAgentName, currentAgent))
  ).length;
  const myClosedCount = (isAgent ? agentAccessibleDialogs : dialogs).filter((d) => d.status === 'closed' && isMyClosedDialog(d, currentAgent)).length;
  const botCount = dialogs.filter((d) => d.status === 'bot').length;
  const allClosedCount = dialogs.filter((d) => d.status === 'closed').length;
  const starredCount = (isAgent ? agentAccessibleDialogs : dialogs).filter((d) => Boolean(d.isStarred)).length;

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 h-full bg-white border-0 ${isAgent ? 'sm:border-t sm:border-slate-200 rounded-none m-0' : 'sm:border border-slate-200 rounded-none sm:rounded-2xl shadow-none sm:shadow-sm m-0 sm:m-3 lg:m-4'} overflow-hidden`}>
      {/* Subtle In-App Floating Alert for New Inquiries in Assigned Channels */}
      {newInquiryBanner && (
        <div
          id="new-inquiry-floating-alert"
          role="alert"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-xl shadow-xl border border-slate-700/60 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/40">
            <BellRing className="w-4 h-4 animate-bounce" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">
                {newInquiryBanner.customerName}
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30 shrink-0 font-medium">
                {newInquiryBanner.channelName}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate max-w-xs mt-0.5">
              {newInquiryBanner.text}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="view-new-inquiry-btn"
              onClick={() => {
                setSelectedDialogId(newInquiryBanner.id);
                setSelectedDialog(newInquiryBanner.dialog);
                setMobileView('chat');
                setNewInquiryBanner(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Харах
            </button>
            <button
              type="button"
              id="dismiss-new-inquiry-btn"
              onClick={() => setNewInquiryBanner(null)}
              className="p-1 rounded-md text-slate-400 hover:text-white transition cursor-pointer"
              title="Хаах"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 h-full overflow-hidden">
        {/* ========================================================
            COLUMN 1: CHATS LIST & FILTERS (Left)
           ======================================================== */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 border-r border-slate-200 flex-col bg-slate-50/50 shrink-0 min-h-0 h-full overflow-hidden`}>
          {/* Top Bar: Title & Controls */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
              <h2 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                {isAgent ? 'Миний ажлын чат' : 'Бүх чат'}
              </h2>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-semibold shrink-0">
                {isAgent ? agentAccessibleDialogs.length : dialogs.length}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 transition-colors ${
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
                <span className="hidden sm:inline">{isRealtimeConnected ? 'Real-time' : 'Delta'}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                id="chat-sound-toggle-btn"
                onClick={handleToggleSound}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  soundEnabled
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                }`}
                title={soundEnabled ? 'Дуут мэдэгдэл асаалттай (Дарж унтраах)' : 'Дуут мэдэгдэл унтраалттай (Дарж асаах)'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="hidden sm:inline">{soundEnabled ? 'Дуу' : 'Чимээгүй'}</span>
              </button>
              <button
                type="button"
                id="browser-notification-toggle-btn"
                onClick={handleToggleBrowserNotif}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  browserNotifEnabled && notifPermission === 'granted'
                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                }`}
                title={
                  notifPermission === 'granted'
                    ? browserNotifEnabled
                      ? 'Шинэ чатын мэдэгдэл идэвхтэй (Дарж унтраах)'
                      : 'Шинэ чатын мэдэгдэл унтраалттай (Дарж асаах)'
                    : notifPermission === 'denied'
                    ? 'Браузер мэдэгдэл хаагдсан байна'
                    : 'Шинэ чат ирэх үед Браузер мэдэгдэл авах (Дарж зөвшөөрөх)'
                }
              >
                {browserNotifEnabled && notifPermission === 'granted' ? (
                  <BellRing className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="hidden sm:inline">Мэдэгдэл</span>
              </button>
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
                        {line.name}
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
              {!isAgent && botConfig?.selectedLineId && (
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
            {/* Supervisor / Admin only: All chats tab */}
            {!isAgent && (
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
            )}

            {/* Agent: My chats first; Supervisor: Queue first */}
            {isAgent ? (
              <>
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
              </>
            ) : (
              <>
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
              </>
            )}

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

            {!isAgent && (
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
            )}

            {!isAgent && (
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
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                const fb = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fb) fb.style.display = 'flex';
                              }}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : null}
                          <div
                            style={{ display: d.customer.avatar ? 'none' : 'flex' }}
                            className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 select-none shadow-xs"
                          >
                            {d.customer.name ? d.customer.name.slice(0, 2).toUpperCase() : 'ХА'}
                          </div>
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

                    {/* Last message preview or live typing indicator */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {(() => {
                        const typers = activeTypers[d.id] || (d.dialogId ? activeTypers[d.dialogId] : null) || [];
                        if (typers.length > 0) {
                          return (
                            <p className="text-xs truncate flex-1 text-blue-600 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </span>
                              <span className="truncate">
                                {typers[0].name} бичиж байна...
                              </span>
                            </p>
                          );
                        }

                        return (
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
                        );
                      })()}

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
                        {(d.status === 'bot' || d.botActive) && d.status !== 'closed' && (
                          <span
                            className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium flex items-center gap-1 shrink-0"
                            title="AI Туслах бот энэ чатад холбогдсон"
                          >
                            <Bot className="w-2.5 h-2.5 text-purple-600" />
                            <span>Бот идэвхтэй</span>
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
            {/* Header (Matched exactly to image.png) */}
            <div className="p-3 sm:p-3.5 px-3 sm:px-5 border-b border-slate-200 bg-white shadow-xs shrink-0 flex flex-col gap-2.5">
              {/* Row 1: Customer Profile, Status, Channel Subtitle & 6 оператор badge */}
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    {selectedDialog.customer.avatar ? (
                      <img
                        src={selectedDialog.customer.avatar}
                        alt={selectedDialog.customer.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                          const fb = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fb) fb.style.display = 'flex';
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : null}
                    <div
                      style={{ display: selectedDialog.customer.avatar ? 'none' : 'flex' }}
                      className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm border border-slate-200 shrink-0 select-none shadow-xs"
                    >
                      {selectedDialog.customer.name ? selectedDialog.customer.name.slice(0, 2).toUpperCase() : 'ХА'}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getChannelBadge(selectedDialog.channelType).dot}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {selectedDialog.customer.name}
                      </h3>
                      <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border shrink-0 ${getStatusBadge(selectedDialog.status).color}`}>
                        {getStatusBadge(selectedDialog.status).label}
                      </span>
                      {selectedDialog.status === 'in_progress' && (
                        <span
                          className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0"
                          title="Оператор чатыг өөртөө авсан тул бот салсан"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Бот салсан</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 sm:gap-2 flex-wrap mt-0.5">
                      <span className="font-medium text-slate-600 truncate">{selectedDialog.channelName}</span>
                      <span className="text-slate-300 shrink-0">•</span>
                      <span className="font-mono text-xs text-slate-400 shrink-0">ID: {selectedDialog.dialogId}</span>
                      {(() => {
                        const line = openLines.find(
                          (l) => String(l.id) === selectedDialog.channelId || l.name === selectedDialog.channelName
                        );
                        const agents = line?.assignedAgents || [];
                        const count = agents.length > 0 ? agents.length : (openLines.length > 0 ? 6 : 0);
                        if (!count) return null;
                        return (
                          <>
                            <span className="text-slate-300 shrink-0">•</span>
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200 shrink-0"
                              title={agents.length > 0 ? `Битрикс24 дээр энэ сувагт оноогдсон операторууд:\n${agents.map((a) => `• ${a.fullName} (${a.workPosition}) - ${a.status}`).join('\n')}` : 'Энэ нээлттэй сувагт 6 оператор оноогдсон байна'}
                            >
                              <Users className="w-3 h-3 text-blue-500" />
                              <span>{count} оператор</span>
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* CRM Details toggle for tablet/mobile */}
                <div className="flex items-center gap-1.5 shrink-0 xl:hidden">
                  <button
                    type="button"
                    onClick={() => setShowMobileDetails(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition"
                    title="Харилцагчийн CRM мэдээлэл харах"
                  >
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>CRM</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Action Buttons Bar (Exact layout and colors from image.png) */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 shrink-0">
                {/* 1. Take Dialog Button (Green solid) */}
                {selectedDialog.status !== 'closed' && !isAgentMatch(selectedDialog.assignedAgentId, selectedDialog.assignedAgentName, currentAgent) && (
                  <button
                    id="take-dialog-btn"
                    onClick={handleTakeDialog}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs active:scale-95 cursor-pointer shrink-0"
                    title={selectedDialog.status === 'bot' || selectedDialog.botActive ? "Чатыг өөртөө авч, ботыг салгах" : "Чатыг өөртөө авах"}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Өөртөө авах</span>
                  </button>
                )}

                {/* 2. Bot Connect/Detach Button (Light purple/rose) */}
                {selectedDialog.status !== 'closed' && (
                  <>
                    {(selectedDialog.status === 'bot' || selectedDialog.botActive) ? (
                      <button
                        id="detach-bot-btn"
                        type="button"
                        onClick={handleDetachBot}
                        disabled={isBotActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition disabled:opacity-50 shadow-2xs shrink-0 cursor-pointer"
                        title="Ботыг энэ чатнаас салгаж, операторын дараалалд шилжүүлэх"
                      >
                        <Bot className="w-3.5 h-3.5 text-rose-600" />
                        <span>{isBotActionLoading ? 'Салгаж байна...' : '🤖 Бот салгах'}</span>
                      </button>
                    ) : (
                      <button
                        id="connect-bot-btn"
                        type="button"
                        onClick={handleConnectBot}
                        disabled={isBotActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition disabled:opacity-50 shadow-2xs shrink-0 cursor-pointer"
                        title="Энэ тухайлсан чатад AI Туслах Бот холбох"
                      >
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>{isBotActionLoading ? 'Холбож байна...' : '🤖 Бот холбох'}</span>
                      </button>
                    )}
                  </>
                )}

                {/* 3. Create Deal Button (Light blue) */}
                <button
                  id="create-deal-header-btn"
                  type="button"
                  onClick={() => {
                    setCreateDealTitle(`${selectedDialog.customer.name} - Захиалга`);
                    setCreateDealAmount('');
                    setCreateDealStage('NEW');
                    setCreateDealComments('');
                    setCreateDealConvertLead(true);
                    setShowCreateDealModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition shadow-2xs shrink-0 cursor-pointer"
                  title="Bitrix24 CRM дээр шинэ хэлцэл (Deal) үүсгэх"
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>Deal үүсгэх</span>
                </button>

                {/* 4. Transfer Button (Light slate) */}
                <button
                  id="transfer-dialog-btn"
                  onClick={() => setShowTransferModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition shadow-2xs shrink-0 cursor-pointer"
                  title="Өөр операторт шилжүүлэх"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Шилжүүлэх</span>
                </button>

                {/* 5. Close / Reopen Dialog Button */}
                {selectedDialog.status !== 'closed' ? (
                  <button
                    id="close-dialog-btn"
                    onClick={() => {
                      setCloseDealTitle(`${selectedDialog.customer.name} - Захиалга`);
                      setCloseDealAmount('');
                      setCloseDealStage('NEW');
                      if (selectedDialog.customer?.crmLeadId) {
                        setCloseLeadAction('close_converted');
                      } else {
                        setCloseLeadAction('keep_open');
                      }
                      setShowCloseModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-200 text-xs font-medium transition shadow-2xs shrink-0 cursor-pointer"
                    title="Чатыг хаах, дуусгах"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Хаах</span>
                  </button>
                ) : (
                  <button
                    id="reopen-dialog-btn"
                    onClick={handleReopenDialog}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition shadow-2xs shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Дахин нээх</span>
                  </button>
                )}

                {/* 6. Star toggle */}
                <button
                  onClick={() => handleToggleStar(selectedDialog.id, Boolean(selectedDialog.isStarred))}
                  className={`p-1.5 px-2 rounded-lg border transition shrink-0 cursor-pointer ${
                    selectedDialog.isStarred
                      ? 'bg-amber-50 border-amber-300 text-amber-500'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500'
                  }`}
                  title={selectedDialog.isStarred ? 'Од хасах' : 'Од өгөх'}
                >
                  <Star className={`w-3.5 h-3.5 ${selectedDialog.isStarred ? 'fill-current' : ''}`} />
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
                    <span className="hidden sm:inline-block text-[11px] text-purple-700 bg-purple-100/60 px-2.5 py-1 rounded-md border border-purple-200/80">
                      Хүссэн үедээ дээр байрлах "Өөртөө авах" товчоор чатыг хариуцаж болно
                    </span>
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
                  const isBotEvent =
                    msg.text.includes('🤖') ||
                    msg.text.includes('Бот') ||
                    msg.text.includes('ботыг') ||
                    msg.text.includes('шилжүүллээ') ||
                    msg.text.includes('гарч');
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div
                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium max-w-lg text-center shadow-2xs flex items-center gap-1.5 ${
                          isBotEvent
                            ? 'bg-purple-50 text-purple-900 border border-purple-200 font-semibold'
                            : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {isBotEvent && <Bot className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                        <span>{msg.text}</span>
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
                        <FormattedMessageText text={msg.text} isOperator={!isCustomer && !isBot} />

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

              {/* Real-time Agent/Customer is typing... Indicator Bubble */}
              {(() => {
                const currentTypers = (
                  activeTypers[selectedDialog.id] ||
                  (selectedDialog.dialogId ? activeTypers[selectedDialog.dialogId] : null) ||
                  []
                ).filter((t: TypingUser) => t.agentId !== currentAgent?.id);

                if (currentTypers.length === 0) return null;

                return (
                  <div id="realtime-typing-indicator-feed" className="flex items-end gap-2.5 justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0 shadow-2xs">
                      {currentTypers[0].role === 'customer' ? (
                        selectedDialog.customer?.avatar ? (
                          <img src={selectedDialog.customer.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          selectedDialog.customer?.name ? selectedDialog.customer.name.slice(0, 2).toUpperCase() : 'ХА'
                        )
                      ) : (
                        <UserCheck className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-xs flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        <span className="font-semibold text-slate-800">{currentTypers.map((t) => t.name).join(', ')}</span> бичиж байна...
                      </span>
                    </div>
                  </div>
                );
              })()}

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
                    <div id="unassigned-chat-warning-banner" className="flex items-center gap-2.5 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-amber-950 truncate">
                          {selectedDialog.status === 'new' || !selectedDialog.assignedAgentId
                            ? 'Энэ чат операторт оноогдоогүй байна'
                            : `Чат өөр операторт оноогдсон байна (${selectedDialog.assignedAgentName || 'Оператор'})`}
                        </p>
                        <p className="text-[11px] text-amber-700">
                          Харилцагчид хариу бичихийн тулд дээд талын <span className="font-semibold text-emerald-800">"Өөртөө авах"</span> товчийг дарна уу.
                        </p>
                      </div>
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

                  {/* MeiliSearch BSB Product Search */}
                  <button
                    type="button"
                    id="open-product-search-modal-btn"
                    onClick={() => setShowProductSearchModal(true)}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition"
                    title="БСБ MeiliSearch сангаас бараа хайж үнэ оруулах"
                  >
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">Бараа хайх</span>
                    <span className="sm:hidden">Бараа</span>
                  </button>
                </div>
              </div>

              {/* Real-time typing status bar above composer if active */}
              {(() => {
                const currentTypers = (
                  activeTypers[selectedDialog.id] ||
                  (selectedDialog.dialogId ? activeTypers[selectedDialog.dialogId] : null) ||
                  []
                ).filter((t: TypingUser) => t.agentId !== currentAgent?.id);

                if (currentTypers.length === 0) return null;

                return (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      <span className="font-semibold text-[11px]">
                        {currentTypers.map((t) => t.name).join(', ')} бичиж байна...
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                );
              })()}

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
                        ref={chatInputRef}
                        id="chat-message-input"
                        value={inputText}
                        onChange={(e) => {
                          handleInputTyping(e.target.value);
                        }}
                        onBlur={() => {
                          sendTypingStatus(false);
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
                            ? 'Хариу бичихийн тулд эхлээд дээд талын "Өөртөө авах" товчийг дарна уу...'
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
                            disabled
                            className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-200 cursor-not-allowed"
                            title="Дээр байрлах 'Өөртөө авах' товчоор эхлээд чатыг өөртөө онооно уу"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Илгээх</span>
                            <span className="sm:hidden">Илгээх</span>
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
              Зүүн талын жагсаалтаас харилцан яриаг сонгож харилцагчид хариу бичнэ үү.
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
              <div className="relative inline-block mx-auto mb-2">
                {selectedDialog.customer.avatar ? (
                  <img
                    src={selectedDialog.customer.avatar}
                    alt={selectedDialog.customer.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fb = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fb) fb.style.display = 'flex';
                    }}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-xs"
                  />
                ) : null}
                <div
                  style={{ display: selectedDialog.customer.avatar ? 'none' : 'flex' }}
                  className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl border-2 border-slate-100 shadow-xs select-none"
                >
                  {selectedDialog.customer.name ? selectedDialog.customer.name.slice(0, 2).toUpperCase() : 'ХА'}
                </div>
              </div>
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
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  Bitrix24 CRM
                </span>
                <button
                  type="button"
                  id="right-panel-create-deal-btn"
                  onClick={() => {
                    setCreateDealTitle(`${selectedDialog.customer.name} - Захиалга`);
                    setCreateDealAmount('');
                    setCreateDealStage('NEW');
                    setCreateDealComments('');
                    setCreateDealConvertLead(true);
                    setShowCreateDealModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition shadow-2xs cursor-pointer"
                  title="Энэ харилцагч дээр Deal (Хэлцэл) үүсгэх"
                >
                  <Plus className="w-3 h-3" />
                  <span>Deal үүсгэх</span>
                </button>
              </div>

              {/* CRM Lead / Deal reference */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px] font-medium">CRM Холболт:</span>
                  {selectedDialog.customer.crmLeadId ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                          selectedDialog.customer.crmLeadId.startsWith('DEAL-')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {selectedDialog.customer.crmLeadId}
                      </span>
                      {(() => {
                        const crmId = selectedDialog.customer.crmLeadId;
                        const num = crmId.replace(/\D/g, '');
                        if (!num) return null;
                        const isDeal = crmId.startsWith('DEAL-');
                        const url = isDeal
                          ? `https://bsb.bitrix24.com/crm/deal/details/${num}/`
                          : `https://bsb.bitrix24.com/crm/lead/details/${num}/`;
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                            title={`Bitrix24 ${isDeal ? 'Хэлцэл' : 'Сэжим'} дээр нээх`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal italic text-[11px]">
                      Холбогдоогүй
                    </span>
                  )}
                </div>

                {/* Quick Lead status switch if customer has a Lead */}
                {selectedDialog.customer.crmLeadId && selectedDialog.customer.crmLeadId.startsWith('LEAD-') && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500 font-medium">Lead хаах:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isUpdatingLeadStatus}
                        onClick={() => handleUpdateLeadStatus('CONVERTED', 'Амжилттай')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
                        title="Lead-ийг Амжилттай (Converted) болгох"
                      >
                        ✓ Амжилттай
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingLeadStatus}
                        onClick={() => handleUpdateLeadStatus('JUNK', 'Ашиггүй')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-50"
                        title="Lead-ийг Ашиггүй (Junk) болгох"
                      >
                        ✕ Цуцлах
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-slate-500 pt-0.5">
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
              <div className="relative inline-block mx-auto mb-2">
                {selectedDialog.customer.avatar ? (
                  <img
                    src={selectedDialog.customer.avatar}
                    alt={selectedDialog.customer.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fb = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fb) fb.style.display = 'flex';
                    }}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-xs"
                  />
                ) : null}
                <div
                  style={{ display: selectedDialog.customer.avatar ? 'none' : 'flex' }}
                  className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl border-2 border-slate-100 shadow-xs select-none"
                >
                  {selectedDialog.customer.name ? selectedDialog.customer.name.slice(0, 2).toUpperCase() : 'ХА'}
                </div>
              </div>
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
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  Bitrix24 CRM
                </span>
                <button
                  type="button"
                  id="mobile-drawer-create-deal-btn"
                  onClick={() => {
                    setCreateDealTitle(`${selectedDialog.customer.name} - Захиалга`);
                    setCreateDealAmount('');
                    setCreateDealStage('NEW');
                    setCreateDealComments('');
                    setCreateDealConvertLead(true);
                    setShowCreateDealModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition shadow-2xs"
                  title="Энэ харилцагч дээр Deal (Хэлцэл) үүсгэх"
                >
                  <Plus className="w-3 h-3" />
                  <span>Deal үүсгэх</span>
                </button>
              </div>

              {/* CRM Lead / Deal reference */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px] font-medium">CRM Холболт:</span>
                  {selectedDialog.customer.crmLeadId ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                          selectedDialog.customer.crmLeadId.startsWith('DEAL-')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {selectedDialog.customer.crmLeadId}
                      </span>
                      {(() => {
                        const crmId = selectedDialog.customer.crmLeadId;
                        const num = crmId.replace(/\D/g, '');
                        if (!num) return null;
                        const isDeal = crmId.startsWith('DEAL-');
                        const url = isDeal
                          ? `https://bsb.bitrix24.com/crm/deal/details/${num}/`
                          : `https://bsb.bitrix24.com/crm/lead/details/${num}/`;
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                            title={`Bitrix24 ${isDeal ? 'Хэлцэл' : 'Сэжим'} дээр нээх`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal italic text-[11px]">
                      Холбогдоогүй
                    </span>
                  )}
                </div>

                {/* Quick Lead status switch if customer has a Lead */}
                {selectedDialog.customer.crmLeadId && selectedDialog.customer.crmLeadId.startsWith('LEAD-') && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500 font-medium">Lead хаах:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isUpdatingLeadStatus}
                        onClick={() => handleUpdateLeadStatus('CONVERTED', 'Амжилттай')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
                      >
                        ✓ Амжилттай
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingLeadStatus}
                        onClick={() => handleUpdateLeadStatus('JUNK', 'Ашиггүй')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        ✕ Цуцлах
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-slate-500 pt-0.5">
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

      {/* 2.1 BSB MeiliSearch Product Search Modal */}
      <ProductSearchModal
        isOpen={showProductSearchModal}
        onClose={() => setShowProductSearchModal(false)}
        onInsertProduct={(text) => {
          setInputText((prev) => (prev ? `${prev}\n\n${text}` : text));
          setIsInternalNote(false);
          chatInputRef.current?.focus();
        }}
      />

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

      {/* 4. Close Dialog Modal with Bitrix24 CRM Lead/Deal Action */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-rose-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900">Харилцан яриаг дуусгах / Чатыг хаах</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat resolution reason */}
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">Шийдвэрлэлтийн үндсэн шалтгаан / Тэмдэглэл:</label>
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:border-blue-500 focus:outline-none bg-white"
              >
                <option value="Амжилттай шийдвэрлэсэн">Амжилттай шийдвэрлэсэн</option>
                <option value="Барааны мэдээлэл & Үнэ өгсөн">Барааны мэдээлэл & Үнэ өгсөн</option>
                <option value="Захиалга үүсгэсэн & Төлбөр хийгдсэн">Захиалга үүсгэсэн & Төлбөр хийгдсэн</option>
                <option value="Сервис төв, баталгаа руу чиглүүлсэн">Сервис төв, баталгаа руу чиглүүлсэн</option>
                <option value="Харилцагч хариу өгөөгүй">Харилцагч хариу өгөөгүй</option>
                <option value="Буруу хандсан / Спам">Буруу хандсан / Спам</option>
              </select>
            </div>

            {/* Bitrix24 CRM Lead & Deal options */}
            <div className="space-y-2 text-xs pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bitrix24 CRM Lead & Deal үйлдэл:</span>
                </label>
                {selectedDialog.customer.crmLeadId && (
                  <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedDialog.customer.crmLeadId}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Option 1: Convert Lead */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition ${
                    closeLeadAction === 'close_converted'
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="leadAction"
                    value="close_converted"
                    checked={closeLeadAction === 'close_converted'}
                    onChange={() => setCloseLeadAction('close_converted')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Lead-ийг Амжилттай болгож хаах (Converted)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bitrix24 CRM дээрх сэжмийн төлөвийг "CONVERTED / Амжилттай" болгож хаана.
                    </p>
                  </div>
                </label>

                {/* Option 2: Create Deal */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition ${
                    closeLeadAction === 'create_deal'
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="leadAction"
                    value="create_deal"
                    checked={closeLeadAction === 'create_deal'}
                    onChange={() => setCloseLeadAction('create_deal')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      <span>Шинэ Deal (Хэлцэл) үүсгэж хаах</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bitrix CRM дээр шинэ борлуулалтын хэлцэл үүсгэж, сэжмийг амжилттай болгон холбоно.
                    </p>

                    {/* Sub-inputs when create_deal is selected */}
                    {closeLeadAction === 'create_deal' && (
                      <div className="mt-3 pt-3 border-t border-blue-100 space-y-2.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Хэлцлийн нэр:
                          </label>
                          <input
                            type="text"
                            value={closeDealTitle}
                            onChange={(e) => setCloseDealTitle(e.target.value)}
                            placeholder="Жишээ: LG 55 инч ТВ худалдан авалт"
                            className="w-full p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Үнийн дүн (₮):
                            </label>
                            <input
                              type="number"
                              value={closeDealAmount}
                              onChange={(e) => setCloseDealAmount(e.target.value)}
                              placeholder="0"
                              className="w-full p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Хэлцлийн үе шат:
                            </label>
                            <select
                              value={closeDealStage}
                              onChange={(e) => setCloseDealStage(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-xs"
                            >
                              <option value="NEW">Шинэ (New)</option>
                              <option value="PREPARATION">Санал бэлтгэх (Offer)</option>
                              <option value="PREPAYMENT_INVOICE">Нэхэмжлэх илгээсэн</option>
                              <option value="EXECUTING">Гүйцэтгэж буй</option>
                              <option value="WON">Амжилттай (Deal Won)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 3: Junk Lead */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition ${
                    closeLeadAction === 'close_junk'
                      ? 'border-rose-500 bg-rose-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="leadAction"
                    value="close_junk"
                    checked={closeLeadAction === 'close_junk'}
                    onChange={() => setCloseLeadAction('close_junk')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Хэрэггүй сэжим (Junk) болгож хаах</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bitrix24 CRM сэжмийг "JUNK / Ашиггүй, сонирхолгүй" төлөвт шилжүүлж хаана.
                    </p>
                  </div>
                </label>

                {/* Option 4: Keep Open */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition ${
                    closeLeadAction === 'keep_open'
                      ? 'border-slate-500 bg-slate-100 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="leadAction"
                    value="keep_open"
                    checked={closeLeadAction === 'keep_open'}
                    onChange={() => setCloseLeadAction('keep_open')}
                    className="mt-0.5 text-slate-600 focus:ring-slate-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">
                      Зөвхөн чатыг хаах (Lead-ийг хэвээр үлдээх)
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      CRM сэжмийн одоогийн төлөвийг өөрчлөхгүйгээр зөвхөн энэ харилцан яриаг дуусгана.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Чатыг хаах & Хадгалах</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Create Deal Modal */}
      {showCreateDealModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-blue-600">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Bitrix24 CRM - Шинэ хэлцэл (Deal) үүсгэх</h3>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Портал: bsb.bitrix24.com
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateDealModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer Summary Bar */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900">{selectedDialog.customer.name}</span>
                <div className="text-[11px] text-slate-500">
                  {selectedDialog.customer.phone || selectedDialog.channelName}
                </div>
              </div>
              {selectedDialog.customer.crmLeadId && (
                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {selectedDialog.customer.crmLeadId}
                </span>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Хэлцлийн нэр <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={createDealTitle}
                  onChange={(e) => setCreateDealTitle(e.target.value)}
                  placeholder="Жишээ: LG OLED ТВ 65 инч худалдан авалт"
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none text-xs font-medium"
                />
                {/* Quick title suggestions */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Шуурхай:</span>
                  {[
                    'Электрон бараа захиалга',
                    'Тавилга захиалга',
                    'Компьютер / Ноотбүүк',
                    'Гэр ахуйн цахилгаан бараа',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setCreateDealTitle(`${selectedDialog.customer.name} - ${sug}`)}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Үнийн дүн (₮ MNT):</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={createDealAmount}
                      onChange={(e) => setCreateDealAmount(e.target.value)}
                      placeholder="0"
                      className="w-full p-2.5 pl-7 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none text-xs font-medium"
                    />
                    <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-bold">₮</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Хэлцлийн үе шат (Pipeline stage):</label>
                  <select
                    value={createDealStage}
                    onChange={(e) => setCreateDealStage(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none text-xs font-medium bg-white"
                  >
                    <option value="NEW">Шинэ (New deal)</option>
                    <option value="PREPARATION">Санал бэлтгэх (Offer preparation)</option>
                    <option value="PREPAYMENT_INVOICE">Нэхэмжлэх илгээсэн (Invoice)</option>
                    <option value="EXECUTING">Гүйцэтгэж буй (In execution)</option>
                    <option value="WON">Амжилттай хаагдсан (Won)</option>
                  </select>
                </div>
              </div>

              {/* Lead convert checkbox */}
              {selectedDialog.customer.crmLeadId && selectedDialog.customer.crmLeadId.startsWith('LEAD-') && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createDealConvertLead}
                    onChange={(e) => setCreateDealConvertLead(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-semibold">
                    Холбогдох {selectedDialog.customer.crmLeadId} сэжмийг "Амжилттай / Converted" болгож хаах
                  </span>
                </label>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Нэмэлт тайлбар, тэмдэглэл:</label>
                <textarea
                  value={createDealComments}
                  onChange={(e) => setCreateDealComments(e.target.value)}
                  placeholder="Захиалгын барааны код, хүргэлтийн хаяг гэх мэт..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateDealModal(false)}
                disabled={isSubmittingDeal}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Цуцлах
              </button>
              <button
                type="button"
                id="submit-create-deal-btn"
                disabled={isSubmittingDeal || !createDealTitle.trim()}
                onClick={handleCreateDeal}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{isSubmittingDeal ? 'Үүсгэж байна...' : 'Bitrix дээр Deal үүсгэх'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating CRM Action Toast */}
      {crmNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-slate-100">{crmNotification.message}</p>
            {crmNotification.url && (
              <a
                href={crmNotification.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium underline mt-1.5"
              >
                <span>Bitrix24 CRM дээр нээх</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCrmNotification(null)}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
