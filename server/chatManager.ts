/**
 * ============================================================================
 * 💬 BSB Omnichannel Contact Center & Chat Manager Service
 * ============================================================================
 * 
 * Энэхүү сервис нь операторын ажлын байрны (Contact Center Workplace) чатын харилцан
 * яриа, харилцагчийн мэдээлэл, статус болон мессежийн түүхийг бүрэн хариуцдаг:
 * 
 * 1. Олон сувгийн чатын удирдлага (Omnichannel Dialog Management):
 *    - Facebook, Instagram, Telegram, WhatsApp, Web Live Chat-аас ирсэн бүх яриаг нэгтгэх.
 * 2. Төлөв ба шилжүүлэг (Status & Handoff Lifecycle):
 *    - 'new' (шинэ), 'assigned' (оператор оноосон), 'in_progress' (ярилцаж буй),
 *      'bot' (ботын хяналтанд), 'closed' (шийдвэрлэгдсэн).
 * 3. Харилцагчийн карт & CRM Lead интеграци:
 *    - Нэр, утас, и-мэйл, хаяг, захиалгын түүх, сэдэвчилсэн шошгууд (tags).
 * 4. Операторын дотоод тэмдэглэл (Internal Notes):
 *    - Зөвхөн ажилтнуудад харагдах, харилцагчид илгээгдэхгүй дотоод зөвлөмж/тэмдэглэл бичих.
 * 5. Persistent Storage:
 *    - Бүх чат болон мессежийг `data/chat_dialogs.json` файлд найдвартай хадгалах.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * Нэг мессежийн бүтэц
 */
export interface ChatMessage {
  id: string; // Мессежийн давтагдашгүй ID
  sender: 'customer' | 'bot' | 'agent' | 'system'; // Илгээгч
  senderName?: string; // Илгээгчийн бүтэн нэр
  senderAvatar?: string; // Аватар зураг
  text: string; // Мессежийн агуулга
  timestamp: string; // Илгээсэн огноо, цаг
  isInternalNote?: boolean; // Ажилтны дотоод тэмдэглэл эсэх (харилцагчид харагдахгүй)
  keyboard?: { text: string; action: string }[]; // Инлайн товчлуурууд
  status?: 'sent' | 'delivered' | 'read'; // Хүргэлтийн төлөв
}

/**
 * Харилцагчийн CRM профиль мэдээлэл
 */
export interface CustomerProfile {
  name: string; // Харилцагчийн нэр
  avatar?: string; // Профайл зураг
  phone?: string; // Утасны дугаар
  email?: string; // И-мэйл хаяг
  city?: string; // Хот / Аймаг
  address?: string; // Гэрийн буюу хүргэлтийн хаяг
  crmLeadId?: string; // Bitrix24 CRM Lead дугаар
  totalOrders?: number; // Нийт хийсэн захиалгын тоо
  lastOrderDate?: string; // Сүүлийн захиалгын огноо
  tags?: string[]; // Харилцагчийн шошгууд (ж: VIP, Баталгаа, Тавилга)
}

/**
 * Чат диалог / сессийн бүтэн загвар
 */
export interface ChatDialog {
  id: string; // Системийн дотоод ID
  dialogId: string; // Bitrix24 буюу сувгийн dialogId
  customer: CustomerProfile; // Харилцагчийн дэлгэрэнгүй мэдээлэл
  channelId: number | string; // Сувгийн ID
  channelName: string; // Сувгийн нэр (ж: БСБ Онлайн Их Дэлгүүр)
  channelType: 'facebook' | 'instagram' | 'telegram' | 'whatsapp' | 'webchat'; // Сувгийн төрөл
  status: 'new' | 'assigned' | 'bot' | 'in_progress' | 'closed'; // Чатны явцын статус
  priority: 'low' | 'normal' | 'high' | 'urgent'; // Яаралтай зэрэглэл
  assignedAgentId?: string | null; // Хариуцаж буй операторын ID
  assignedAgentName?: string | null; // Хариуцаж буй операторын нэр
  assignedAgentAvatar?: string | null; // Операторын аватар
  closedByAgentId?: string | null; // Чат хаасан операторын ID
  closedByAgentName?: string | null; // Чат хаасан операторын нэр
  closedByAgentAvatar?: string | null; // Чат хаасан операторын аватар
  lastMessageText: string; // Сүүлийн мессежийн хураангуй
  lastMessageTime: string; // Сүүлийн мессеж ирсэн цаг
  lastMessageSender: 'customer' | 'bot' | 'agent' | 'system';
  unreadCount: number; // Уншаагүй мессежийн тоо
  botActive?: boolean; // Бот тухайн чатад идэвхтэй хариулж байгаа эсэх (Оператор өөртөө авсан үед false болж сална)
  isStarred?: boolean; // Онцолсон/од тавьсан эсэх
  resolutionSummary?: string; // Чат хаах үеийн шийдвэрлэлтийн дүгнэлт
  closedAt?: string; // Чат хаагдсан цаг
  reopenedAt?: string; // Чат дахин нээгдсэн цаг
  createdAt: string; // Чат үүссэн цаг
  messages: ChatMessage[]; // Чат дахь бүх мессежүүд
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

export class ChatManagerService extends EventEmitter {
  private dialogs: ChatDialog[] = [];
  private version: number = 1;
  private dialogVersions: Map<string, number> = new Map();

  constructor() {
    super();
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

      // Ensure closed dialogs have resolution and closedByAgent fields
      let hasChanges = false;
      const agentMap: Record<string, string> = {
        '4605': 'Энхзаяа А.',
        'bx-4605': 'Энхзаяа А.',
        '4677': 'Номинцэцэг Л.',
        'bx-4677': 'Номинцэцэг Л.',
        '15': 'Цогтгэрэл Ч',
        'bx-15': 'Цогтгэрэл Ч',
        '123': 'Чойжамц Нацагдорж',
        'bx-123': 'Чойжамц Нацагдорж',
        'agent-1': 'Болдбаатар Ц.',
        'agent-2': 'Анударь Э.',
        'agent-3': 'Тэмүүлэн М.',
        'agent-4': 'Сарнай Б.',
      };

      const sampleResolutions = [
        'StorePay 0% лизингийн нөхцөлийг танилцуулж, зээлийн хүсэлтийн холбоос илгээн амжилттай шийдвэрлэв.',
        'Баталгаат хугацааны засварын мэдээлэл болон үйлчилгээний төвийн хаягийг өгч шийдвэрлэсэн.',
        'Хүргэлтийн хуваарь баталгаажуулж, харилцагчийн хүсэлтээр оройн цагаар хүргэхээр бүртгэв.',
        'НӨАТ-ын цахим төлбөрийн баримт (И-баримт)-ийг компанийн регистрийн дугаараар системд бүртгэн илгээв.',
        'Бүтээгдэхүүний бэлэн үлдэгдэл шалгаж, Их Дэлгүүрийн 2-р давхрын салбараас бэлтгүүлэхээр шийдвэрлэсэн.',
        'Барааны буцаалт болон солих нөхцөлийн дагуу шалгаж, харилцагчийн асуудлыг бүрэн шийдвэрлэв.',
      ];

      for (let i = 0; i < this.dialogs.length; i++) {
        const d = this.dialogs[i];
        if (d.status === 'closed') {
          if (!d.closedByAgentId && d.assignedAgentId) {
            d.closedByAgentId = d.assignedAgentId;
            hasChanges = true;
          }
          if (!d.closedByAgentName) {
            d.closedByAgentName =
              d.assignedAgentName ||
              (d.closedByAgentId ? agentMap[d.closedByAgentId] : undefined) ||
              (d.assignedAgentId ? agentMap[d.assignedAgentId] : undefined) ||
              'Энхзаяа А.';
            hasChanges = true;
          }
          if (!d.assignedAgentName && d.closedByAgentName) {
            d.assignedAgentName = d.closedByAgentName;
            hasChanges = true;
          }
          if (!d.closedAt) {
            d.closedAt = d.lastMessageTime || new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString();
            hasChanges = true;
          }
          if (!d.resolutionSummary) {
            d.resolutionSummary = sampleResolutions[i % sampleResolutions.length];
            hasChanges = true;
          }
        }
      }

      // Ensure agent-1 (Болдбаатар Ц.) has some closed chats
      const agent1Closed = this.dialogs.filter(
        (d) => d.status === 'closed' && (d.closedByAgentId === 'agent-1' || d.assignedAgentId === 'agent-1')
      );
      if (agent1Closed.length === 0) {
        const closedToAssign = this.dialogs.filter((d) => d.status === 'closed').slice(0, 5);
        closedToAssign.forEach((d, idx) => {
          d.closedByAgentId = 'agent-1';
          d.closedByAgentName = 'Болдбаатар Ц.';
          d.assignedAgentId = 'agent-1';
          d.assignedAgentName = 'Болдбаатар Ц.';
          d.resolutionSummary = sampleResolutions[idx % sampleResolutions.length];
          hasChanges = true;
        });
      }

      // Ensure agent-2 (Анударь Э.) has some closed chats
      const agent2Closed = this.dialogs.filter(
        (d) => d.status === 'closed' && (d.closedByAgentId === 'agent-2' || d.assignedAgentId === 'agent-2')
      );
      if (agent2Closed.length <= 1) {
        const closedToAssign = this.dialogs.filter((d) => d.status === 'closed' && d.closedByAgentId !== 'agent-1').slice(0, 4);
        closedToAssign.forEach((d, idx) => {
          d.closedByAgentId = 'agent-2';
          d.closedByAgentName = 'Анударь Э.';
          d.assignedAgentId = 'agent-2';
          d.assignedAgentName = 'Анударь Э.';
          d.resolutionSummary = sampleResolutions[(idx + 2) % sampleResolutions.length];
          hasChanges = true;
        });
      }

      if (hasChanges) {
        this.saveDialogs();
      }
    } catch (e) {
      console.error('Failed to load chat dialogs:', e);
      this.dialogs = INITIAL_DIALOGS;
    }
  }

  private saveDialogs(
    dialogId?: string,
    changeType: 'dialog:update' | 'message:new' | 'dialog:create' = 'dialog:update',
    extra?: any
  ) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(CHATS_FILE, JSON.stringify(this.dialogs, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save chat dialogs:', e);
    }

    this.version++;
    if (dialogId) {
      this.dialogVersions.set(dialogId, this.version);
    }

    const dialog = dialogId ? this.getDialogById(dialogId) : null;
    this.emit('change', {
      type: changeType,
      dialogId: dialogId || (dialog ? dialog.id : null),
      version: this.version,
      dialog,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  getVersion(): number {
    return this.version;
  }

  getDelta(
    sinceVersion: number,
    filters?: Parameters<ChatManagerService['getAllDialogs']>[0]
  ): {
    version: number;
    hasChanges: boolean;
    dialogs: ChatDialog[];
  } {
    if (sinceVersion >= this.version) {
      return {
        version: this.version,
        hasChanges: false,
        dialogs: [],
      };
    }

    const all = this.getAllDialogs(filters);
    if (sinceVersion === 0) {
      return {
        version: this.version,
        hasChanges: true,
        dialogs: all,
      };
    }

    const changed = all.filter((d) => {
      const v = this.dialogVersions.get(d.id) || 1;
      return v > sinceVersion;
    });

    return {
      version: this.version,
      hasChanges: changed.length > 0,
      dialogs: changed,
    };
  }

  getAllDialogs(filters?: {
    status?: string;
    channelId?: number | string;
    channelType?: string;
    search?: string;
    assignedAgentId?: string;
    closedByAgentId?: string;
    isStarred?: boolean;
    sortBy?: 'newest' | 'oldest' | 'pending_ai' | 'waiting' | 'name' | 'closed_newest' | 'closed_oldest';
    agentAccessRole?: 'admin' | 'supervisor' | 'agent';
    agentAssignedChannelIds?: number[];
    requestingAgentId?: string;
    canAccessAllChannels?: boolean;
  }): ChatDialog[] {
    let result = [...this.dialogs];

    // Enforce role-based security:
    // When a chat is assigned to a specific agent, it must NOT be visible to other agents (only visible to the assignee, or supervisors/admins)
    if (filters?.agentAccessRole === 'agent') {
      // 1. Channel constraint
      if (!filters.canAccessAllChannels && Array.isArray(filters.agentAssignedChannelIds)) {
        const allowedIds = filters.agentAssignedChannelIds.map((id) => String(id));
        result = result.filter((d) => allowedIds.includes(String(d.channelId)));
      }

      // 2. Chat assignment constraint:
      // - Unassigned chats (status === 'new' or assignedAgentId is empty) are visible in the queue
      // - If a chat is assigned to an agent, it is ONLY visible to that assigned agent.
      // - If closed, only visible if closed by or assigned to this agent.
      const reqAgentId = filters.requestingAgentId ? String(filters.requestingAgentId) : null;
      const reqBxId = reqAgentId?.startsWith('bx-') ? reqAgentId.replace('bx-', '') : reqAgentId;

      result = result.filter((d) => {
        const isUnassigned = (!d.assignedAgentId || d.assignedAgentId === 'unassigned') && d.status !== 'in_progress' && d.status !== 'assigned';
        if (isUnassigned) return true;
        if (!reqAgentId) return false;

        const dAgentId = String(d.assignedAgentId || '');
        const dClosedId = String(d.closedByAgentId || '');

        const isMine =
          dAgentId === reqAgentId ||
          (reqBxId && (dAgentId === reqBxId || dAgentId === `bx-${reqBxId}`)) ||
          dClosedId === reqAgentId ||
          (reqBxId && (dClosedId === reqBxId || dClosedId === `bx-${reqBxId}`));

        return isMine;
      });
    }

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

    if (filters?.closedByAgentId) {
      result = result.filter(
        (d) =>
          d.status === 'closed' &&
          (d.closedByAgentId === filters.closedByAgentId ||
            d.assignedAgentId === filters.closedByAgentId ||
            (filters.closedByAgentId.startsWith('bx-') &&
              d.closedByAgentId === filters.closedByAgentId.replace('bx-', '')))
      );
    }

    if (filters?.isStarred !== undefined) {
      result = result.filter((d) => Boolean(d.isStarred) === filters.isStarred);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.customer.name.toLowerCase().includes(q) ||
          d.channelName.toLowerCase().includes(q) ||
          d.channelType.toLowerCase().includes(q) ||
          d.lastMessageText.toLowerCase().includes(q) ||
          d.messages.some((m) => m.text.toLowerCase().includes(q)) ||
          (d.customer.phone && d.customer.phone.includes(q)) ||
          (d.resolutionSummary && d.resolutionSummary.toLowerCase().includes(q)) ||
          (d.closedByAgentName && d.closedByAgentName.toLowerCase().includes(q)) ||
          (d.assignedAgentName && d.assignedAgentName.toLowerCase().includes(q)) ||
          d.id.toLowerCase().includes(q)
      );
    }

    const sort = filters?.sortBy || 'newest';
    result.sort((a, b) => {
      if (sort === 'closed_newest') {
        const timeA = new Date(a.closedAt || a.lastMessageTime).getTime();
        const timeB = new Date(b.closedAt || b.lastMessageTime).getTime();
        return timeB - timeA;
      }
      if (sort === 'closed_oldest') {
        const timeA = new Date(a.closedAt || a.lastMessageTime).getTime();
        const timeB = new Date(b.closedAt || b.lastMessageTime).getTime();
        return timeA - timeB;
      }
      if (sort === 'oldest') {
        return new Date(a.lastMessageTime).getTime() - new Date(b.lastMessageTime).getTime();
      }
      if (sort === 'pending_ai') {
        // Pending AI Action: Dialogs where status is 'bot' OR (not closed and last sender is customer or new queue)
        const aPending =
          a.status === 'bot' || (a.status !== 'closed' && (a.lastMessageSender === 'customer' || a.status === 'new'));
        const bPending =
          b.status === 'bot' || (b.status !== 'closed' && (b.lastMessageSender === 'customer' || b.status === 'new'));
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
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
    if (!id) return undefined;
    const match = id.match(/\d+/);
    const num = match ? match[0] : null;
    return this.dialogs.find(
      (d) =>
        d.id === id ||
        d.dialogId === id ||
        (num && (d.id === `chat-${num}` || d.dialogId === `chat${num}`))
    );
  }

  getDialog(id: string): ChatDialog | undefined {
    return this.getDialogById(id);
  }

  sendMessage(
    dialogId: string,
    message: {
      text: string;
      sender: 'customer' | 'bot' | 'agent' | 'system';
      senderName?: string;
      senderAvatar?: string;
      senderAgentId?: string;
      isInternalNote?: boolean;
    }
  ): { dialog: ChatDialog; message: ChatMessage } {
    const dialog = this.getDialogById(dialogId);
    if (!dialog) {
      throw new Error(`Dialog not found: ${dialogId}`);
    }

    // Чатыг заавал өөртөө оноож байж бичдэг болгох шаардлага:
    // Хэрэв оператор хариу бичих эсвэл дотоод тэмдэглэл оруулах гэж байгаа бол уг чат эхлээд өөрт нь оноогдсон байх ёстой
    if (message.sender === 'agent' && message.senderAgentId) {
      const sId = String(message.senderAgentId);
      const sBxId = sId.startsWith('bx-') ? sId.replace('bx-', '') : sId;
      const dAssigned = String(dialog.assignedAgentId || '');
      const isAssignedToSender =
        dAssigned === sId ||
        (sBxId && (dAssigned === sBxId || dAssigned === `bx-${sBxId}`));

      if (!isAssignedToSender) {
        throw new Error('Та энэ чатыг эхлээд "Өөртөө авах" товчоор өөртөө оноож байж хариу бичнэ үү.');
      }
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
        const wasBot = dialog.status === 'bot' || dialog.botActive === true;
        dialog.botActive = false;
        if (dialog.status === 'new' || dialog.status === 'bot' || dialog.status === 'closed') {
          dialog.status = 'in_progress';
        }
        if (wasBot) {
          const sysNotice: ChatMessage = {
            id: `sys-${Date.now()}-detach`,
            sender: 'system',
            text: `🤖 Оператор хариу илгээсэн тул бот харилцан ярианаас гарлаа.`,
            timestamp: new Date().toISOString(),
          };
          dialog.messages.push(sysNotice);
        }
      }
    }

    this.saveDialogs(dialog.id, 'message:new', { message: newMessage });
    return { dialog, message: newMessage };
  }

  markAsRead(id: string) {
    const dialog = this.getDialogById(id);
    if (dialog && dialog.unreadCount > 0) {
      dialog.unreadCount = 0;
      this.saveDialogs(id, 'dialog:update');
    }
    return dialog;
  }

  updateDialog(
    id: string,
    updates: Partial<Pick<ChatDialog, 'status' | 'priority' | 'assignedAgentId' | 'assignedAgentName' | 'assignedAgentAvatar' | 'closedByAgentId' | 'closedByAgentName' | 'closedByAgentAvatar' | 'isStarred' | 'resolutionSummary' | 'closedAt' | 'botActive'>>
  ): ChatDialog {
    const dialog = this.getDialogById(id);
    if (!dialog) {
      throw new Error(`Dialog not found: ${id}`);
    }

    const previousStatus = dialog.status;
    const previousAgentId = dialog.assignedAgentId;
    const wasBot = previousStatus === 'bot' || dialog.botActive === true;

    // Check if operator is taking over or assigning the chat
    const isAssigningAgent = Boolean(updates.assignedAgentId && updates.assignedAgentId !== previousAgentId);
    const isTakingToInProgress = updates.status === 'in_progress' && (previousStatus === 'bot' || previousStatus === 'new' || !previousAgentId);

    if (isAssigningAgent || isTakingToInProgress) {
      // Operator takes over the chat: Bot detached!
      dialog.botActive = false;
      if (wasBot) {
        const agentName = updates.assignedAgentName || dialog.assignedAgentName || 'Оператор';
        const sysMsg: ChatMessage = {
          id: `sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          sender: 'system',
          text: `🤖 Бот харилцан ярианаас гарч, оператор ${agentName} чатыг хариуцаж эхэллээ.`,
          timestamp: new Date().toISOString(),
        };
        dialog.messages.push(sysMsg);
        dialog.lastMessageText = sysMsg.text;
        dialog.lastMessageTime = sysMsg.timestamp;
        dialog.lastMessageSender = 'system';
      }
    }

    Object.assign(dialog, updates);
    if (updates.status === 'closed') {
      if (!dialog.closedAt) {
        dialog.closedAt = new Date().toISOString();
      }
      dialog.unreadCount = 0;
      dialog.botActive = false;
    }

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  /**
   * Тухайлсан чатад AI Туслах Бот холбох (Connect bot to specific chat)
   */
  connectBotToChat(id: string, botName = 'BSB AI Туслах'): ChatDialog {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    const prevAgentName = dialog.assignedAgentName;
    dialog.assignedAgentId = null;
    dialog.assignedAgentName = null;
    dialog.assignedAgentAvatar = null;
    dialog.status = 'bot';
    dialog.botActive = true;

    const notice = prevAgentName
      ? `🤖 Оператор ${prevAgentName} энэ чатад ${botName}-ыг холболоо. Бот автоматаар хариулж эхэлнэ.`
      : `🤖 Энэ чатад ${botName} амжилттай холбогдлоо. Харилцагчийн асуултад бот хариулна.`;

    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: 'system',
      text: notice,
      timestamp: new Date().toISOString(),
    };
    dialog.messages.push(sysMsg);
    dialog.lastMessageText = sysMsg.text;
    dialog.lastMessageTime = sysMsg.timestamp;
    dialog.lastMessageSender = 'system';

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  /**
   * Тухайлсан чатнаас ботыг салгаж операторын дараалалд шилжүүлэх
   */
  detachBotFromChat(id: string, operatorName = 'Оператор'): ChatDialog {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.botActive = false;
    if (dialog.status === 'bot') {
      dialog.status = 'new';
    }

    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: 'system',
      text: `🛑 ${operatorName} ботыг энэ чатнаас салгалаа. Чатыг операторын дараалалд шилжүүллээ.`,
      timestamp: new Date().toISOString(),
    };
    dialog.messages.push(sysMsg);
    dialog.lastMessageText = sysMsg.text;
    dialog.lastMessageTime = sysMsg.timestamp;
    dialog.lastMessageSender = 'system';

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  /**
   * Оператор чатыг эргүүлэн AI Туслах Бот руу шилжүүлэх (Re-activate bot)
   */
  handBackToBot(id: string, botName = 'BSB AI Туслах'): ChatDialog {
    return this.connectBotToChat(id, botName);
  }

  transferDialog(id: string, targetAgentId: string, targetAgentName: string, targetAgentAvatar?: string) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.assignedAgentId = targetAgentId;
    dialog.assignedAgentName = targetAgentName;
    if (targetAgentAvatar) dialog.assignedAgentAvatar = targetAgentAvatar;
    dialog.status = 'assigned';
    dialog.botActive = false;

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Харилцан яриаг оператор ${targetAgentName}-д шилжүүллээ.`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  closeDialog(
    id: string,
    resolutionSummary?: string,
    closedByAgentId?: string,
    closedByAgentName?: string,
    closedByAgentAvatar?: string
  ) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.status = 'closed';
    dialog.closedAt = new Date().toISOString();
    delete dialog.reopenedAt;
    dialog.resolutionSummary = resolutionSummary || 'Асуудал амжилттай шийдвэрлэгдсэн';
    if (closedByAgentId) dialog.closedByAgentId = closedByAgentId;
    else if (!dialog.closedByAgentId && dialog.assignedAgentId) dialog.closedByAgentId = dialog.assignedAgentId;

    if (closedByAgentName) dialog.closedByAgentName = closedByAgentName;
    else if (!dialog.closedByAgentName && dialog.assignedAgentName) dialog.closedByAgentName = dialog.assignedAgentName;

    if (closedByAgentAvatar) dialog.closedByAgentAvatar = closedByAgentAvatar;

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Диалог хаагдлаа (${dialog.closedByAgentName || 'Оператор'}). Шийдвэрлэлт: ${dialog.resolutionSummary}`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  reopenDialog(id: string) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    dialog.status = 'in_progress';
    dialog.reopenedAt = new Date().toISOString();
    delete dialog.closedAt;
    delete dialog.resolutionSummary;

    dialog.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: `Систем: Диалогийг дахин нээж, операторын ажлын талбарт шилжүүллээ.`,
      timestamp: new Date().toISOString(),
    });

    this.saveDialogs(id, 'dialog:update');
    return dialog;
  }

  updateCustomerCrm(
    id: string,
    newCrmId: string,
    addedTag?: string,
    systemNote?: string
  ) {
    const dialog = this.getDialogById(id);
    if (!dialog) throw new Error(`Dialog not found: ${id}`);

    if (!dialog.customer) {
      dialog.customer = { name: 'Харилцагч', tags: [] };
    }
    dialog.customer.crmLeadId = newCrmId;
    if (addedTag) {
      if (!dialog.customer.tags) dialog.customer.tags = [];
      if (!dialog.customer.tags.includes(addedTag)) {
        dialog.customer.tags.push(addedTag);
      }
    }

    if (systemNote) {
      dialog.messages.push({
        id: `sys-${Date.now()}`,
        sender: 'system',
        text: systemNote,
        timestamp: new Date().toISOString(),
      });
    }

    this.saveDialogs(id, 'dialog:update');
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
    this.saveDialogs(newDialog.id, 'message:new', { message: newDialog.messages[0] });
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
          avatar: params.senderAvatar || undefined,
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

    const newBxMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: 'customer',
      senderName: params.senderName || dialog.customer.name,
      senderAvatar: params.senderAvatar || dialog.customer.avatar,
      text: params.text,
      timestamp: nowIso,
      status: 'delivered',
    };

    dialog.messages.push(newBxMsg);

    this.saveDialogs(dialog.id, 'message:new', { message: newBxMsg });
    return dialog;
  }

  recordBotReply(dialogId: string, replyText: string, handedOff = false, botName = 'BSB AI Туслах') {
    const dialog = this.getDialogById(dialogId);
    if (!dialog) return;

    const nowIso = new Date().toISOString();
    dialog.lastMessageText = replyText;
    dialog.lastMessageTime = nowIso;
    dialog.lastMessageSender = 'bot';

    const botMsg: ChatMessage = {
      id: `bot-msg-${Date.now()}`,
      sender: 'bot',
      senderName: botName,
      text: replyText,
      timestamp: nowIso,
      keyboard: handedOff ? undefined : [{ text: 'Оператор дуудах', action: '/operator' }],
      status: 'delivered',
    };

    dialog.messages.push(botMsg);

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

    this.saveDialogs(dialog.id, 'message:new', { message: botMsg });
    return dialog;
  }

  upsertBitrixDialog(newDialog: ChatDialog) {
    const existingIndex = this.dialogs.findIndex(
      (d) => d.id === newDialog.id || d.dialogId === newDialog.dialogId
    );

    let hasNewMessages = false;
    let latestMsg: ChatMessage | null = null;

    if (existingIndex >= 0) {
      const existing = this.dialogs[existingIndex];
      const prevMsgCount = existing.messages.length;

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

      const prevLastMsg = existing.messages[existing.messages.length - 1];
      const newLastMsg = combinedMessages[combinedMessages.length - 1];
      const lastMsgChanged =
        !prevLastMsg ||
        !newLastMsg ||
        prevLastMsg.id !== newLastMsg.id ||
        prevLastMsg.text !== newLastMsg.text ||
        prevLastMsg.timestamp !== newLastMsg.timestamp;

      hasNewMessages = combinedMessages.length > prevMsgCount || (lastMsgChanged && newLastMsg?.sender === 'customer');
      if (hasNewMessages && newLastMsg) {
        latestMsg = newLastMsg;
      }

      // Check whether a fresh incoming customer message arrived
      const isNewCustomerMessage = hasNewMessages && latestMsg && latestMsg.sender === 'customer';

      // Determine the most accurate status:
      let finalStatus = newDialog.status;
      let finalClosedAt = newDialog.closedAt;
      let finalReopenedAt = existing.reopenedAt;
      let finalResolutionSummary = existing.resolutionSummary || newDialog.resolutionSummary;
      let finalClosedByAgentId = existing.closedByAgentId || newDialog.closedByAgentId;
      let finalClosedByAgentName = existing.closedByAgentName || newDialog.closedByAgentName;
      let finalClosedByAgentAvatar = existing.closedByAgentAvatar || newDialog.closedByAgentAvatar;

      if (existing.reopenedAt) {
        // Chat was reopened by agent/user
        const reopenTime = new Date(existing.reopenedAt).getTime();
        const bitrixCloseTime = newDialog.closedAt ? new Date(newDialog.closedAt).getTime() : 0;

        if (newDialog.status === 'closed' && (!bitrixCloseTime || reopenTime >= bitrixCloseTime)) {
          // Bitrix still reports previous closed status, but user explicitly reopened it
          finalStatus = existing.status === 'closed' ? 'in_progress' : existing.status;
          finalClosedAt = undefined;
        } else if (newDialog.status === 'closed' && bitrixCloseTime > reopenTime) {
          // Closed again in Bitrix AFTER reopening
          finalStatus = 'closed';
          finalReopenedAt = undefined;
        }
      } else if (existing.status === 'closed' && existing.closedAt) {
        // Chat was closed locally
        if (!isNewCustomerMessage && newDialog.status !== 'closed') {
          // Bitrix sync hasn't closed yet, retain closed status locally
          finalStatus = 'closed';
          finalClosedAt = existing.closedAt;
        } else if (isNewCustomerMessage) {
          // Customer sent a new message after close, automatically reopen
          finalStatus = 'new';
          finalClosedAt = undefined;
          finalReopenedAt = new Date().toISOString();
        }
      } else if (existing.status === 'bot' && newDialog.status !== 'closed' && !newDialog.assignedAgentId) {
        finalStatus = 'bot';
      }

      // If the chat has been returned to the unassigned queue ('new') in Bitrix, do not retain stale assignedAgent
      const isUnassignedInBitrix = newDialog.status === 'new' && !newDialog.assignedAgentId;
      const finalAssignedAgentId = isUnassignedInBitrix ? null : (newDialog.assignedAgentId || existing.assignedAgentId);
      const finalAssignedAgentName = isUnassignedInBitrix ? null : (newDialog.assignedAgentName || existing.assignedAgentName);
      const finalAssignedAgentAvatar = isUnassignedInBitrix ? null : (newDialog.assignedAgentAvatar || existing.assignedAgentAvatar);

      // Preserve existing customer CRM lead, avatar, and contact details if newDialog has missing ones
      const mergedCustomer = {
        ...existing.customer,
        ...newDialog.customer,
        crmLeadId: newDialog.customer?.crmLeadId || existing.customer?.crmLeadId,
        avatar: newDialog.customer?.avatar || existing.customer?.avatar,
        phone: newDialog.customer?.phone || existing.customer?.phone,
        email: newDialog.customer?.email || existing.customer?.email,
        address: newDialog.customer?.address || existing.customer?.address,
        city: newDialog.customer?.city || existing.customer?.city,
        totalOrders: newDialog.customer?.totalOrders ?? existing.customer?.totalOrders,
        lastOrderDate: newDialog.customer?.lastOrderDate || existing.customer?.lastOrderDate,
      };

      this.dialogs[existingIndex] = {
        ...newDialog,
        customer: mergedCustomer,
        status: finalStatus,
        closedAt: finalClosedAt,
        reopenedAt: finalReopenedAt,
        resolutionSummary: finalStatus === 'closed' ? finalResolutionSummary : undefined,
        closedByAgentId: finalStatus === 'closed' ? finalClosedByAgentId : undefined,
        closedByAgentName: finalStatus === 'closed' ? finalClosedByAgentName : undefined,
        closedByAgentAvatar: finalStatus === 'closed' ? finalClosedByAgentAvatar : undefined,
        isStarred: existing.isStarred,
        botActive: existing.botActive !== undefined ? existing.botActive : (newDialog.botActive ?? false),
        assignedAgentId: finalAssignedAgentId,
        assignedAgentName: finalAssignedAgentName,
        assignedAgentAvatar: finalAssignedAgentAvatar,
        messages: combinedMessages,
      };
    } else {
      hasNewMessages = newDialog.messages.length > 0;
      if (hasNewMessages) {
        latestMsg = newDialog.messages[newDialog.messages.length - 1];
      }
      this.dialogs.unshift(newDialog);
    }

    if (hasNewMessages && latestMsg) {
      this.saveDialogs(newDialog.id, 'message:new', { message: latestMsg });
    } else {
      this.saveDialogs(newDialog.id, 'dialog:update');
    }
  }
}

export const chatManager = new ChatManagerService();
