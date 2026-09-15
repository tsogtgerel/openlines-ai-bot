export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  updatedAt: string;
}

export interface BotConfig {
  botId: number | null;
  botCode: string;
  botName: string;
  selectedLineId: number | null;
  selectedLineName: string;
  isPollingActive: boolean;
  currentOffset: number | null;
  tone: 'professional' | 'friendly' | 'concise';
  language: string;
  handoffThreshold: number; // 0 to 1
  fallbackMessage: string;
  operatorKeywords: string[];
  systemPromptAddition: string;
  model: string;
}

export interface DialogLog {
  id: string;
  timestamp: string;
  dialogId: string;
  customerMessage: string;
  botAnswer: string;
  handedOff: boolean;
  handoffReason?: 'keyword' | 'low_confidence' | 'ai_error' | 'user_button';
  matchedArticles: { id: string; title: string; score: number }[];
  durationMs: number;
}

export interface ChannelAgent {
  userId: number;
  configId: number;
  channelName?: string;
  name: string;
  lastName?: string;
  fullName: string;
  workPosition: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy' | 'break';
  isOnline: boolean;
  activeSessions: number;
  maxChat: number;
  freeSlots: number;
  email?: string;
  phone?: string;
  lastActivityDate?: string;
}

export interface OpenLineItem {
  id: number;
  name: string;
  active: boolean;
  languageId?: string;
  welcomeBotEnable?: string;
  welcomeBotId?: string | number;
  welcomeBotLeft?: string;
  queueType?: string;
  queueTime?: string;
  crm?: string;
  assignedAgents?: ChannelAgent[];
  operatorsCount?: number;
}

export interface PortalInfo {
  portal: string;
  portalId: string;
  tariffName: string;
  isCommercial: boolean;
}

export interface InfraServer {
  id: string;
  name: string;
  provider: string;
  plan: string;
  region: string;
  status: string;
  blackholeStatus?: string;
  subdomain?: string;
  ip?: string;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'bot' | 'agent' | 'system';
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isInternalNote?: boolean;
  keyboard?: { text: string; action: string }[];
  status?: 'sent' | 'delivered' | 'read';
}

export interface CustomerProfile {
  name: string;
  avatar?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  crmLeadId?: string;
  totalOrders?: number;
  lastOrderDate?: string;
  tags?: string[];
}

export interface ChatDialog {
  id: string;
  dialogId: string;
  customer: CustomerProfile;
  channelId: number | string;
  channelName: string;
  channelType: 'facebook' | 'instagram' | 'telegram' | 'whatsapp' | 'webchat';
  status: 'new' | 'assigned' | 'bot' | 'in_progress' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  assignedAgentAvatar?: string | null;
  closedByAgentId?: string | null;
  closedByAgentName?: string | null;
  closedByAgentAvatar?: string | null;
  lastMessageText: string;
  lastMessageTime: string;
  lastMessageSender: 'customer' | 'bot' | 'agent' | 'system';
  unreadCount: number;
  isStarred?: boolean;
  resolutionSummary?: string;
  closedAt?: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface Agent {
  id: string;
  bitrixUserId?: number;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'busy' | 'break' | 'offline';
  email: string;
  phone: string;
  isClockedIn: boolean;
  isOnBreak: boolean;
  activeShiftId?: string | null;
  assignedChannelIds?: number[];
  assignedChannelNames?: string[];
  activeSessions?: number;
}

export interface WorkShift {
  id: string;
  agentId: string;
  agentName: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string | null;
  isClockedIn: boolean;
  isOnBreak: boolean;
  breakStartTime?: string | null;
  totalBreakSeconds: number;
  workedSeconds: number;
  chatsResolved: number;
  dailyReport?: string;
}

export type InquiryCategory =
  | 'delivery'
  | 'payment_loan'
  | 'product_stock'
  | 'warranty_service'
  | 'b2b_tax'
  | 'store_hours'
  | 'promotions'
  | 'operator_handoff';

export interface CustomerInquiryItem {
  id: string;
  dialogId: string;
  customerName: string;
  channelId: number | string;
  channelName: string;
  channelType: 'facebook' | 'instagram' | 'telegram' | 'whatsapp' | 'webchat';
  text: string;
  timestamp: string;
  category: InquiryCategory;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  resolvedBy?: 'bot' | 'agent' | 'pending';
}

export interface CategoryStat {
  category: InquiryCategory;
  title: string;
  description: string;
  color: string;
  count: number;
  percentage: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    urgent: number;
  };
  topChannels: { channelName: string; count: number }[];
  sampleQueries: string[];
  recommendedAIResponse: string;
  recommendedShortcut?: string;
  actionRecommendation: string;
  inKb: boolean;
}

export interface ChannelStat {
  channelId: number | string;
  channelName: string;
  channelType: string;
  totalInquiries: number;
  percentage: number;
  topCategory: string;
  primaryConcern: string;
  botHandledRate: number;
}

export interface AgentPerformanceStat {
  agentId: string;
  name: string;
  avatar: string;
  role: string;
  email: string;
  status: 'online' | 'busy' | 'break' | 'offline';
  assignedChannels: string[];
  totalChatsHandled: number;
  activeChatsCount: number;
  resolvedChatsCount: number;
  resolutionRate: number; // percentage (e.g. 92%)
  avgResponseTimeSeconds: number; // in seconds (e.g. 78)
  avgResponseTimeFormatted: string; // e.g. "1.3 мин" or "45 сек"
  aiUsageRate: number; // percentage (e.g. 74%)
  aiAssistedChatsCount: number;
  positiveSentimentRate: number; // percentage (e.g. 96%)
  firstContactResolutionRate: number; // percentage (e.g. 84%)
  rating: number; // 1-5 (e.g. 4.8)
}

export interface InquiryAnalyticsReport {
  generatedAt: string;
  period: string;
  selectedChannels: (number | string)[];
  totalInquiriesCount: number;
  totalCustomersCount: number;
  categories: CategoryStat[];
  channelBreakdown: ChannelStat[];
  agentPerformance: AgentPerformanceStat[];
  executiveSummary: string;
  aiInsights: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    suggestedAction: string;
  }[];
  kbGapAnalysis: {
    missingTopic: string;
    frequency: number;
    recommendedArticleTitle: string;
    recommendedDraft: string;
  }[];
}

