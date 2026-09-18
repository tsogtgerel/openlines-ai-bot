import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Play,
  Pause,
  LogOut,
  Coffee,
  Users,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Agent, WorkShift, AccessRole, PersonalPerformanceSummary } from '../types';
import { AgentPersonalPerformanceSummary } from './AgentPersonalPerformanceSummary';

interface WorktimeBarProps {
  currentAgent: Agent | null;
  currentShift: WorkShift | null;
  team: Agent[];
  performanceSummary?: PersonalPerformanceSummary | null;
  onClockIn: () => Promise<void>;
  onClockOut: (report?: string) => Promise<void>;
  onStartBreak: () => Promise<void>;
  onResumeWork: () => Promise<void>;
  onSetStatus: (status: Agent['status']) => Promise<void>;
  onSwitchAgent: (agentId: string) => Promise<void>;
  onSyncBitrix?: () => Promise<void>;
  onOpenTeamModal: () => void;
  onOpenPermissionsModal?: () => void;
  isAgentRole?: boolean;
  onSwitchToAdmin?: () => void;
  onOpenMobileGuide?: () => void;
}

export const WorktimeBar: React.FC<WorktimeBarProps> = ({
  currentAgent,
  currentShift,
  team,
  performanceSummary,
  onClockIn,
  onClockOut,
  onStartBreak,
  onResumeWork,
  onSetStatus,
  onSwitchAgent,
  onSyncBitrix,
  onOpenTeamModal,
  onOpenPermissionsModal,
  isAgentRole = false,
  onSwitchToAdmin,
  onOpenMobileGuide,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [dailyReport, setDailyReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingBitrix, setIsSyncingBitrix] = useState(false);
  const [internalPerformance, setInternalPerformance] = useState<PersonalPerformanceSummary | null>(
    performanceSummary || null
  );

  // Sync prop changes
  useEffect(() => {
    if (performanceSummary) {
      setInternalPerformance(performanceSummary);
    }
  }, [performanceSummary]);

  // Dynamically load active agent's today performance stats whenever agent switches
  useEffect(() => {
    if (!currentAgent) return;
    let isMounted = true;
    fetch('/api/analytics/agent-performance?timeRange=today')
      .then((r) => r.json())
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          const matched = res.data.find(
            (s: any) =>
              s.agentId === currentAgent.id ||
              s.name?.trim().toLowerCase() === currentAgent.name?.trim().toLowerCase()
          );
          if (matched) {
            setInternalPerformance({
              chatsHandledToday: matched.totalChatsHandled,
              resolvedToday: matched.resolvedChatsCount,
              activeChatsCount: matched.activeChatsCount,
              avgResponseTimeSeconds: matched.avgResponseTimeSeconds,
              avgResponseTimeFormatted: matched.avgResponseTimeFormatted,
              rating: matched.rating,
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentAgent?.id]);

  // Combine live shift resolved count with performance data
  const effectivePerformance: PersonalPerformanceSummary = useMemo(() => {
    const shiftResolved = currentShift?.chatsResolved ?? 0;
    const baseHandled = internalPerformance?.chatsHandledToday ?? 0;
    const baseResolved = internalPerformance?.resolvedToday ?? 0;

    return {
      chatsHandledToday: Math.max(baseHandled, shiftResolved),
      resolvedToday: Math.max(baseResolved, shiftResolved),
      activeChatsCount: internalPerformance?.activeChatsCount ?? 0,
      avgResponseTimeSeconds: internalPerformance?.avgResponseTimeSeconds ?? 42,
      avgResponseTimeFormatted: internalPerformance?.avgResponseTimeFormatted || '42 сек',
      rating: internalPerformance?.rating ?? 4.9,
    };
  }, [internalPerformance, currentShift?.chatsResolved]);

  // Live timer for active shift
  useEffect(() => {
    if (!currentShift || !currentShift.isClockedIn || currentShift.isOnBreak) {
      if (currentShift) {
        setElapsedSeconds(currentShift.workedSeconds || 0);
      } else {
        setElapsedSeconds(0);
      }
      return;
    }

    const clockInMs = new Date(currentShift.clockInTime).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const totalSec = Math.floor((now - clockInMs) / 1000);
      const actualWorked = Math.max(0, totalSec - (currentShift.totalBreakSeconds || 0));
      setElapsedSeconds(actualWorked);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [currentShift]);

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const statusConfig = {
    online: { label: 'Бэлэн (Online)', color: 'bg-emerald-500', text: 'text-emerald-400' },
    busy: { label: 'Завгүй (Busy)', color: 'bg-amber-500', text: 'text-amber-400' },
    break: { label: 'Завсарлага (Break)', color: 'bg-orange-500', text: 'text-orange-400' },
    offline: { label: 'Ажил тарсан (Offline)', color: 'bg-slate-500', text: 'text-slate-400' },
  };

  const handleConfirmClockOut = async () => {
    try {
      setIsSubmitting(true);
      await onClockOut(dailyReport);
      setShowClockOutModal(false);
      setDailyReport('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockInAction = async () => {
    try {
      setIsSubmitting(true);
      await onClockIn();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartBreakAction = async () => {
    try {
      setIsSubmitting(true);
      await onStartBreak();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeAction = async () => {
    try {
      setIsSubmitting(true);
      await onResumeWork();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncBitrixAction = async () => {
    if (!onSyncBitrix) return;
    try {
      setIsSyncingBitrix(true);
      await onSyncBitrix();
    } finally {
      setIsSyncingBitrix(false);
    }
  };

  if (!currentAgent) return null;

  const isClockedIn = currentShift?.isClockedIn ?? false;
  const isOnBreak = currentShift?.isOnBreak ?? false;

  return (
    <>
      {isAgentRole ? (
        /* ============================================================
           AGENT VIEW: Ultra-slim, single-row Essential Header (44-48px)
           Maximized vertical space for the live chat interface
           ============================================================ */
        <header
          id="agent-essential-header"
          className="w-full h-11 sm:h-12 bg-slate-900 border-b border-slate-800 text-xs text-slate-200 px-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-20 select-none overflow-x-auto scrollbar-none"
        >
          {/* Left: Brand + Agent Profile & Status */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Brand Accent */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800 shrink-0">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs font-black text-[10px] tracking-tight">
                BSB
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[11px] font-bold text-white leading-none">Live Chat</span>
                <span className="text-[9px] text-emerald-400 font-medium leading-tight">Оператор</span>
              </div>
            </div>

            {/* Agent Switcher Button */}
            <div className="relative">
              <button
                id="switch-agent-btn"
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="flex items-center gap-1.5 p-1 pr-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition"
                title="Агент солих / Профайл"
              >
                <div className="relative shrink-0">
                  <img
                    src={currentAgent.avatar}
                    alt={currentAgent.name}
                    className="w-6 h-6 rounded-full object-cover border border-slate-600"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                      statusConfig[currentAgent.status]?.color || 'bg-slate-500'
                    }`}
                  />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-white leading-tight flex items-center gap-1">
                    <span className="truncate max-w-[70px] sm:max-w-[130px]">{currentAgent.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </div>
              </button>

              {/* Agent Switch Dropdown */}
              {showAgentDropdown && (
                <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 border-b border-slate-800 flex items-center justify-between">
                    <span>Оператор солих</span>
                    <span className="text-[10px] text-blue-400 font-mono">Нийт: {team.length}</span>
                  </div>
                  {team.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        onSwitchAgent(a.id);
                        setShowAgentDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                        a.id === currentAgent.id
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img src={a.avatar} alt={a.name} className="w-5 h-5 rounded-full object-cover" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                            statusConfig[a.status]?.color || 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-medium text-white text-[11px] truncate flex items-center gap-1">
                          <span>{a.name}</span>
                          <span
                            className={`text-[8px] font-semibold px-1 py-0.2 rounded ${
                              a.accessRole === 'admin'
                                ? 'bg-purple-900/60 text-purple-300'
                                : a.accessRole === 'supervisor'
                                ? 'bg-blue-900/60 text-blue-300'
                                : 'bg-emerald-950/60 text-emerald-300'
                            }`}
                          >
                            {a.accessRole === 'admin' ? 'Админ' : a.accessRole === 'supervisor' ? 'Ахлах' : 'Оператор'}
                          </span>
                        </div>
                      </div>
                      {a.id === currentAgent.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status Selector Dropdown */}
            <div className="relative">
              <button
                id="agent-status-dropdown-btn"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700 font-medium transition text-[11px]"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig[currentAgent.status]?.color || 'bg-emerald-500'}`} />
                <span className="text-slate-200 truncate max-w-[55px] sm:max-w-none">
                  {(statusConfig[currentAgent.status]?.label || 'Ажиллаж буй').split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5 shrink-0" />
              </button>

              {showStatusDropdown && (
                <div className="absolute left-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-1 space-y-0.5">
                  {(['online', 'busy', 'break', 'offline'] as Agent['status'][]).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        onSetStatus(st);
                        setShowStatusDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition ${
                        currentAgent.status === st
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusConfig[st].color}`} />
                      <span>{statusConfig[st].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center: Shift timer & Bitrix Timeman & Resolved chats */}
          <div className="hidden md:flex items-center gap-2.5 lg:gap-3 shrink-0">
            {/* Shift Timer */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80">
              <Clock className={`w-3.5 h-3.5 ${isClockedIn ? (isOnBreak ? 'text-orange-400 animate-pulse' : 'text-emerald-400') : 'text-slate-500'}`} />
              <span className="text-slate-400 text-[10px]">Ээлж:</span>
              <span className={`font-mono font-bold text-xs tracking-wide ${isClockedIn ? (isOnBreak ? 'text-orange-300' : 'text-emerald-300') : 'text-slate-500'}`}>
                {formatTimer(elapsedSeconds)}
              </span>
              {isOnBreak && (
                <span className="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-orange-950 text-orange-400 border border-orange-800">
                  Завсарлага
                </span>
              )}
            </div>

            {/* Bitrix24 Timeman Sync Status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px]">
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                      ? 'bg-emerald-400'
                      : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                      ? 'bg-emerald-500'
                      : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                      ? 'bg-amber-500'
                      : 'bg-slate-500'
                  }`}
                />
              </span>
              <span className="text-slate-400 font-mono text-[10px]">Bitrix:</span>
              <span
                className={`font-semibold font-mono text-[10px] ${
                  currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                    ? 'text-emerald-300'
                    : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              >
                {currentAgent.bitrixWorkdayStatus || (isClockedIn ? 'OPENED' : 'CLOSED')}
              </span>
              {onSyncBitrix && (
                <button
                  type="button"
                  onClick={handleSyncBitrixAction}
                  disabled={isSyncingBitrix}
                  title="Bitrix24 timeman статусыг дахин шалгах"
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition disabled:opacity-50"
                >
                  <RotateCcw className={`w-3 h-3 ${isSyncingBitrix ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Small Personal Performance Summary Component (Chats handled today & Avg response time) */}
            <AgentPersonalPerformanceSummary
              currentAgent={currentAgent}
              performance={effectivePerformance}
              isClockedIn={isClockedIn}
            />
          </div>

          {/* Right: Actions, Presence, Mobile guide & Admin Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile timer if screen is smaller than md */}
            <div className="flex sm:hidden items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-emerald-400">
              <Clock className="w-3 h-3" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            {!isClockedIn ? (
              <button
                id="clock-in-btn"
                onClick={handleClockInAction}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs active:scale-95 disabled:opacity-60"
              >
                <Play className={`w-3 h-3 fill-current ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>{isSubmitting ? '...' : 'Clock In'}</span>
              </button>
            ) : (
              <>
                {isOnBreak ? (
                  <button
                    id="resume-work-btn"
                    onClick={handleResumeAction}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition disabled:opacity-60"
                  >
                    <Play className={`w-3 h-3 fill-current ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>Буцах</span>
                  </button>
                ) : (
                  <button
                    id="start-break-btn"
                    onClick={handleStartBreakAction}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 border border-amber-600/40 font-medium text-xs transition disabled:opacity-60"
                  >
                    <Coffee className="w-3 h-3" />
                    <span className="hidden sm:inline">Завсарлага</span>
                  </button>
                )}

                <button
                  id="clock-out-modal-btn"
                  onClick={() => setShowClockOutModal(true)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 font-medium text-xs transition disabled:opacity-60"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Тарсан</span>
                </button>
              </>
            )}

            {/* Team Presence Modal */}
            <button
              id="team-presence-modal-btn"
              onClick={onOpenTeamModal}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition text-xs shrink-0"
              title="Багийн бүх операторуудын төлөв харах"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden lg:inline">Баг</span>
              <span className="px-1 py-0.2 rounded bg-slate-900 text-[10px] text-slate-300 font-mono">
                {team.filter((t) => t.status === 'online').length}/{team.length}
              </span>
            </button>

            {/* Mobile Guide & QR modal */}
            {onOpenMobileGuide && (
              <button
                type="button"
                id="agent-bar-mobile-btn"
                onClick={onOpenMobileGuide}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 transition text-xs shrink-0"
                title="Битрикс24 гар утасны апп-д нээх заавар & QR код"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xl:inline">Гар утас</span>
              </button>
            )}

            {/* Switch back to Admin View */}
            {onSwitchToAdmin && (
              <button
                type="button"
                id="agent-bar-switch-admin-btn"
                onClick={onSwitchToAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium text-xs transition shrink-0 shadow-xs"
                title="Админ харагдац руу шилжих"
              >
                <Shield className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Админ</span>
              </button>
            )}
          </div>
        </header>
      ) : (
        /* ============================================================
           ADMIN / SUPERVISOR VIEW: Standard WorktimeBar
           ============================================================ */
        <div className="bg-slate-900 border-b border-slate-800 text-xs text-slate-200 px-2.5 sm:px-5 py-1.5 sm:py-2">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-1.5 sm:gap-3">
            {/* Top / Left Section: Agent info, status */}
            <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3">
              <div className="relative">
                <button
                  id="switch-agent-btn"
                  onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                  className="flex items-center gap-2 p-1 pr-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition"
                  title="Агент солих"
                >
                  <div className="relative shrink-0">
                    <img
                      src={currentAgent.avatar}
                      alt={currentAgent.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-600"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                        statusConfig[currentAgent.status]?.color || 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="font-semibold text-white leading-tight flex items-center gap-1.5">
                      <span className="truncate max-w-[100px] sm:max-w-none">{currentAgent.name}</span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md ${
                          currentAgent.accessRole === 'admin'
                            ? 'bg-purple-900/80 text-purple-300 border border-purple-700/60'
                            : currentAgent.accessRole === 'supervisor'
                            ? 'bg-blue-900/80 text-blue-300 border border-blue-700/60'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {currentAgent.accessRole === 'admin'
                          ? 'Админ'
                          : currentAgent.accessRole === 'supervisor'
                          ? 'Ахлах'
                          : 'Оператор'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight truncate">{currentAgent.role}</div>
                  </div>
                </button>

                {/* Agent Switch Dropdown */}
                {showAgentDropdown && (
                  <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>Оператор сонгох</span>
                      <span className="text-[10px] text-blue-400 font-mono">Баг: {team.length}</span>
                    </div>
                    {team.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onSwitchAgent(a.id);
                          setShowAgentDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition ${
                          a.id === currentAgent.id
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="relative">
                          <img src={a.avatar} alt={a.name} className="w-6 h-6 rounded-full object-cover" />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                              statusConfig[a.status]?.color || 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <div className="flex-1 truncate">
                          <div className="font-medium text-white text-xs truncate flex items-center gap-1.5">
                            <span>{a.name}</span>
                            <span
                              className={`text-[8px] font-semibold px-1 py-0.2 rounded ${
                                a.accessRole === 'admin'
                                ? 'bg-purple-900/60 text-purple-300'
                                : a.accessRole === 'supervisor'
                                ? 'bg-blue-900/60 text-blue-300'
                                : 'bg-emerald-950/60 text-emerald-300'
                              }`}
                            >
                              {a.accessRole === 'admin'
                                ? 'Админ'
                                : a.accessRole === 'supervisor'
                                ? 'Ахлах'
                                : 'Оператор'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{a.role}</div>
                        </div>
                        {a.id === currentAgent.id && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status selector badge */}
              <div className="relative">
                <button
                  id="agent-status-dropdown-btn"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700 font-medium transition"
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig[currentAgent.status]?.color || 'bg-emerald-500'}`} />
                  <span className="text-slate-200 truncate max-w-[80px] sm:max-w-none">
                    {(statusConfig[currentAgent.status]?.label || 'Ажиллаж буй').split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5 shrink-0" />
                </button>

                {showStatusDropdown && (
                  <div className="absolute left-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-1 space-y-0.5">
                    {(['online', 'busy', 'break', 'offline'] as Agent['status'][]).map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          onSetStatus(st);
                          setShowStatusDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition ${
                          currentAgent.status === st
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusConfig[st].color}`} />
                        <span>{statusConfig[st].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile team presence button */}
              <button
                id="team-presence-modal-btn"
                onClick={onOpenTeamModal}
                className="flex md:hidden items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition text-xs shrink-0"
                title="Багийн бүх агентуудын төлөв харах"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="px-1 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                  {team.filter((t) => t.status === 'online').length}/{team.length}
                </span>
              </button>
            </div>

            {/* Center: Clock-in timer & work stats */}
            <div className="flex items-center justify-between md:justify-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-700/80">
                <Clock className={`w-3.5 h-3.5 ${isClockedIn ? (isOnBreak ? 'text-orange-400 animate-pulse' : 'text-emerald-400') : 'text-slate-500'}`} />
                <span className="text-slate-400 text-[11px]">Ажилласан:</span>
                <span className={`font-mono font-bold text-xs sm:text-sm tracking-wide ${isClockedIn ? (isOnBreak ? 'text-orange-300' : 'text-emerald-300') : 'text-slate-500'}`}>
                  {formatTimer(elapsedSeconds)}
                </span>
                {isOnBreak && (
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-orange-950 text-orange-400 border border-orange-800">
                    Завсарлага
                  </span>
                )}
              </div>

              {/* Agent Personal Performance Summary */}
              <div className="hidden lg:flex items-center">
                <AgentPersonalPerformanceSummary
                  currentAgent={currentAgent}
                  performance={effectivePerformance}
                  isClockedIn={isClockedIn}
                />
              </div>

              {/* Bitrix24 Timeman Sync Status */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/60 text-[11px]">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                        ? 'bg-emerald-400'
                        : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                        ? 'bg-emerald-500'
                        : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                        ? 'bg-amber-500'
                        : 'bg-slate-500'
                    }`}
                  />
                </span>
                <span className="text-slate-400 font-mono text-[10px]">Bitrix:</span>
                <span
                  className={`font-semibold font-mono text-[10px] ${
                    currentAgent.bitrixWorkdayStatus === 'OPENED' || isClockedIn
                      ? 'text-emerald-300'
                      : currentAgent.bitrixWorkdayStatus === 'PAUSED' || isOnBreak
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {currentAgent.bitrixWorkdayStatus || (isClockedIn ? 'OPENED' : 'CLOSED')}
                </span>
                {onSyncBitrix && (
                  <button
                    type="button"
                    onClick={handleSyncBitrixAction}
                    disabled={isSyncingBitrix}
                    title="Bitrix24 timeman статусыг дахин шалгах"
                    className="p-0.5 ml-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3 h-3 ${isSyncingBitrix ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                )}
              </div>

              {/* Right: Clock-in / Clock-out & Break actions (Inline on mobile/desktop) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isClockedIn ? (
                  <button
                    id="clock-in-btn"
                    onClick={handleClockInAction}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm shadow-emerald-600/20 active:scale-95 disabled:opacity-60"
                  >
                    <Play className={`w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{isSubmitting ? 'Нээж байна...' : 'Clock In'}</span>
                  </button>
                ) : (
                  <>
                    {isOnBreak ? (
                      <button
                        id="resume-work-btn"
                        onClick={handleResumeAction}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition disabled:opacity-60"
                      >
                        <Play className={`w-3 h-3 fill-current ${isSubmitting ? 'animate-spin' : ''}`} />
                        <span>{isSubmitting ? '...' : 'Буцах'}</span>
                      </button>
                    ) : (
                      <button
                        id="start-break-btn"
                        onClick={handleStartBreakAction}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 border border-amber-600/40 font-medium text-xs transition disabled:opacity-60"
                      >
                        <Coffee className="w-3 h-3" />
                        <span className="hidden sm:inline">Завсарлага</span>
                      </button>
                    )}

                    <button
                      id="clock-out-modal-btn"
                      onClick={() => setShowClockOutModal(true)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 font-medium text-xs transition disabled:opacity-60"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Тарсан</span>
                    </button>
                  </>
                )}

                {/* Desktop team presence modal toggle */}
                <button
                  id="team-presence-modal-btn-desktop"
                  onClick={onOpenTeamModal}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition text-xs shrink-0"
                  title="Багийн бүх агентуудын төлөв харах"
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden lg:inline">Баг</span>
                  <span className="px-1 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {team.filter((t) => t.status === 'online').length}/{team.length}
                  </span>
                </button>

                {/* Mobile Guide & QR code shortcut */}
                {onOpenMobileGuide && (
                  <button
                    type="button"
                    id="agent-bar-mobile-btn"
                    onClick={onOpenMobileGuide}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 transition text-xs shrink-0"
                    title="Битрикс24 гар утасны апп-д нээх заавар & QR код"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden xl:inline">Гар утас</span>
                  </button>
                )}

                {/* Permissions modal toggle for Admin / Supervisor */}
                {onOpenPermissionsModal && (
                  <button
                    id="agent-permissions-modal-btn"
                    onClick={onOpenPermissionsModal}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-200 border border-indigo-700/50 transition text-xs shrink-0"
                    title="Операторуудын эрх, сувгийн тохиргоог удирдах"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Эрхийн тохиргоо</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clock Out Confirmation Modal */}
      {showClockOutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Ажлын ээлж дуусгах (Clock Out)</h3>
                <p className="text-xs text-slate-400">Та өнөөдрийн ажлаа тарж, системийг хаахдаа итгэлтэй байна уу?</p>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/70 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Нийт ажилласан хугацаа:</span>
                <span className="font-mono font-bold text-white">{formatTimer(elapsedSeconds)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Шийдвэрлэсэн чатын тоо:</span>
                <span className="font-semibold text-emerald-400">{currentShift?.chatsResolved ?? 0}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Өдрийн ажлын тайлан / Тэмдэглэл (Сонголттой):
              </label>
              <textarea
                value={dailyReport}
                onChange={(e) => setDailyReport(e.target.value)}
                placeholder="Өнөөдөр хийсэн ажил, шийдвэрлэсэн онцлох хэрэглэгчийн асуудлууд..."
                rows={3}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClockOutModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Цуцлах
              </button>
              <button
                type="button"
                id="confirm-clock-out-btn"
                onClick={handleConfirmClockOut}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/30"
              >
                {isSubmitting ? 'Дуусгаж байна...' : 'Ажил тарах (Clock Out)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
