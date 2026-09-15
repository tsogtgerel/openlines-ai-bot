import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Agent, WorkShift } from '../types';

interface WorktimeBarProps {
  currentAgent: Agent | null;
  currentShift: WorkShift | null;
  team: Agent[];
  onClockIn: () => Promise<void>;
  onClockOut: (report?: string) => Promise<void>;
  onStartBreak: () => Promise<void>;
  onResumeWork: () => Promise<void>;
  onSetStatus: (status: Agent['status']) => Promise<void>;
  onSwitchAgent: (agentId: string) => Promise<void>;
  onOpenTeamModal: () => void;
}

export const WorktimeBar: React.FC<WorktimeBarProps> = ({
  currentAgent,
  currentShift,
  team,
  onClockIn,
  onClockOut,
  onStartBreak,
  onResumeWork,
  onSetStatus,
  onSwitchAgent,
  onOpenTeamModal,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [dailyReport, setDailyReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (!currentAgent) return null;

  const isClockedIn = currentShift?.isClockedIn ?? false;
  const isOnBreak = currentShift?.isOnBreak ?? false;

  return (
    <>
      <div className="bg-slate-800/95 border-b border-slate-700/80 px-3 sm:px-6 py-2 text-xs text-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
          {/* Top / Left Section: Agent info, status, and mobile timer */}
          <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3">
            <div className="relative">
              <button
                id="switch-agent-btn"
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="flex items-center gap-2 p-1 pr-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700 transition"
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
                  <div className="font-semibold text-white leading-tight flex items-center gap-1">
                    <span className="truncate max-w-[100px] sm:max-w-none">{currentAgent.name}</span>
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
                        <div className="font-medium text-white text-xs truncate">{a.name}</div>
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
                <span className={`w-2 h-2 rounded-full ${statusConfig[currentAgent.status]?.color}`} />
                <span className="text-slate-200 truncate max-w-[80px] sm:max-w-none">
                  {statusConfig[currentAgent.status]?.label.split(' ')[0]}
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

            <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-[11px]">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Өнөөдөр шийдсэн чат:</span>
              <span className="font-semibold text-white">{currentShift?.chatsResolved ?? 0}</span>
            </div>

            {/* Right: Clock-in / Clock-out & Break actions (Inline on mobile/desktop) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isClockedIn ? (
                <button
                  id="clock-in-btn"
                  onClick={onClockIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm shadow-emerald-600/20 active:scale-95"
                >
                  <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                  <span>Clock In</span>
                </button>
              ) : (
                <>
                  {isOnBreak ? (
                    <button
                      id="resume-work-btn"
                      onClick={onResumeWork}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Буцах</span>
                    </button>
                  ) : (
                    <button
                      id="start-break-btn"
                      onClick={onStartBreak}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 border border-amber-600/40 font-medium text-xs transition"
                    >
                      <Coffee className="w-3 h-3" />
                      <span className="hidden sm:inline">Завсарлага</span>
                    </button>
                  )}

                  <button
                    id="clock-out-modal-btn"
                    onClick={() => setShowClockOutModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 font-medium text-xs transition"
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
            </div>
          </div>
        </div>
      </div>

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
