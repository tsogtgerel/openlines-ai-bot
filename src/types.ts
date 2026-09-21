export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  updatedAt: string;
}

export interface ProductDisplayConfig {
  websiteBaseUrl: string; // e.g. "https://bsb.mn"
  productUrlPattern: string; // e.g. "https://bsb.mn/products/by-code/{code}" (BSB official endpoint)
  categoryUrlPattern: string; // e.g. "https://bsb.mn/categories/{slug}"
  includeProductLink: boolean; // Барааны шууд линкийг хариултад оруулах
  includeCategoryLink: boolean; // Барааны ангиллын линкийг хариултад оруулах
  includePrice: boolean; // Үнэ, хямдралын мэдээллийг оруулах
  includeStock: boolean; // Бэлэн байгаа эсэх нөөцийг оруулах
  includeBrand: boolean; // Брэндийн нэр оруулах
  includeSpecs: boolean; // Техникийн гол үзүүлэлтүүд оруулах
  includeWarranty: boolean; // Баталгаат хугацааг дурдах
  includePromotions: boolean; // Бэлэгтэй худалдаа, урамшууллыг дурдах
  includeImage: boolean; // Зургийн линкийг оруулах
  linkStyle: 'markdown' | 'bracket' | 'plain' | 'button'; // Линкний формат: [Бараа үзэх](url), 🔗 Үзэх: url, гэх мэт
  outputFormatTemplate: 'rich' | 'standard' | 'compact' | 'category_focused'; // Хариултын бүтцийн загвар
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
  botAssignmentMode?: 'manual_only' | 'all_chats';
  enableProductSearch?: boolean;
  productSearchEnabled?: boolean;
  productSearchLimit?: number;
  meiliUrl?: string;
  meiliIndex?: string;
  productConfig?: ProductDisplayConfig;
}

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

export interface BotProcessOutcome {
  answer: string;
  handedOff: boolean;
  handoff: boolean; // Explicit 'handoff' signal when transferred to an agent
  handoffReason?: string;
  transferredToAgent?: string;
  chatId?: string;
  sessionCleared?: boolean;
}

export interface BsbProduct {
  id: number;
  code: string;
  productCode: string;
  name: string;
  brand: string;
  category: string;
  categorySlug?: string;
  categoryUrl?: string;
  price: number;
  priceFormatted: string;
  originalPrice?: number;
  originalPriceFormatted?: string;
  hasDiscount: boolean;
  promotionPercentage?: number;
  inStock: boolean;
  onHand?: number;
  attributes: string[];
  attributesSummary: string;
  descriptionSummary: string;
  imageUrl?: string;
  slug?: string;
  url?: string;
  productUrl?: string;
  warrantyMonth?: string;
  promotionsSummary?: string;
  siteRemainsSummary?: string;
  isService?: boolean;
}

export interface BsbProductTerm {
  id: number;
  name: string;
  type: 'return_term' | 'delivery_term' | 'delivery_payment_term' | string;
  description: string;
  content: string;
  plainContent?: string;
}

export interface BsbBrand {
  id: number;
  code: string;
  name: string;
  totalProducts: number;
  taxons: string[];
  featured?: boolean;
  images?: Array<{ id: number; type: string; path: string; thumbnail?: string; large?: string }>;
}

export interface BsbTaxon {
  id: number;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  productTotal: number;
  parentCode?: string | null;
  parent?: string | null;
  images?: Array<{ id: number; type: string | null; path: string; thumbnail?: string; medium?: string }>;
}

export interface BsbAttribute {
  id: number;
  code: string;
  name: string;
  type: string;
  position?: number;
  configuration?: string[];
}

export interface MeiliIndexInfo {
  index: string;
  name: string;
  count: number;
  description: string;
  status: 'connected' | 'error' | 'loading';
}

export interface DialogLog {
  id: string;
  timestamp: string;
  dialogId: string;
  chatId?: string;
  customerName?: string;
  customerAvatar?: string;
  channelId?: number | string;
  channelName?: string;
  channelType?: string;
  customerMessage: string;
  botAnswer: string;
  responderType?: 'bot' | 'agent' | 'system';
  responderName?: string;
  responderAvatar?: string;
  status?: string;
  handedOff: boolean;
  handoffReason?: 'keyword' | 'low_confidence' | 'ai_error' | 'user_button' | 'model_declined' | 'assigned_to_operator' | 'manual_transfer';
  matchedArticles?: { id: string; title: string; score: number }[];
  matchedProducts?: { code: string; name: string; priceFormatted: string; inStock: boolean }[];
  durationMs: number;
  messagesCount?: number;
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
  botActive?: boolean;
  botConnectedAt?: string;
  isStarred?: boolean;
  resolutionSummary?: string;
  closedAt?: string;
  reopenedAt?: string;
  createdAt: string;
  messages: ChatMessage[];
}

export type AccessRole = 'admin' | 'supervisor' | 'agent';

export interface Agent {
  id: string;
  bitrixUserId?: number;
  name: string;
  role: string;
  accessRole?: AccessRole;
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
  canAccessAllChannels?: boolean;
  bitrixWorkdayStatus?: 'OPENED' | 'PAUSED' | 'CLOSED' | 'EXPIRED' | string;
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
  bitrixWorkdayStatus?: 'OPENED' | 'PAUSED' | 'CLOSED' | 'EXPIRED' | string;
  bitrixWorkdayId?: number;
  bitrixDuration?: string;
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

export interface PersonalPerformanceSummary {
  chatsHandledToday: number;
  resolvedToday: number;
  activeChatsCount?: number;
  avgResponseTimeSeconds: number;
  avgResponseTimeFormatted: string;
  rating?: number;
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
  allInquiries?: CustomerInquiryItem[];
}

export interface DeployState {
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
}

export interface TypingUser {
  agentId: string;
  name: string;
  role: 'agent' | 'customer' | 'bot';
  avatar?: string;
  dialogId: string;
  lastActive: number;
}


