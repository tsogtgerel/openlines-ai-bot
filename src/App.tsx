import React, { useState, useEffect } from 'react';
import {
  Radio,
  BookOpen,
  Sliders,
  History,
  Terminal,
  Cloud,
  Layers,
  MessageSquare,
  Sparkles,
  Bot,
  AlertCircle,
  Headphones,
  Clock,
  BarChart3,
  Shield,
  Rocket,
  Smartphone,
} from 'lucide-react';
import { Header } from './components/Header';
import { ChannelSelector } from './components/ChannelSelector';
import { KnowledgeBaseTab } from './components/KnowledgeBaseTab';
import { PromptSettingsTab } from './components/PromptSettingsTab';
import { DialogLogsTab } from './components/DialogLogsTab';
import { SandboxTab } from './components/SandboxTab';
import { DeployTab } from './components/DeployTab';
import { OpenChannelChatWorkplace } from './components/OpenChannelChatWorkplace';
import { WorktimeBar } from './components/WorktimeBar';
import { WorktimeModal } from './components/WorktimeModal';
import { InquiryAnalyticsTab } from './components/InquiryAnalyticsTab';
import { AgentPermissionsModal } from './components/AgentPermissionsModal';
import { RedeployModal } from './components/RedeployModal';
import { BitrixMobileModal } from './components/BitrixMobileModal';
import { initBitrix24SDK } from './utils/bitrixMobile';
import {
  KnowledgeArticle,
  BotConfig,
  OpenLineItem,
  PortalInfo,
  DialogLog,
  InfraServer,
  Agent,
  WorkShift,
  ChatDialog,
  AccessRole,
  PersonalPerformanceSummary,
} from './types';

type ActiveTab = 'chat' | 'inquiries' | 'channels' | 'kb' | 'prompts' | 'logs' | 'sandbox' | 'deploy';

/**
 * Хариу нь JSON биш (HTML fallback эсвэл сервер түр ачааллаж байгаа) үед
 * SyntaxError шидэхээс сэргийлж аюулгүй парс хийх туслах функц
 */
async function fetchJsonSafe<T = any>(url: string, init?: RequestInit): Promise<T | null> {
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  // App State
  const [portalInfo, setPortalInfo] = useState<PortalInfo | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [openLines, setOpenLines] = useState<OpenLineItem[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [logs, setLogs] = useState<DialogLog[]>([]);
  const [servers, setServers] = useState<InfraServer[]>([]);

  // Omnichannel Chats & Worktime State
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [currentShift, setCurrentShift] = useState<WorkShift | null>(null);
  const [personalPerformance, setPersonalPerformance] = useState<PersonalPerformanceSummary | null>(null);
  const [team, setTeam] = useState<Agent[]>([]);
  const [chatsCount, setChatsCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
  const [showRedeployModal, setShowRedeployModal] = useState<boolean>(false);
  const [showMobileModal, setShowMobileModal] = useState<boolean>(false);

  // Loading States
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingKB, setIsLoadingKB] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [isTogglingPolling, setIsTogglingPolling] = useState(false);
  const [isSyncingBitrixAgents, setIsSyncingBitrixAgents] = useState(false);
  const [targetChatId, setTargetChatId] = useState<string | null>(null);

  // Load Portal Info & Bot Config
  const loadPortalAndBot = async () => {
    try {
      setIsLoadingPortal(true);
      const [meRes, botRes] = await Promise.all([
        fetchJsonSafe('/api/me'),
        fetchJsonSafe('/api/bot/status'),
      ]);

      if (meRes?.success && meRes.data) {
        setPortalInfo({
          portal: meRes.data.portal,
          portalId: meRes.data.portalId,
          tariffName: meRes.data.tariff?.name || 'БСБ Корпорэйт',
          isCommercial: meRes.data.tariff?.isCommercial ?? true,
        });
      }

      if (botRes?.success && botRes.data) {
        setBotConfig(botRes.data.config);
      }
    } catch (e) {
      console.error('Failed to load portal/bot info:', e);
    } finally {
      setIsLoadingPortal(false);
    }
  };

  // Load Open Lines
  const loadOpenLines = async () => {
    try {
      setIsLoadingChannels(true);
      const res = await fetchJsonSafe('/api/openlines');
      if (res?.success && Array.isArray(res.data)) {
        setOpenLines(res.data);
      }
    } catch (e) {
      console.error('Failed to load open lines:', e);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Load Knowledge Base
  const loadKnowledgeBase = async () => {
    try {
      setIsLoadingKB(true);
      const res = await fetchJsonSafe('/api/kb');
      if (res?.success && Array.isArray(res.data)) {
        setArticles(res.data);
      }
    } catch (e) {
      console.error('Failed to load KB:', e);
    } finally {
      setIsLoadingKB(false);
    }
  };

  // Load Logs
  const loadLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const res = await fetchJsonSafe('/api/logs?limit=100');
      if (res?.success && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Auto reload logs whenever switching to the logs tab
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  // Load Servers
  const loadServers = async () => {
    try {
      setIsLoadingServers(true);
      const res = await fetchJsonSafe('/api/infra/servers');
      if (res?.success && Array.isArray(res.data)) {
        setServers(res.data);
      }
    } catch (e) {
      console.error('Failed to load servers:', e);
    } finally {
      setIsLoadingServers(false);
    }
  };

  // Load Worktime & Chats status (with requestingAgentId context for channel isolation)
  const loadWorktimeAndChats = async (agentOverrideId?: string) => {
    try {
      const activeAgentId = agentOverrideId || currentAgent?.id;
      const statusUrl = activeAgentId
        ? `/api/worktime/status?agentId=${encodeURIComponent(activeAgentId)}`
        : '/api/worktime/status';

      const worktimeRes = await fetchJsonSafe(statusUrl);

      if (worktimeRes?.success && worktimeRes.data) {
        setCurrentAgent(worktimeRes.data.currentAgent);
        setCurrentShift(worktimeRes.data.currentShift);
        setTeam(worktimeRes.data.team || []);
        if (worktimeRes.data.personalPerformance) {
          setPersonalPerformance(worktimeRes.data.personalPerformance);
        }
      }

      const chatsUrl = activeAgentId
        ? `/api/chats?requestingAgentId=${encodeURIComponent(activeAgentId)}`
        : '/api/chats';
      const chatsRes = await fetchJsonSafe(chatsUrl);

      if (chatsRes?.success && Array.isArray(chatsRes.data)) {
        setChatsCount(chatsRes.data.length);
        const unread = chatsRes.data.reduce((acc: number, d: any) => acc + (d.unreadCount || 0), 0);
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error('Failed to load worktime/chats:', e);
    }
  };

  useEffect(() => {
    initBitrix24SDK();
    loadPortalAndBot();
    loadOpenLines();
    loadKnowledgeBase();
    loadLogs();
    loadServers();

    // Check for Bitrix24 iframe embedded parameters (USER_ID or agent_id)
    const urlParams = new URLSearchParams(window.location.search);
    const bitrixUserId = urlParams.get('USER_ID') || urlParams.get('user_id') || urlParams.get('userId');
    const agentId = urlParams.get('agent_id') || urlParams.get('agentId');

    if (bitrixUserId || agentId) {
      fetch('/api/worktime/switch-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, bitrixUserId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setCurrentAgent(data.data.agent);
            setCurrentShift(data.data.shift);
            if (data.data.personalPerformance) {
              setPersonalPerformance(data.data.personalPerformance);
            }
            loadWorktimeAndChats(data.data.agent.id);
          } else {
            loadWorktimeAndChats();
          }
        })
        .catch(() => loadWorktimeAndChats());
    } else {
      loadWorktimeAndChats();
    }

    // Poll chats and shifts periodically
    const pollInterval = setInterval(() => {
      loadWorktimeAndChats();
    }, 12000);
    return () => clearInterval(pollInterval);
  }, []);

  // Enforce tab access: Agents can ONLY access the Live Chat tab
  useEffect(() => {
    if (currentAgent?.accessRole === 'agent' && activeTab !== 'chat') {
      setActiveTab('chat');
    }
  }, [currentAgent?.accessRole, activeTab]);

  // Worktime Handlers - Bitrix24 Timeman бүрэн синхрончлол
  const handleClockIn = async () => {
    try {
      const res = await fetch('/api/worktime/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: currentAgent?.id }),
      }).then((r) => r.json());

      // If running inside Bitrix24 iframe, also notify Bitrix24 portal UI
      if (typeof window !== 'undefined' && (window as any).BX24?.callMethod) {
        try {
          (window as any).BX24.callMethod('timeman.open', {});
        } catch {}
      }

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      } else {
        alert(res.error?.message || 'Clock In хийхэд алдаа гарлаа');
      }
    } catch (err) {
      console.error('Failed to clock in:', err);
    }
  };

  const handleClockOut = async (report?: string) => {
    try {
      const res = await fetch('/api/worktime/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReport: report, agentId: currentAgent?.id }),
      }).then((r) => r.json());

      // If running inside Bitrix24 iframe, also notify Bitrix24 portal UI
      if (typeof window !== 'undefined' && (window as any).BX24?.callMethod) {
        try {
          (window as any).BX24.callMethod('timeman.close', { report: report || 'Өдрийн ээлж дууссан' });
        } catch {}
      }

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      } else {
        alert(res.error?.message || 'Clock Out хийхэд алдаа гарлаа');
      }
    } catch (err) {
      console.error('Failed to clock out:', err);
    }
  };

  const handleStartBreak = async () => {
    try {
      const res = await fetch('/api/worktime/break/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: currentAgent?.id }),
      }).then((r) => r.json());

      if (typeof window !== 'undefined' && (window as any).BX24?.callMethod) {
        try {
          (window as any).BX24.callMethod('timeman.pause', {});
        } catch {}
      }

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      }
    } catch (err) {
      console.error('Failed to start break:', err);
    }
  };

  const handleResumeWork = async () => {
    try {
      const res = await fetch('/api/worktime/break/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: currentAgent?.id }),
      }).then((r) => r.json());

      if (typeof window !== 'undefined' && (window as any).BX24?.callMethod) {
        try {
          (window as any).BX24.callMethod('timeman.open', {});
        } catch {}
      }

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      }
    } catch (err) {
      console.error('Failed to resume work:', err);
    }
  };

  const handleSetStatus = async (status: Agent['status']) => {
    try {
      const res = await fetch('/api/worktime/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, agentId: currentAgent?.id }),
      }).then((r) => r.json());

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSyncBitrixWorktime = async () => {
    try {
      const res = await fetch('/api/worktime/sync-bitrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: currentAgent?.id }),
      }).then((r) => r.json());

      if (res.success) {
        await loadWorktimeAndChats(currentAgent?.id);
      }
    } catch (err) {
      console.error('Failed to sync Bitrix worktime:', err);
    }
  };

  const handleSwitchAgent = async (agentId: string) => {
    try {
      const res = await fetch('/api/worktime/switch-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        setCurrentAgent(res.data.agent);
        setCurrentShift(res.data.shift);
        if (res.data.personalPerformance) {
          setPersonalPerformance(res.data.personalPerformance);
        }
        await loadWorktimeAndChats(res.data.agent.id);
      }
    } catch (err) {
      console.error('Failed to switch agent:', err);
    }
  };

  const handleUpdatePermissions = async (
    agentId: string,
    updates: {
      accessRole: AccessRole;
      assignedChannelIds: number[];
      assignedChannelNames: string[];
      canAccessAllChannels: boolean;
    }
  ) => {
    const res = await fetch(`/api/worktime/agents/${agentId}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then((r) => r.json());

    if (res.success && res.data) {
      setTeam((prev) => prev.map((a) => (a.id === agentId ? res.data : a)));
      if (currentAgent?.id === agentId) {
        setCurrentAgent(res.data);
      }
      await loadWorktimeAndChats(currentAgent?.id);
    } else {
      throw new Error(res.error?.message || 'Эрхийн тохиргоо шинэчлэхэд алдаа гарлаа');
    }
  };

  const handleSyncBitrixAgents = async () => {
    try {
      setIsSyncingBitrixAgents(true);
      const res = await fetch('/api/openlines/sync-agents', { method: 'POST' }).then((r) => r.json());
      if (res.success && res.data) {
        if (Array.isArray(res.data.lines)) {
          setOpenLines(res.data.lines);
        }
        await loadWorktimeAndChats();
      }
    } catch (err) {
      console.error('Failed to sync Bitrix agents:', err);
    } finally {
      setIsSyncingBitrixAgents(false);
    }
  };

  // Handlers
  const handleTogglePolling = async () => {
    if (!botConfig?.botId) return;
    try {
      setIsTogglingPolling(true);
      const nextActive = !botConfig.isPollingActive;
      const res = await fetch('/api/bot/toggle-polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      }).then((r) => r.json());

      if (res.success) {
        setBotConfig((prev) => (prev ? { ...prev, isPollingActive: nextActive } : null));
      }
    } catch (e) {
      console.error('Failed to toggle polling:', e);
    } finally {
      setIsTogglingPolling(false);
    }
  };

  const handleBindLine = async (lineId: number, lineName: string) => {
    const res = await fetch('/api/bot/bind-openline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId, lineName }),
    }).then((r) => r.json());

    if (res.success) {
      setBotConfig((prev) => (prev ? { ...prev, selectedLineId: lineId, selectedLineName: lineName } : null));
      await loadOpenLines();
    } else {
      alert(`Суваг холбоход алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleUnbindLine = async (lineId: number) => {
    const res = await fetch('/api/bot/unbind-openline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId }),
    }).then((r) => r.json());

    if (res.success) {
      if (botConfig?.selectedLineId === lineId) {
        setBotConfig((prev) => (prev ? { ...prev, selectedLineId: null, selectedLineName: '' } : null));
      }
      await loadOpenLines();
    } else {
      alert(`Суваг салгахад алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleRegisterBot = async (name: string, code: string) => {
    const res = await fetch('/api/bot/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    }).then((r) => r.json());

    if (res.success) {
      setBotConfig((prev) =>
        prev
          ? {
              ...prev,
              botId: res.data.botId,
              botName: res.data.name,
              botCode: res.data.code,
            }
          : null
      );
      await loadPortalAndBot();
    } else {
      alert(`Бот бүртгэхэд алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleAddArticle = async (newArt: Omit<KnowledgeArticle, 'id' | 'updatedAt'>) => {
    const res = await fetch('/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newArt),
    }).then((r) => r.json());

    if (res.success) {
      setArticles((prev) => [res.data, ...prev]);
    } else {
      alert(`Нийтлэл нэмэхэд алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleUpdateArticle = async (id: string, updates: Partial<KnowledgeArticle>) => {
    const res = await fetch(`/api/kb/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then((r) => r.json());

    if (res.success) {
      setArticles((prev) => prev.map((a) => (a.id === id ? res.data : a)));
    } else {
      alert(`Нийтлэл засахад алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    const res = await fetch(`/api/kb/${id}`, { method: 'DELETE' }).then((r) => r.json());
    if (res.success) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } else {
      alert(`Нийтлэл устгахад алдаа гарлаа: ${res.error?.message || 'Тодорхойгүй алдаа'}`);
    }
  };

  const handleUpdateBotConfig = async (updates: Partial<BotConfig>) => {
    const res = await fetch('/api/bot/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then((r) => r.json());

    if (res.success) {
      setBotConfig(res.data);
    }
  };

  const handleCreateServer = async (name: string) => {
    const res = await fetch('/api/infra/servers/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => r.json());

    if (res.success) {
      await loadServers();
    } else {
      throw new Error(res.error?.message || 'Сервер үүсгэхэд алдаа гарлаа');
    }
  };

  const isAgentRole = currentAgent?.accessRole === 'agent';

  const allNavItems = [
    {
      id: 'chat',
      label: 'Сувгийн чат (Live)',
      icon: MessageSquare,
      count: chatsCount,
      unread: unreadCount,
    },
    {
      id: 'inquiries',
      label: 'Асуултын Ангилал & AI Тайлан',
      icon: BarChart3,
    },
    { id: 'channels', label: 'Нээлттэй сувгууд', icon: Radio, count: openLines.length },
    { id: 'kb', label: 'Мэдээллийн сан', icon: BookOpen, count: articles.length },
    { id: 'prompts', label: 'AI & Дүрэм', icon: Sliders },
    { id: 'sandbox', label: 'Туршилтын симулятор', icon: Sparkles },
    { id: 'logs', label: 'Диалог лог', icon: History, count: logs.length },
    { id: 'deploy', label: 'Үүлэн сервер (Deploy)', icon: Cloud, count: servers.length },
  ];

  // User requirement: "Agent-ууд Live chat-с бусад цэсийг харах шаардлагагүй"
  const navItems = isAgentRole
    ? allNavItems.filter((item) => item.id === 'chat')
    : allNavItems;

  return (
    <div
      className={`${
        isAgentRole || activeTab === 'chat'
          ? 'h-screen max-h-screen overflow-hidden flex flex-col'
          : 'min-h-screen flex flex-col'
      } bg-slate-50 font-sans text-slate-900 overflow-x-hidden`}
    >
      {/* Top Application Header - only visible for Admin / Supervisor roles */}
      {!isAgentRole && (
        <Header
          portalInfo={portalInfo}
          botConfig={botConfig}
          onTogglePolling={handleTogglePolling}
          isToggling={isTogglingPolling}
          onUnbindLine={handleUnbindLine}
          onNavigateToChannels={() => setActiveTab('channels')}
          isAgentRole={isAgentRole}
          onOpenRedeploy={() => setShowRedeployModal(true)}
          onOpenMobileGuide={() => setShowMobileModal(true)}
        />
      )}

      {/* Operator Worktime & Shift Control Bar (serves as the clean, slim topbar in Agent View) */}
      <WorktimeBar
        currentAgent={currentAgent}
        currentShift={currentShift}
        team={team}
        performanceSummary={personalPerformance}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onStartBreak={handleStartBreak}
        onResumeWork={handleResumeWork}
        onSetStatus={handleSetStatus}
        onSwitchAgent={handleSwitchAgent}
        onSyncBitrix={handleSyncBitrixWorktime}
        onOpenTeamModal={() => setShowTeamModal(true)}
        onOpenPermissionsModal={!isAgentRole ? () => setShowPermissionsModal(true) : undefined}
        isAgentRole={isAgentRole}
        onSwitchToAdmin={() => {
          const adminAgent = team.find((a) => a.accessRole === 'admin') || team[0];
          if (adminAgent) handleSwitchAgent(adminAgent.id);
        }}
        onOpenMobileGuide={() => setShowMobileModal(true)}
      />

      {/* Main Subheader Navigation (Only shown for Admin / Supervisor roles) */}
      {!isAgentRole && (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs shrink-0">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 flex items-center justify-between">
            <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1.5 sm:py-2 scrollbar-none" aria-label="Tabs" style={{ WebkitOverflowScrolling: 'touch' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`tab-${item.id}`}
                    onClick={() => setActiveTab(item.id as ActiveTab)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
                          isActive
                            ? 'bg-blue-800 text-blue-100 font-bold'
                            : item.unread && item.unread > 0
                            ? 'bg-rose-600 text-white font-bold animate-pulse'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.unread && item.unread > 0 ? `${item.unread} шинэ` : item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right quick actions: Mobile guide, View switcher, Permissions, Redeploy */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 py-1 pl-2">
              <button
                id="subnav-mobile-btn"
                onClick={() => setShowMobileModal(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition shrink-0"
                title="Битрикс24 гар утасны апп-д нээх заавар & QR код"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Гар утас</span>
              </button>
              <button
                id="subnav-agent-view-btn"
                onClick={() => {
                  const opAgent = team.find((a) => a.accessRole === 'agent');
                  if (opAgent) handleSwitchAgent(opAgent.id);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition shrink-0 shadow-xs"
                title="Шууд операторын ажлын байр (Live Chat) харагдац руу шилжих"
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-600" />
                <span>Операторын харагдац (Agent View)</span>
              </button>
              <button
                id="subnav-redeploy-btn"
                onClick={() => setShowRedeployModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shrink-0"
                title="Код өөрчлөгдсөн тохиолдолд дахин Build & Deploy хийх"
              >
                <Rocket className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Redeploy</span>
              </button>
              <button
                id="subnav-permissions-btn"
                onClick={() => setShowPermissionsModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition shrink-0"
                title="Операторуудын хандах эрх, хариуцсан сувгийн тохиргоо"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Эрхийн тохиргоо</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <OpenChannelChatWorkplace
            currentAgent={currentAgent}
            team={team}
            openLines={openLines}
            articles={articles}
            onOpenTeamModal={() => setShowTeamModal(true)}
            botConfig={botConfig}
            targetChatId={targetChatId}
            onBindLine={handleBindLine}
            onUnbindLine={handleUnbindLine}
          />
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20">
          {activeTab === 'inquiries' && (
            <InquiryAnalyticsTab
              openLines={openLines}
              onAddArticleToKb={handleAddArticle}
              onNavigateToChat={() => setActiveTab('chat')}
            />
          )}

          {activeTab === 'channels' && (
            <ChannelSelector
              openLines={openLines}
              botConfig={botConfig}
              isLoading={isLoadingChannels}
              onRefresh={loadOpenLines}
              onBindLine={handleBindLine}
              onUnbindLine={handleUnbindLine}
              onRegisterBot={handleRegisterBot}
              onSyncAgents={handleSyncBitrixAgents}
              isSyncingAgents={isSyncingBitrixAgents}
            />
          )}

          {activeTab === 'kb' && (
            <KnowledgeBaseTab
              articles={articles}
              isLoading={isLoadingKB}
              onAddArticle={handleAddArticle}
              onUpdateArticle={handleUpdateArticle}
              onDeleteArticle={handleDeleteArticle}
            />
          )}

          {activeTab === 'prompts' && (
            <PromptSettingsTab
              botConfig={botConfig}
              onUpdateConfig={handleUpdateBotConfig}
            />
          )}

          {activeTab === 'sandbox' && <SandboxTab />}

          {activeTab === 'logs' && (
            <DialogLogsTab
              logs={logs}
              isLoading={isLoadingLogs}
              onRefresh={loadLogs}
              onSelectChat={(chatId) => {
                setTargetChatId(chatId);
                setActiveTab('chat');
              }}
            />
          )}

          {activeTab === 'deploy' && (
            <DeployTab
              servers={servers}
              isLoading={isLoadingServers}
              onRefresh={loadServers}
              onCreateServer={handleCreateServer}
              onOpenRedeployModal={() => setShowRedeployModal(true)}
            />
          )}
        </main>
      )}

      {/* Redeploy Modal */}
      <RedeployModal
        isOpen={showRedeployModal}
        onClose={() => setShowRedeployModal(false)}
      />

      {/* Team Presence & Worktime Modal */}
      <WorktimeModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        team={team}
        currentAgent={currentAgent}
        onSwitchAgent={handleSwitchAgent}
        onRefresh={loadWorktimeAndChats}
        onSyncAgents={handleSyncBitrixAgents}
        isSyncingAgents={isSyncingBitrixAgents}
        onOpenPermissions={!isAgentRole ? () => setShowPermissionsModal(true) : undefined}
      />

      {/* Agent Permissions & Channel Assignment Modal */}
      <AgentPermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        team={team}
        agents={team}
        openLines={openLines}
        currentAgent={currentAgent}
        onUpdatePermissions={handleUpdatePermissions}
        onSwitchAgent={handleSwitchAgent}
      />
      {/* Bitrix24 Mobile App & PWA Modal */}
      <BitrixMobileModal
        isOpen={showMobileModal}
        onClose={() => setShowMobileModal(false)}
      />
    </div>
  );
}
