import fs from 'fs';
import path from 'path';

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
  date: string; // YYYY-MM-DD
  clockInTime: string; // ISO
  clockOutTime?: string | null; // ISO
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WORKTIME_FILE = path.join(DATA_DIR, 'agent_worktime.json');

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Болдбаатар Ц.',
    role: 'Ахлах онлайн оператор',
    accessRole: 'admin',
    canAccessAllChannels: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'online',
    email: 'boldbaatar@bsb.mn',
    phone: '9911-0021',
    isClockedIn: true,
    isOnBreak: false,
    activeShiftId: 'shift-1',
    assignedChannelIds: [1, 3, 9, 11, 13, 15, 21, 27, 31, 37, 39, 41],
    assignedChannelNames: ['Бидэнтэй чатлаарай! BSB.mn', 'Интернэт дэлгүүр - Facebook - comments only', 'Интернэт дэлгүүр - Instagram', 'Интернэт дэлгүүр - Facebook - Messenger', 'Интернэт дэлгүүр - Telegram', 'Интернэт дэлгүүр - WhatsApp - Instant', 'БСБ Мебель - Facebook - Comments'],
  },
  {
    id: 'agent-2',
    name: 'Анударь Э.',
    role: 'Борлуулалтын зөвлөх',
    accessRole: 'agent',
    canAccessAllChannels: false,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    status: 'busy',
    email: 'anudari@bsb.mn',
    phone: '8811-3344',
    isClockedIn: true,
    isOnBreak: false,
    activeShiftId: 'shift-2',
    assignedChannelIds: [1, 3, 11, 39],
    assignedChannelNames: ['Бидэнтэй чатлаарай! BSB.mn', 'Интернэт дэлгүүр - Facebook - comments only', 'Интернэт дэлгүүр - Facebook - Messenger', 'БСБ Мебель - Facebook - Comments'],
  },
  {
    id: 'agent-3',
    name: 'Тэмүүлэн М.',
    role: 'Хүргэлт & Сервис туслах',
    accessRole: 'agent',
    canAccessAllChannels: false,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    status: 'break',
    email: 'temuulen@bsb.mn',
    phone: '9555-8899',
    isClockedIn: true,
    isOnBreak: true,
    activeShiftId: 'shift-3',
    assignedChannelIds: [1, 13, 15],
    assignedChannelNames: ['Бидэнтэй чатлаарай! BSB.mn', 'Интернэт дэлгүүр - Telegram', 'Интернэт дэлгүүр - WhatsApp - Instant'],
  },
  {
    id: 'agent-4',
    name: 'Сарнай Б.',
    role: 'Харилцагчийн үйлчилгээний менежер',
    accessRole: 'supervisor',
    canAccessAllChannels: true,
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    status: 'offline',
    email: 'sarnai@bsb.mn',
    phone: '9901-5566',
    isClockedIn: false,
    isOnBreak: false,
    activeShiftId: null,
    assignedChannelIds: [1, 3, 9, 11, 13, 15, 31, 39],
    assignedChannelNames: ['Бидэнтэй чатлаарай! BSB.mn', 'Интернэт дэлгүүр - Facebook - comments only', 'Интернэт дэлгүүр - Instagram', 'Интернэт дэлгүүр - Facebook - Messenger'],
  },
];

export class WorktimeManagerService {
  private currentAgentId = 'agent-1';
  private agents: Agent[] = [];
  private shifts: WorkShift[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private normalizeAgent(agent: Agent): Agent {
    const roleLower = (agent.role || '').toLowerCase();
    const isDirectorOrAdmin =
      agent.bitrixUserId === 15 ||
      agent.id === 'agent-1' ||
      roleLower.includes('захирал') ||
      roleLower.includes('админ');
    const isSupervisor =
      agent.id === 'bx-121' ||
      agent.id === 'agent-4' ||
      roleLower.includes('менежер') ||
      roleLower.includes('ахлах');

    const accessRole: AccessRole =
      agent.accessRole ||
      (isDirectorOrAdmin ? 'admin' : isSupervisor ? 'supervisor' : 'agent');

    const canAccessAllChannels =
      agent.canAccessAllChannels !== undefined
        ? agent.canAccessAllChannels
        : (accessRole === 'admin' || accessRole === 'supervisor');

    const assignedChannelIds = Array.isArray(agent.assignedChannelIds) && agent.assignedChannelIds.length > 0
      ? agent.assignedChannelIds
      : [1, 3, 11, 39]; // Default baseline channels if none set

    return {
      ...agent,
      accessRole,
      canAccessAllChannels,
      assignedChannelIds,
    };
  }

  private loadData() {
    try {
      if (fs.existsSync(WORKTIME_FILE)) {
        const raw = fs.readFileSync(WORKTIME_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.currentAgentId = parsed.currentAgentId || 'agent-1';
        const rawAgents: Agent[] = parsed.agents || INITIAL_AGENTS;
        this.agents = rawAgents.map((a) => this.normalizeAgent(a));
        
        // Хэрэв бодит Bitrix24 ажилтнууд татагдсан бол хуурамч test agent-уудыг цэвэрлэх
        const hasBitrix = this.agents.some((a) => !!a.bitrixUserId);
        if (hasBitrix) {
          this.agents = this.agents.filter((a) => !a.id.startsWith('agent-'));
          if (this.currentAgentId.startsWith('agent-')) {
            this.currentAgentId = 'bx-15'; // Default to admin Цогтгэрэл Ч
          }
        }
        
        this.shifts = parsed.shifts || [];
      } else {
        this.seedInitialData();
      }
    } catch (e) {
      console.error('Failed to load worktime data:', e);
      this.seedInitialData();
    }
  }

  private seedInitialData() {
    this.agents = INITIAL_AGENTS.map((a) => this.normalizeAgent(a));
    this.currentAgentId = 'agent-1';

    const todayStr = new Date().toISOString().split('T')[0];
    const baseDate = new Date();
    baseDate.setHours(9, 0, 0, 0);

    this.shifts = [
      {
        id: 'shift-1',
        agentId: 'agent-1',
        agentName: 'Болдбаатар Ц.',
        date: todayStr,
        clockInTime: baseDate.toISOString(),
        isClockedIn: true,
        isOnBreak: false,
        totalBreakSeconds: 900,
        workedSeconds: Math.floor((Date.now() - baseDate.getTime()) / 1000) - 900,
        chatsResolved: 8,
      },
      {
        id: 'shift-2',
        agentId: 'agent-2',
        agentName: 'Анударь Э.',
        date: todayStr,
        clockInTime: new Date(baseDate.getTime() + 15 * 60 * 1000).toISOString(),
        isClockedIn: true,
        isOnBreak: false,
        totalBreakSeconds: 600,
        workedSeconds: Math.floor((Date.now() - (baseDate.getTime() + 15 * 60 * 1000)) / 1000) - 600,
        chatsResolved: 12,
      },
      {
        id: 'shift-3',
        agentId: 'agent-3',
        agentName: 'Тэмүүлэн М.',
        date: todayStr,
        clockInTime: new Date(baseDate.getTime() + 30 * 60 * 1000).toISOString(),
        isClockedIn: true,
        isOnBreak: true,
        breakStartTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        totalBreakSeconds: 1200,
        workedSeconds: Math.floor((Date.now() - (baseDate.getTime() + 30 * 60 * 1000)) / 1000) - 1200,
        chatsResolved: 5,
      },
    ];

    this.saveData();
  }

  private saveData() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(
        WORKTIME_FILE,
        JSON.stringify(
          {
            currentAgentId: this.currentAgentId,
            agents: this.agents,
            shifts: this.shifts,
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to save worktime data:', e);
    }
  }

  getCurrentAgent(): Agent {
    let agent = this.agents.find((a) => a.id === this.currentAgentId);
    if (!agent) {
      agent = this.agents[0] || INITIAL_AGENTS[0];
    }
    return agent;
  }

  setCurrentAgent(agentId: string, bitrixUserId?: number): Agent {
    let found = this.agents.find((a) => a.id === agentId);
    if (!found && bitrixUserId) {
      found = this.agents.find((a) => a.bitrixUserId === bitrixUserId);
    }
    if (!found && (agentId.startsWith('bx-') || !isNaN(Number(agentId)))) {
      const num = Number(agentId.replace('bx-', ''));
      if (!isNaN(num)) {
        found = this.agents.find((a) => a.bitrixUserId === num);
      }
    }
    if (!found) {
      // Name match
      found = this.agents.find(
        (a) =>
          a.name.trim().toLowerCase() === agentId.trim().toLowerCase() ||
          (a.email && a.email.trim().toLowerCase() === agentId.trim().toLowerCase())
      );
    }
    // Fallback for legacy mock IDs: agent-1, agent-2
    if (!found && (agentId.startsWith('agent-') || agentId === 'agent-1' || agentId === 'agent-2')) {
      found = this.agents[0] || INITIAL_AGENTS[0];
    }
    // Safe fallback to default active agent rather than crashing
    if (!found) {
      found = this.agents[0] || INITIAL_AGENTS[0];
    }
    return found;
  }

  getAgentById(agentId: string): Agent | null {
    if (!agentId) return null;
    let found = this.agents.find((a) => a.id === agentId);
    if (!found && (agentId.startsWith('bx-') || !isNaN(Number(agentId)))) {
      const num = Number(agentId.replace('bx-', ''));
      if (!isNaN(num)) {
        found = this.agents.find((a) => a.bitrixUserId === num);
      }
    }
    if (!found) {
      found = this.agents.find(
        (a) =>
          a.name.trim().toLowerCase() === agentId.trim().toLowerCase() ||
          (a.email && a.email.trim().toLowerCase() === agentId.trim().toLowerCase())
      );
    }
    if (!found && (agentId.startsWith('agent-') || agentId === 'agent-1' || agentId === 'agent-2')) {
      found = this.agents[0] || INITIAL_AGENTS[0];
    }
    return found || null;
  }

  updateAgentPermissions(
    agentId: string,
    updates: {
      accessRole?: AccessRole;
      assignedChannelIds?: number[];
      assignedChannelNames?: string[];
      canAccessAllChannels?: boolean;
    }
  ): Agent {
    let agent = this.agents.find((a) => a.id === agentId);
    if (!agent && (agentId.startsWith('bx-') || !isNaN(Number(agentId)))) {
      const num = Number(agentId.replace('bx-', ''));
      agent = this.agents.find((a) => a.bitrixUserId === num);
    }
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    if (updates.accessRole !== undefined) agent.accessRole = updates.accessRole;
    if (updates.assignedChannelIds !== undefined) agent.assignedChannelIds = updates.assignedChannelIds;
    if (updates.assignedChannelNames !== undefined) agent.assignedChannelNames = updates.assignedChannelNames;
    if (updates.canAccessAllChannels !== undefined) agent.canAccessAllChannels = updates.canAccessAllChannels;

    this.saveData();
    return agent;
  }

  getAllAgents(): Agent[] {
    return this.agents;
  }

  syncWithBitrixAgents(bitrixAgents: Agent[]): Agent[] {
    if (!bitrixAgents || bitrixAgents.length === 0) return this.agents;

    for (const bAgent of bitrixAgents) {
      const existingIdx = this.agents.findIndex(
        (a) => a.id === bAgent.id || (bAgent.bitrixUserId && a.bitrixUserId === bAgent.bitrixUserId)
      );

      if (existingIdx >= 0) {
        const current = this.agents[existingIdx];
        this.agents[existingIdx] = {
          ...bAgent,
          accessRole: current.accessRole || bAgent.accessRole || (bAgent.bitrixUserId === 15 ? 'admin' : 'agent'),
          canAccessAllChannels:
            current.canAccessAllChannels !== undefined
              ? current.canAccessAllChannels
              : (bAgent.canAccessAllChannels || bAgent.bitrixUserId === 15),
          assignedChannelIds:
            current.assignedChannelIds && current.assignedChannelIds.length > 0
              ? current.assignedChannelIds
              : bAgent.assignedChannelIds,
          assignedChannelNames:
            current.assignedChannelNames && current.assignedChannelNames.length > 0
              ? current.assignedChannelNames
              : bAgent.assignedChannelNames,
          // Preserve local worktime shift states if clocked in
          isClockedIn: current.isClockedIn || bAgent.isClockedIn,
          isOnBreak: current.isOnBreak,
          status: current.isClockedIn ? current.status : bAgent.status,
          activeShiftId: current.activeShiftId || bAgent.activeShiftId,
        };
      } else {
        this.agents.push(this.normalizeAgent(bAgent));
      }
    }

    // If currentAgentId is default 'agent-1' and we have real Bitrix agents, promote the first active Bitrix agent
    const currentStillExists = this.agents.find((a) => a.id === this.currentAgentId);
    if (!currentStillExists) {
      this.currentAgentId = this.agents[0].id;
    }

    this.saveData();
    return this.agents;
  }

  getCurrentShift(agentId?: string): WorkShift | null {
    const targetAgentId = agentId || this.currentAgentId;
    const todayStr = new Date().toISOString().split('T')[0];
    const shift = this.shifts.find((s) => s.agentId === targetAgentId && s.date === todayStr && s.isClockedIn);
    return shift || null;
  }

  getShiftsHistory(limit = 20): WorkShift[] {
    return [...this.shifts].sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime()).slice(0, limit);
  }

  /**
   * Bitrix24 portal-аас ирсэн timeman бодит статусыг дотоод ээлж, операторын төлөвтэй синхрончлох
   */
  syncAgentWorkdayFromBitrix(agentId: string, bitrixData: any): { agent: Agent; shift: WorkShift | null } {
    const agent = this.getAgentById(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (!bitrixData) return { agent, shift: this.getCurrentShift(agent.id) };

    const bStatus: string = (bitrixData.status || '').toUpperCase();
    agent.bitrixWorkdayStatus = bStatus;

    const todayStr = new Date().toISOString().split('T')[0];
    let shift = this.shifts.find((s) => s.agentId === agent.id && (s.isClockedIn || s.date === todayStr));

    if (bStatus === 'OPENED') {
      agent.isClockedIn = true;
      agent.isOnBreak = false;
      if (agent.status === 'offline' || agent.status === 'break') {
        agent.status = 'online';
      }

      const clockInTime = bitrixData.timeStart || shift?.clockInTime || new Date().toISOString();
      const shiftDate = clockInTime.split('T')[0] || todayStr;

      if (!shift) {
        shift = {
          id: `shift-bx-${bitrixData.id || Date.now()}`,
          agentId: agent.id,
          agentName: agent.name,
          date: shiftDate,
          clockInTime,
          clockOutTime: null,
          isClockedIn: true,
          isOnBreak: false,
          totalBreakSeconds: 0,
          workedSeconds: 0,
          chatsResolved: 0,
          bitrixWorkdayStatus: 'OPENED',
          bitrixWorkdayId: bitrixData.id,
          bitrixDuration: bitrixData.duration,
        };
        this.shifts.unshift(shift);
      } else {
        shift.isClockedIn = true;
        shift.isOnBreak = false;
        shift.clockOutTime = null;
        if (bitrixData.timeStart) {
          shift.clockInTime = bitrixData.timeStart;
        }
        shift.bitrixWorkdayStatus = 'OPENED';
        shift.bitrixWorkdayId = bitrixData.id || shift.bitrixWorkdayId;
        shift.bitrixDuration = bitrixData.duration || shift.bitrixDuration;
      }

      if (bitrixData.timeLeaks) {
        const leakParts = bitrixData.timeLeaks.split(':').map(Number);
        if (leakParts.length === 3 && !leakParts.some(isNaN)) {
          shift.totalBreakSeconds = leakParts[0] * 3600 + leakParts[1] * 60 + leakParts[2];
        }
      }

      agent.activeShiftId = shift.id;
    } else if (bStatus === 'PAUSED') {
      agent.isClockedIn = true;
      agent.isOnBreak = true;
      agent.status = 'break';

      if (!shift) {
        const clockInTime = bitrixData.timeStart || new Date().toISOString();
        shift = {
          id: `shift-bx-${bitrixData.id || Date.now()}`,
          agentId: agent.id,
          agentName: agent.name,
          date: clockInTime.split('T')[0] || todayStr,
          clockInTime,
          clockOutTime: null,
          isClockedIn: true,
          isOnBreak: true,
          breakStartTime: new Date().toISOString(),
          totalBreakSeconds: 0,
          workedSeconds: 0,
          chatsResolved: 0,
          bitrixWorkdayStatus: 'PAUSED',
          bitrixWorkdayId: bitrixData.id,
        };
        this.shifts.unshift(shift);
      } else {
        shift.isClockedIn = true;
        shift.isOnBreak = true;
        shift.bitrixWorkdayStatus = 'PAUSED';
        if (!shift.breakStartTime) {
          shift.breakStartTime = new Date().toISOString();
        }
      }
      agent.activeShiftId = shift.id;
    } else if (bStatus === 'CLOSED' || bStatus === 'EXPIRED') {
      agent.isClockedIn = false;
      agent.isOnBreak = false;
      agent.status = 'offline';
      agent.activeShiftId = null;

      if (shift && shift.isClockedIn) {
        shift.isClockedIn = false;
        shift.isOnBreak = false;
        shift.clockOutTime = bitrixData.timeFinish || new Date().toISOString();
        shift.bitrixWorkdayStatus = bStatus;
        if (bitrixData.duration) {
          const parts = bitrixData.duration.split(':').map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            shift.workedSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }
      }
    }

    this.saveData();
    return { agent, shift: this.getCurrentShift(agent.id) || shift || null };
  }

  clockIn(agentId?: string): { agent: Agent; shift: WorkShift } {
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : this.getCurrentAgent();
    if (!agent) throw new Error('Agent not found');

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    let existingShift = this.shifts.find((s) => s.agentId === agent.id && s.date === todayStr && s.isClockedIn);
    if (existingShift) {
      agent.isClockedIn = true;
      agent.isOnBreak = false;
      agent.status = 'online';
      agent.activeShiftId = existingShift.id;
      this.saveData();
      return { agent, shift: existingShift };
    }

    const newShift: WorkShift = {
      id: `shift-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      date: todayStr,
      clockInTime: nowIso,
      clockOutTime: null,
      isClockedIn: true,
      isOnBreak: false,
      totalBreakSeconds: 0,
      workedSeconds: 0,
      chatsResolved: 0,
    };

    this.shifts.unshift(newShift);
    agent.isClockedIn = true;
    agent.isOnBreak = false;
    agent.status = 'online';
    agent.activeShiftId = newShift.id;

    this.saveData();
    return { agent, shift: newShift };
  }

  clockOut(dailyReport?: string, agentId?: string): { agent: Agent; shift: WorkShift } {
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : this.getCurrentAgent();
    if (!agent) throw new Error('Agent not found');

    const shift = this.getCurrentShift(agent.id);
    if (!shift) {
      agent.isClockedIn = false;
      agent.isOnBreak = false;
      agent.status = 'offline';
      agent.activeShiftId = null;
      this.saveData();
      throw new Error('Идэвхтэй ээлж олдсонгүй (No active shift found)');
    }

    const now = Date.now();
    const clockInMs = new Date(shift.clockInTime).getTime();

    // If on break, finish break
    if (shift.isOnBreak && shift.breakStartTime) {
      const breakMs = now - new Date(shift.breakStartTime).getTime();
      shift.totalBreakSeconds += Math.floor(breakMs / 1000);
      shift.isOnBreak = false;
      shift.breakStartTime = null;
    }

    const totalElapsedSec = Math.floor((now - clockInMs) / 1000);
    shift.workedSeconds = Math.max(0, totalElapsedSec - shift.totalBreakSeconds);
    shift.isClockedIn = false;
    shift.clockOutTime = new Date().toISOString();
    if (dailyReport) {
      shift.dailyReport = dailyReport;
    }

    agent.isClockedIn = false;
    agent.isOnBreak = false;
    agent.status = 'offline';
    agent.activeShiftId = null;

    this.saveData();
    return { agent, shift };
  }

  startBreak(agentId?: string): { agent: Agent; shift: WorkShift } {
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : this.getCurrentAgent();
    if (!agent) throw new Error('Agent not found');

    const shift = this.getCurrentShift(agent.id);
    if (!shift) throw new Error('Ажилдаа гарсны дараа завсарлага авах боломжтой');

    shift.isOnBreak = true;
    shift.breakStartTime = new Date().toISOString();

    agent.isOnBreak = true;
    agent.status = 'break';

    this.saveData();
    return { agent, shift };
  }

  resumeWork(agentId?: string): { agent: Agent; shift: WorkShift } {
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : this.getCurrentAgent();
    if (!agent) throw new Error('Agent not found');

    const shift = this.getCurrentShift(agent.id);
    if (!shift) throw new Error('Идэвхтэй ээлж олдсонгүй');

    if (shift.isOnBreak && shift.breakStartTime) {
      const breakMs = Date.now() - new Date(shift.breakStartTime).getTime();
      shift.totalBreakSeconds += Math.floor(breakMs / 1000);
      shift.isOnBreak = false;
      shift.breakStartTime = null;
    }

    agent.isOnBreak = false;
    agent.status = 'online';

    this.saveData();
    return { agent, shift };
  }

  setAgentStatus(status: Agent['status'], agentId?: string): Agent {
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : this.getCurrentAgent();
    if (!agent) throw new Error('Agent not found');

    agent.status = status;
    if (status === 'offline') {
      agent.isClockedIn = false;
      agent.isOnBreak = false;
    } else if (status === 'break') {
      agent.isOnBreak = true;
    } else {
      agent.isOnBreak = false;
    }

    this.saveData();
    return agent;
  }

  incrementResolvedChat(agentId?: string) {
    const targetAgentId = agentId || this.currentAgentId;
    const shift = this.getCurrentShift(targetAgentId);
    if (shift) {
      shift.chatsResolved = (shift.chatsResolved || 0) + 1;
      this.saveData();
    }
  }
}

export const worktimeManager = new WorktimeManagerService();
