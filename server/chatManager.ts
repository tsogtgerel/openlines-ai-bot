import fs from 'fs';
import path from 'path';

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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chat_dialogs.json');

const INITIAL_DIALOGS: ChatDialog[] = [
  {
    id: 'chat-101',
    dialogId: 'chat-fb-101',
    customer: {
      name: 'Бат-Эрдэнэ Төмөр',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      phone: '9911-2345',
      email: 'bat-erdene@gmail.com',
      city: 'Улаанбаатар',
      address: 'Хан-Уул дүүрэг, 15-р хороо, Ривер Гарден',
      crmLeadId: 'LEAD-8842',
      totalOrders: 3,
      lastOrderDate: '2026-08-10',
      tags: ['Байнгын харилцагч', 'Тавилга', 'VIP'],
    },
    channelId: 39,
    channelName: 'БСБ Мебель - Facebook - Comments',
    channelType: 'facebook',
    status: 'new',
    priority: 'urgent',
    assignedAgentId: null,
    assignedAgentName: null,
    assignedAgentAvatar: null,
    lastMessageText: 'Надад оператор хэрэгтэй байна, хүнтэй холбогдоод өгөөч',
    lastMessageTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    lastMessageSender: 'customer',
    unreadCount: 2,
    isStarred: true,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-101-1',
        sender: 'customer',
        senderName: 'Бат-Эрдэнэ Төмөр',
        text: 'Сайн байна уу, манай захиалсан буйдан хэзээ хүргэгдэж ирэх вэ? Захиалгын дугаар #BSB-88329',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-101-2',
        sender: 'bot',
        senderName: 'BSB AI Туслах',
        text: 'Сайн байна уу! Улаанбаатар хот дотор хүргэлт 24-48 цагийн дотор гэрийн хаягаар хүргэгдэж мэргэжлийн баг угсарч өгдөг. Нарийвчилсан мэдээлэл авахыг хүсвэл оператор дуудах боломжтой.',
        timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
        keyboard: [{ text: 'Оператор дуудах', action: '/operator' }],
      },
      {
        id: 'msg-101-3',
        sender: 'customer',
        senderName: 'Бат-Эрдэнэ Төмөр',
        text: 'Надад оператор хэрэгтэй байна, хүнтэй холбогдоод өгөөч',
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-101-4',
        sender: 'system',
        text: 'Систем: Бот чатнаас гарч, хэрэглэгчийг операторын дараалалд шилжүүллээ.',
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'chat-102',
    dialogId: 'chat-web-102',
    customer: {
      name: 'Оюунчимэг Даш',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      phone: '8801-9988',
      email: 'oyunaa.d@yahoo.com',
      city: 'Улаанбаатар',
      address: 'Баянгол дүүрэг, 3-р хороолол',
      crmLeadId: 'LEAD-9014',
      totalOrders: 1,
      lastOrderDate: '2026-09-02',
      tags: ['StorePay', 'Цахилгаан бараа'],
    },
    channelId: 40,
    channelName: 'БСБ Онлайн Их Дэлгүүр (Web Live Chat)',
    channelType: 'webchat',
    status: 'in_progress',
    priority: 'normal',
    assignedAgentId: 'agent-1',
    assignedAgentName: 'Болдбаатар (Ахлах оператор)',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    lastMessageText: 'Танд зориулж 0% хүүтэй 6 хувааж төлөх линкийг илгээлээ.',
    lastMessageTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    lastMessageSender: 'agent',
    unreadCount: 0,
    isStarred: false,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-102-1',
        sender: 'customer',
        senderName: 'Оюунчимэг Даш',
        text: 'Сайн байна уу? Угаалгын машиныг StorePay болон PocketZero-оор хүүгүй хувааж төлөхөд урьдчилгаа төлөх шаардлагатай юу?',
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-102-2',
        sender: 'bot',
        senderName: 'BSB AI Туслах',
        text: 'Сайн байна уу! StorePay болон PocketZero үйлчилгээгээр урьдчилгаагүй, 0% хүүтэйгээр 4-өөс 6 хуваан төлөх боломжтой байдаг.',
        timestamp: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-102-3',
        sender: 'agent',
        senderName: 'Болдбаатар',
        text: 'Сайн байна уу Оюунчимэг эгчээ! Танд зориулж 0% хүүтэй 6 хувааж төлөх линкийг илгээлээ. Та апп-аараа уншуулаад шууд захиалгаа баталгаажуулах боломжтой.',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'chat-103',
    dialogId: 'chat-ig-103',
    customer: {
      name: 'Мөнхжин Сүхбат',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      phone: '9555-1234',
      email: 'munkhjin@gmail.com',
      city: 'Улаанбаатар',
      address: 'Сүхбаатар дүүрэг, 1-р хороо',
      tags: ['Instagram Lead', 'Sony TV'],
    },
    channelId: 41,
    channelName: 'Instagram Direct (@bsb_mongolia)',
    channelType: 'instagram',
    status: 'bot',
    priority: 'normal',
    assignedAgentId: null,
    assignedAgentName: null,
    assignedAgentAvatar: null,
    lastMessageText: 'БСБ-гийн бүх салбар их дэлгүүрүүд Даваа-Ням гаригт 10:00 - 20:00 цаг хүртэл ажиллаж байна.',
    lastMessageTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    lastMessageSender: 'bot',
    unreadCount: 0,
    isStarred: false,
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-103-1',
        sender: 'customer',
        senderName: 'Мөнхжин Сүхбат',
        text: 'Өнөөдөр салбар дэлгүүрүүд чинь хэд хүртэл онгорхой байгаа вэ?',
        timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-103-2',
        sender: 'bot',
        senderName: 'BSB AI Туслах',
        text: 'БСБ-гийн бүх салбар их дэлгүүрүүд Даваа-Ням гаригт 10:00 - 20:00 цаг хүртэл ажиллаж байна.',
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        keyboard: [{ text: 'Оператор дуудах', action: '/operator' }],
      },
    ],
  },
  {
    id: 'chat-104',
    dialogId: 'chat-tg-104',
    customer: {
      name: 'Анужин Энхтайван',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      phone: '9900-7711',
      email: 'anujin.e@company.mn',
      city: 'Улаанбаатар',
      address: 'Сүхбаатар дүүрэг, Олимпийн гудамж',
      crmLeadId: 'DEAL-4412',
      totalOrders: 5,
      tags: ['Байгууллагын худалдан авалт', 'НӨАТ', 'B2B'],
    },
    channelId: 42,
    channelName: 'Telegram Support (@bsb_corporate_bot)',
    channelType: 'telegram',
    status: 'new',
    priority: 'high',
    assignedAgentId: null,
    assignedAgentName: null,
    assignedAgentAvatar: null,
    lastMessageText: 'Манай компани дээр НӨАТ-ын нэхэмжлэх яаралтай гаргаад өгөх боломж байна уу?',
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastMessageSender: 'customer',
    unreadCount: 1,
    isStarred: true,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-104-1',
        sender: 'customer',
        senderName: 'Анужин Энхтайван',
        text: 'Манай компани дээр 10 ширхэг DELL зөөврийн компьютерын НӨАТ-ын нэхэмжлэх яаралтай гаргаад өгөх боломж байна уу? Рег: 5839201',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'chat-105',
    dialogId: 'chat-wa-105',
    customer: {
      name: 'Ганзориг Цэнд',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
      phone: '9988-4422',
      email: 'ganzorig@gmail.com',
      city: 'Дархан-Уул',
      tags: ['Орон нутаг', 'Баталгаа'],
    },
    channelId: 43,
    channelName: 'WhatsApp Business (+976 7722-0222)',
    channelType: 'whatsapp',
    status: 'closed',
    priority: 'normal',
    assignedAgentId: 'agent-2',
    assignedAgentName: 'Ану (Борлуулалтын зөвлөх)',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    lastMessageText: 'Баярлалаа, Дархан хотын сервис төвөөс очиж авлаа!',
    lastMessageTime: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    lastMessageSender: 'customer',
    unreadCount: 0,
    isStarred: false,
    resolutionSummary: 'Дархан хот дахь сервис төвийн хаяг утас зааж өгч асуудлыг шийдвэрлэсэн.',
    closedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-105-1',
        sender: 'customer',
        senderName: 'Ганзориг Цэнд',
        text: 'Дархан хотод танай албан ёсны сервис төв хаана байдаг вэ?',
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-105-2',
        sender: 'agent',
        senderName: 'Ану',
        text: 'Сайн байна уу Ганзориг ахаа. Дархан хот, 14-р баг, БСБ Их Дэлгүүрийн 1 давхарт манай албан ёсны сервис төв өдөр бүр 10:00-19:00 цагт ажиллаж байна. Лавлах: 7037-0222',
        timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-105-3',
        sender: 'customer',
        senderName: 'Ганзориг Цэнд',
        text: 'Баярлалаа, Дархан хотын сервис төвөөс очиж авлаа!',
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export class ChatManagerService {
  private dialogs: ChatDialog[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadDialogs();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadDialogs() {
    try {
      if (fs.existsSync(CHATS_FILE)) {
        const raw = fs.readFileSync(CHATS_FILE, 'utf-8');
        this.dialogs = JSON.parse(raw);
      } else {
        this.dialogs = INITIAL_DIALOGS;
        this.saveDialogs();
      }
    } catch (e) {
      console.error('Failed to load chat dialogs:', e);
      this.dialogs = INITIAL_DIALOGS;
    }
  }

  private saveDialogs() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(CHATS_FILE, JSON.stringify(this.dialogs, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save chat dialogs:', e);
    }
  }

  getAllDialogs(filters?: {
    status?: string;
    channelId?: number | string;
    channelType?: string;
    search?: string;
    assignedAgentId?: string;
    isStarred?: boolean;
    sortBy?: 'newest' | 'oldest' | 'waiting' | 'name';
  }): ChatDialog[] {
    let result = [...this.dialogs];

    if (filters?.status && filters.status !== 'all') {
      result = result.filter((d) => d.status === filters.status);
    }

    if (filters?.channelId && filters.channelId !== 'all') {
      result = result.filter((d) => String(d.channelId) === String(filters.channelId));
    }

    if (filters?.channelType && filters.channelType !== 'all') {
      result = result.filter((d) => d.channelType === filters.channelType);
    }

    if (filters?.assignedAgentId) {
      if (filters.assignedAgentId === 'unassigned') {
        result = result.filter((d) => !d.assignedAgentId);
      } else {
        result = result.filter((d) => d.assignedAgentId === filters.assignedAgentId);
      }
    }

    if (filters?.isStarred !== undefined) {
      result = result.filter((d) => Boolean(d.isStarred) === filters.isStarred);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.customer.name.toLowerCase().includes(q) ||
          (d.customer.phone && d.customer.phone.includes(q)) ||
          d.channelName.toLowerCase().includes(q) ||
          d.lastMessageText.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          d.messages.some((m) => m.text.toLowerCase().includes(q))
      );
    }

    const sort = filters?.sortBy || 'newest';
    result.sort((a, b) => {
      if (sort === 'oldest') {
        return new Date(a.lastMessageTime).getTime() - new Date(b.lastMessageTime).getTime();
      }
      if (sort === 'waiting') {
        // Unassigned new dialogs waiting longest first
        if (a.status === 'new' && b.status !== 'new') return -1;
        if (b.status === 'new' && a.status !== 'new') return 1;
        return new Date(a.lastMessageTime).getTime() - new Date(b.lastMessageTime).getTime();
      }
      if (sort === 'name') {
        return a.customer.name.localeCompare(b.customer.name, 'mn');
      }
      // 'newest'
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return result;
  }

  getDialogById(id: string): ChatDialog | undefined {
    return this.dialogs.find((d) => d.id === id || d.dialogId === id);
  }

  sendMessage(
    dialogId: string,
    message: {
      text: string;
      sender: 'customer' | 'bot' | 'agent' | 'system';
      senderName?: string;
      senderAvatar?: string;
      isInternalNote?: boolean;
    }
  ): { dialog: ChatDialog; message: ChatMessage } {
    const dialog = this.getDialogById(dialogId);
    if (!dialog) {
      throw new Error(`Dialog not found: ${dialogId}`);
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: message.sender,
      senderName: message.senderName || (message.sender === 'agent' ? 'Оператор' : 'Хэрэглэгч'),
      senderAvatar: message.senderAvatar,
      text: message.text,
      timestamp: new Date().toISOString(),
      isInternalNote: Boolean(message.isInternalNote),
      status: 'sent',
    };

    dialog.messages.push(newMessage);

    if (!message.isInternalNote) {
      dialog.lastMessageText = message.text;
      dialog.lastMessageTime = newMessage.timestamp;
      dialog.lastMessageSender = message.sender;

      if (message.sender === 'customer') {
        dialog.unreadCount += 1;
        if (dialog.status === 'closed') {
          dialog.status = 'new';
        }
      } else if (message.sender === 'agent') {
        dialog.unreadCount = 0;
        if (dialog.status === 'new' || dialog.status === 'bot') {
          dialog.status = 'in_progress';
        }
      }
    }

    this.saveDialogs();
    return { dialog, message: newMessage };
  }

  markAsRead(id: string) {
    const dialog = this.getDialogById(id);
    if (dialog && dialog.unreadCount > 0) {
      dialog.unreadCount = 0;
      this.saveDialogs();
    }
    return dialog;
  }

  updateDialog(
    id: string,
    updates: Partial<Pick<ChatDialog, 'status' | 'priority' | 'assignedAgentId' | 'assignedAgentName' | 'assignedAgentAvatar' | 'isStarred' | 'resolutionSummary'>>
  ): ChatDialog {
    const dialog = this.getDialogById(id);
    if (!dialog) {
      throw new Error(`Dialog not found: ${id}`);
    }

    Object.assign(dialog, updates);
    if (updates.status === 'closed') {
      dialog.closedAt = new Date().toISOString();
      dialog.unreadCount = 0;
    }

    this.saveDialogs();
    return dialog;
  }

  transferDialog(id: string, targetAgentId: string, targetAgentName: string, targetAgentAvatar?: string) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.assignedAgentId = targetAgentId;
    dialog.assignedAgentName = targetAgentName;
    if (targetAgentAvatar) dialog.assignedAgentAvatar = targetAgentAvatar;
    dialog.status = 'assigned';

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Харилцан яриаг оператор ${targetAgentName}-д шилжүүллээ.`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs();
    return dialog;
  }

  closeDialog(id: string, resolutionSummary?: string) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.status = 'closed';
    dialog.closedAt = new Date().toISOString();
    dialog.resolutionSummary = resolutionSummary || 'Асуудал амжилттай шийдвэрлэгдсэн';

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Диалог хаагдлаа. Шийдвэрлэлт: ${dialog.resolutionSummary}`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs();
    return dialog;
  }

  reopenDialog(id: string) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.status = 'in_progress';
    delete dialog.closedAt;

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Диалогийг дахин нээж, операторын ажлын талбарт шилжүүллээ.`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs();
    return dialog;
  }

  simulateIncomingCustomerMessage(
    customerName: string,
    messageText: string,
    channelType: ChatDialog['channelType'] = 'facebook',
    channelName = 'БСБ Мебель - Facebook - Comments',
    channelId: number | string = 39
  ): ChatDialog {
    const newId = `chat-${Date.now().toString().slice(-4)}`;
    const nowIso = new Date().toISOString();

    const newDialog: ChatDialog = {
      id: newId,
      dialogId: `chat-${channelType}-${newId}`,
      customer: {
        name: customerName,
        phone: '99' + Math.floor(100000 + Math.random() * 900000),
        city: 'Улаанбаатар',
        tags: ['Шинэ харилцагч'],
      },
      channelId,
      channelName,
      channelType,
      status: 'new',
      priority: 'high',
      assignedAgentId: null,
      assignedAgentName: null,
      assignedAgentAvatar: null,
      lastMessageText: messageText,
      lastMessageTime: nowIso,
      lastMessageSender: 'customer',
      unreadCount: 1,
      createdAt: nowIso,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'customer',
          senderName: customerName,
          text: messageText,
          timestamp: nowIso,
        },
      ],
    };

    this.dialogs.unshift(newDialog);
    this.saveDialogs();
    return newDialog;
  }

  recordIncomingBitrixMessage(params: {
    dialogId: string;
    text: string;
    senderId?: number | string;
    senderName?: string;
    senderAvatar?: string;
    channelId?: number | string;
    channelName?: string;
    channelType?: ChatDialog['channelType'];
  }): ChatDialog {
    let dialog = this.getDialogById(params.dialogId);
    const nowIso = new Date().toISOString();

    if (!dialog) {
      const newId = `chat-live-${Date.now().toString().slice(-6)}`;
      dialog = {
        id: newId,
        dialogId: params.dialogId,
        customer: {
          name: params.senderName || `Харилцагч #${params.senderId || 'Шинэ'}`,
          avatar:
            params.senderAvatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          tags: ['Битрикс24 Live'],
        },
        channelId: params.channelId || 39,
        channelName: params.channelName || 'Нээлттэй суваг',
        channelType: params.channelType || 'webchat',
        status: 'new',
        priority: 'normal',
        assignedAgentId: null,
        assignedAgentName: null,
        assignedAgentAvatar: null,
        lastMessageText: params.text,
        lastMessageTime: nowIso,
        lastMessageSender: 'customer',
        unreadCount: 1,
        createdAt: nowIso,
        messages: [],
      };
      this.dialogs.unshift(dialog);
    } else {
      dialog.lastMessageText = params.text;
      dialog.lastMessageTime = nowIso;
      dialog.lastMessageSender = 'customer';
      dialog.unreadCount += 1;
      if (dialog.status === 'closed') {
        dialog.status = 'new';
      }
    }

    dialog.messages.push({
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: 'customer',
      senderName: params.senderName || dialog.customer.name,
      senderAvatar: params.senderAvatar || dialog.customer.avatar,
      text: params.text,
      timestamp: nowIso,
      status: 'delivered',
    });

    this.saveDialogs();
    return dialog;
  }

  recordBotReply(dialogId: string, replyText: string, handedOff = false, botName = 'BSB AI Туслах') {
    const dialog = this.getDialogById(dialogId);
    if (!dialog) return;

    const nowIso = new Date().toISOString();
    dialog.lastMessageText = replyText;
    dialog.lastMessageTime = nowIso;
    dialog.lastMessageSender = 'bot';

    dialog.messages.push({
      id: `bot-msg-${Date.now()}`,
      sender: 'bot',
      senderName: botName,
      text: replyText,
      timestamp: nowIso,
      keyboard: handedOff ? undefined : [{ text: 'Оператор дуудах', action: '/operator' }],
      status: 'delivered',
    });

    if (handedOff) {
      dialog.status = 'new';
      dialog.messages.push({
        id: `sys-handoff-${Date.now()}`,
        sender: 'system',
        text: 'Систем: Бот чатнаас гарч, хэрэглэгчийг операторын дараалалд шилжүүллээ.',
        timestamp: nowIso,
      });
    } else {
      dialog.status = 'bot';
    }

    this.saveDialogs();
    return dialog;
  }

  upsertBitrixDialog(newDialog: ChatDialog) {
    const existingIndex = this.dialogs.findIndex(
      (d) => d.id === newDialog.id || d.dialogId === newDialog.dialogId
    );

    if (existingIndex >= 0) {
      const existing = this.dialogs[existingIndex];
      // Keep any internal notes added locally
      const internalNotes = existing.messages.filter((m) => m.isInternalNote);
      const combinedMessages = [...newDialog.messages];
      for (const note of internalNotes) {
        if (!combinedMessages.some((m) => m.id === note.id)) {
          combinedMessages.push(note);
        }
      }
      combinedMessages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Determine the most accurate status:
      // If locally marked as 'bot' and new status is not 'closed' or human-assigned, keep 'bot'
      let finalStatus = newDialog.status;
      if (existing.status === 'bot' && newDialog.status !== 'closed' && !newDialog.assignedAgentId) {
        finalStatus = 'bot';
      }

      this.dialogs[existingIndex] = {
        ...newDialog,
        status: finalStatus,
        isStarred: existing.isStarred,
        assignedAgentId: existing.assignedAgentId || newDialog.assignedAgentId,
        assignedAgentName: existing.assignedAgentName || newDialog.assignedAgentName,
        assignedAgentAvatar: existing.assignedAgentAvatar || newDialog.assignedAgentAvatar,
        messages: combinedMessages,
      };
    } else {
      this.dialogs.unshift(newDialog);
    }

    this.saveDialogs();
  }
}

export const chatManager = new ChatManagerService();
