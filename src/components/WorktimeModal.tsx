import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  Coffee,
  MessageSquare,
  FileText,
  UserCheck,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Agent, WorkShift } from '../types';

interface WorktimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Agent[];
  currentAgent: Agent | null;
  onSwitchAgent: (agentId: string) => Promise<void>;
  onRefresh: () => void;
  onSyncAgents?: () => Promise<void>;
  isSyncingAgents?: boolean;
}

export const WorktimeModal: React.FC<WorktimeModalProps> = ({
  isOpen,
  onClose,
  team,
  currentAgent,
  onSwitchAgent,
  onRefresh,
  onSyncAgents,
  isSyncingAgents = false,
}) => {
  const [activeTab, setActiveTab] = useState<'team' | 'history'>('team');
  const [shiftsHistory, setShiftsHistory] = useState<WorkShift[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, activeTab]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch('/api/worktime/history').then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        setShiftsHistory(res.data);
      }
    } catch (e) {
      console.error('Failed to load shifts history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const statusConfig = {
    online: { label: 'Бэлэн (Online)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    busy: { label: 'Завгүй (Busy)', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    break: { label: 'Завсарлага (Break)', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
    offline: { label: 'Ажил тарсан (Offline)', badge: 'bg-slate-100 text-slate-600 border-slate-300' },
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}ц ${m}мин`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                Ажлын цагийн бүртгэл & Багийн төлөв
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Битрикс24 Open Channels операторуудын Clock-In/Out ба шууд төлөв
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-4 sm:px-6 pt-2 sm:pt-3 flex gap-2 border-b border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-2 sm:pb-2.5 px-2.5 sm:px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Багийн гишүүд ({team.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 sm:pb-2.5 px-2.5 sm:px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Ээлжийн түүх & Тайлан</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'team' ? (
            <div className="space-y-4">
              {/* Bitrix Sync Header Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Битрикс24-тэй холбогдсон:</span> Нийт{' '}
                  <strong className="text-blue-600 font-mono">{team.length}</strong> оператор бүртгэлтэй
                  байна.
                </div>
                {onSyncAgents && (
                  <button
                    type="button"
                    onClick={onSyncAgents}
                    disabled={isSyncingAgents}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAgents ? 'animate-spin' : ''}`} />
                    <span>{isSyncingAgents ? 'Түр хүлээнэ үү...' : 'Битриксээс татах'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {team.map((agent) => {
                  const isCurrent = agent.id === currentAgent?.id;
                  const assignedChannels = agent.assignedChannelNames || [];

                  return (
                    <div
                      key={agent.id}
                      className={`p-3.5 rounded-xl border transition ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{agent.name}</span>
                              {agent.bitrixUserId && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{agent.bitrixUserId}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">
                                  Та
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{agent.role}</div>
                            {agent.phone && (
                              <div className="text-[11px] text-slate-400">{agent.phone}</div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                            statusConfig[agent.status]?.badge || 'bg-slate-100'
                          }`}
                        >
                          {statusConfig[agent.status]?.label}
                        </span>
                      </div>

                      {/* Assigned Channels tags if available */}
                      {assignedChannels.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">
                            Хариуцсан сувгууд ({assignedChannels.length}):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {assignedChannels.slice(0, 3).map((chName, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 truncate max-w-[150px]"
                                title={chName}
                              >
                                {chName}
                              </span>
                            ))}
                            {assignedChannels.length > 3 && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-400">
                                +{assignedChannels.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {agent.isClockedIn ? '🟢 Ажилдаа гарсан' : '⚪ Ажил тарсан'}
                        </span>
                        {!isCurrent && (
                          <button
                            onClick={async () => {
                              await onSwitchAgent(agent.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                          >
                            Энэ агентаар нэвтрэх
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isLoadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">Түүх ачаалж байна...</div>
              ) : shiftsHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Ээлжийн түүх олдсонгүй</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {shiftsHistory.map((shift) => (
                    <div key={shift.id} className="p-3 hover:bg-slate-50 transition text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 font-semibold">{shift.agentName}</span>
                          <span className="text-slate-400">• {shift.date}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            shift.isClockedIn
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {shift.isClockedIn ? 'Идэвхтэй ээлж' : 'Таралт хийсэн'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-slate-600 text-[11px]">
                        <span>
                          Эхэлсэн:{' '}
                          <strong className="text-slate-800">
                            {new Date(shift.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                        </span>
                        {shift.clockOutTime && (
                          <span>
                            Дууссан:{' '}
                            <strong className="text-slate-800">
                              {new Date(shift.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </strong>
                          </span>
                        )}
                        <span>
                          Нийт ажилласан:{' '}
                          <strong className="text-emerald-700">{formatSeconds(shift.workedSeconds)}</strong>
                        </span>
                        <span>
                          Шийдсэн чат: <strong className="text-blue-700">{shift.chatsResolved || 0}</strong>
                        </span>
                      </div>
                      {shift.dailyReport && (
                        <div className="mt-1 p-2 rounded-lg bg-slate-100 text-slate-700 text-[11px] italic">
                          "{shift.dailyReport}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
