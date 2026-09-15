import fs from 'fs';
import path from 'path';

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
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WORKTIME_FILE = path.join(DATA_DIR, 'agent_worktime.json');

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Болдбаатар Ц.',
    role: 'Ахлах онлайн оператор',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'online',
    email: 'boldbaatar@bsb.mn',
    phone: '9911-0021',
    isClockedIn: true,
    isOnBreak: false,
    activeShiftId: 'shift-1',
  },
  {
    id: 'agent-2',
    name: 'Анударь Э.',
    role: 'Борлуулалтын зөвлөх',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    status: 'busy',
    email: 'anudari@bsb.mn',
    phone: '8811-3344',
    isClockedIn: true,
    isOnBreak: false,
    activeShiftId: 'shift-2',
  },
  {
    id: 'agent-3',
    name: 'Тэмүүлэн М.',
    role: 'Хүргэлт & Сервис туслах',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    status: 'break',
    email: 'temuulen@bsb.mn',
    phone: '9555-8899',
    isClockedIn: true,
    isOnBreak: true,
    activeShiftId: 'shift-3',
  },
  {
    id: 'agent-4',
    name: 'Сарнай Б.',
    role: 'Харилцагчийн үйлчилгээний менежер',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    status: 'offline',
    email: 'sarnai@bsb.mn',
    phone: '9901-5566',
    isClockedIn: false,
    isOnBreak: false,
    activeShiftId: null,
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

  private loadData() {
    try {
      if (fs.existsSync(WORKTIME_FILE)) {
        const raw = fs.readFileSync(WORKTIME_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.currentAgentId = parsed.currentAgentId || 'agent-1';
        this.agents = parsed.agents || INITIAL_AGENTS;
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
    this.agents = INITIAL_AGENTS;
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
      agent = this.agents[0];
      this.currentAgentId = agent.id;
    }
    return agent;
  }

  setCurrentAgent(agentId: string): Agent {
    const found = this.agents.find((a) => a.id === agentId);
    if (!found) throw new Error(`Agent not found: ${agentId}`);
    this.currentAgentId = agentId;
    this.saveData();
    return found;
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
          // Preserve local worktime shift states if clocked in
          isClockedIn: current.isClockedIn || bAgent.isClockedIn,
          isOnBreak: current.isOnBreak,
          status: current.isClockedIn ? current.status : bAgent.status,
          activeShiftId: current.activeShiftId || bAgent.activeShiftId,
        };
      } else {
        this.agents.push(bAgent);
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
