import fs from 'fs';
import path from 'path';
import { vibeRequest } from './vibeApi';
import { Agent } from './worktimeManager';

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

export interface EnrichedOpenLine {
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
  assignedAgents: ChannelAgent[];
  operatorsCount: number;
}

export interface SyncAgentsResult {
  lines: EnrichedOpenLine[];
  uniqueAgents: Agent[];
  totalOperatorLinks: number;
  totalUniqueAgents: number;
  lastSyncTime: string;
  fromCache?: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'bitrix_channel_agents.json');

class BitrixAgentsService {
  private cachedResult: SyncAgentsResult | null = null;
  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadFromDisk();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.lines)) {
          this.cachedResult = {
            ...parsed,
            fromCache: true,
          };
          this.lastSyncTimestamp = new Date(parsed.lastSyncTime || 0).getTime();
        }
      }
    } catch (e) {
      console.warn('Could not load bitrix_channel_agents.json:', e);
    }
  }

  private saveToDisk(result: SyncAgentsResult) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(CACHE_FILE, JSON.stringify(result, null, 2), 'utf-8');
    } catch (e) {
      console.error('Could not save bitrix_channel_agents.json:', e);
    }
  }

  /**
   * Fetches all operators assigned to each openline from Bitrix24 portal
   */
  async syncAgents(forceRefresh = false): Promise<SyncAgentsResult> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedResult &&
      now - this.lastSyncTimestamp < this.CACHE_TTL_MS
    ) {
      return { ...this.cachedResult, fromCache: true };
    }

    if (this.isSyncing && this.cachedResult) {
      return { ...this.cachedResult, fromCache: true };
    }

    this.isSyncing = true;
    try {
      // 1. Fetch openline configs
      const linesResp = await vibeRequest<any[]>('GET', '/v1/openline-configs?limit=100');
      const lines = linesResp.data || [];

      // 2. Fetch all operators (paginated: offset=0, 50, 100, ...)
      let allOperators: any[] = [];
      let offset = 0;
      while (true) {
        const opsResp = await vibeRequest<any>('GET', `/v1/openlines/operators?offset=${offset}`);
        const list = opsResp.data?.operators || [];
        if (!list.length) break;
        allOperators = allOperators.concat(list);
        if (list.length < 50) break;
        offset += 50;
        if (offset > 1000) break; // safety ceiling
      }

      // 3. Fetch Bitrix portal users to resolve names, avatars, positions
      const usersResp = await vibeRequest<any[]>('GET', '/v1/users?limit=300');
      const users = usersResp.data || [];
      const usersMap = new Map<number, any>();
      for (const u of users) {
        usersMap.set(u.id, u);
      }

      // 4. Map channel configs to names
      const channelNameMap = new Map<number, string>();
      for (const l of lines) {
        channelNameMap.set(l.id, l.name);
      }

      // 5. Build enriched openlines with assigned agents
      const enrichedLines: EnrichedOpenLine[] = lines.map((line) => {
        const lineOps = allOperators.filter((o) => o.configId === line.id);
        const assignedAgents: ChannelAgent[] = lineOps.map((o) => {
          const u = usersMap.get(o.userId);
          const fullName = u
            ? [u.name, u.lastName].filter(Boolean).join(' ').trim() || `Ажилтан #${o.userId}`
            : `Хэрэглэгч #${o.userId}`;

          return {
            userId: o.userId,
            configId: o.configId,
            channelName: line.name,
            name: u?.name || '',
            lastName: u?.lastName || '',
            fullName,
            workPosition: u?.workPosition || 'Харилцагчийн үйлчилгээний ажилтан',
            avatar:
              u?.personalPhoto ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3b82f6&color=fff`,
            status:
              o.status === 'online' || u?.isOnline
                ? 'online'
                : 'offline',
            isOnline: Boolean(u?.isOnline || o.status === 'online'),
            activeSessions: o.activeSessions || 0,
            maxChat: o.maxChat || 1000,
            freeSlots: o.freeSlots ?? 1000,
            email: u?.email || '',
            phone: u?.personalPhone || u?.workPhone || '',
            lastActivityDate: o.lastActivityDate,
          };
        });

        return {
          id: line.id,
          name: line.name,
          active: Boolean(line.active),
          languageId: line.languageId,
          welcomeBotEnable: line.welcomeBotEnable,
          welcomeBotId: line.welcomeBotId,
          welcomeBotLeft: line.welcomeBotLeft,
          queueType: line.queueType,
          queueTime: line.queueTime,
          crm: line.crm,
          assignedAgents,
          operatorsCount: assignedAgents.length,
        };
      });

      // 6. Aggregate unique agents across all channels
      const uniqueAgentMap = new Map<number, {
        userId: number;
        fullName: string;
        role: string;
        avatar: string;
        status: 'online' | 'busy' | 'break' | 'offline';
        email: string;
        phone: string;
        channelIds: number[];
        channelNames: string[];
        activeSessions: number;
      }>();

      for (const line of enrichedLines) {
        for (const agent of line.assignedAgents) {
          const existing = uniqueAgentMap.get(agent.userId);
          if (existing) {
            if (!existing.channelIds.includes(line.id)) {
              existing.channelIds.push(line.id);
              existing.channelNames.push(line.name);
            }
            existing.activeSessions += agent.activeSessions;
            if (agent.status === 'online') existing.status = 'online';
          } else {
            uniqueAgentMap.set(agent.userId, {
              userId: agent.userId,
              fullName: agent.fullName,
              role: agent.workPosition,
              avatar: agent.avatar || '',
              status: agent.status,
              email: agent.email || '',
              phone: agent.phone || '',
              channelIds: [line.id],
              channelNames: [line.name],
              activeSessions: agent.activeSessions,
            });
          }
        }
      }

      const uniqueAgents: Agent[] = Array.from(uniqueAgentMap.values()).map((ua) => ({
        id: `bx-${ua.userId}`,
        bitrixUserId: ua.userId,
        name: ua.fullName,
        role: ua.role,
        avatar: ua.avatar,
        status: ua.status,
        email: ua.email,
        phone: ua.phone,
        isClockedIn: ua.status === 'online',
        isOnBreak: false,
        activeShiftId: null,
        assignedChannelIds: ua.channelIds,
        assignedChannelNames: ua.channelNames,
        activeSessions: ua.activeSessions,
      }));

      const syncResult: SyncAgentsResult = {
        lines: enrichedLines,
        uniqueAgents,
        totalOperatorLinks: allOperators.length,
        totalUniqueAgents: uniqueAgents.length,
        lastSyncTime: new Date().toISOString(),
        fromCache: false,
      };

      this.cachedResult = syncResult;
      this.lastSyncTimestamp = now;
      this.saveToDisk(syncResult);

      return syncResult;
    } catch (err: any) {
      console.error('Failed to sync agents from Bitrix24:', err);
      if (this.cachedResult) {
        return { ...this.cachedResult, fromCache: true };
      }
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  getCachedResult(): SyncAgentsResult | null {
    return this.cachedResult;
  }

  getAgentsForChannel(channelId: number): ChannelAgent[] {
    if (!this.cachedResult) return [];
    const line = this.cachedResult.lines.find((l) => l.id === channelId);
    return line?.assignedAgents || [];
  }
}

export const bitrixAgentsService = new BitrixAgentsService();
