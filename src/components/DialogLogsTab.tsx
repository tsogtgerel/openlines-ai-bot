import React, { useState, useMemo } from 'react';
import {
  History,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  Tag,
  Search,
  Bot,
  User,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Filter,
  Layers,
} from 'lucide-react';
import { DialogLog } from '../types';

interface DialogLogsTabProps {
  logs: DialogLog[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectChat?: (chatId: string) => void;
}

export const DialogLogsTab: React.FC<DialogLogsTabProps> = ({
  logs,
  isLoading,
  onRefresh,
  onSelectChat,
}) => {
  const [filter, setFilter] = useState<'all' | 'answered' | 'handed_off' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  // Extract unique channels from logs
  const availableChannels = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => {
      if (log.channelName) {
        const idKey = String(log.channelId || log.channelName);
        if (!map.has(idKey)) {
          map.set(idKey, log.channelName);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filtered and searched logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Status/Handoff filter
      if (filter === 'answered' && log.handedOff) return false;
      if (filter === 'handed_off' && !log.handedOff) return false;
      if (filter === 'closed' && log.status !== 'closed') return false;

      // 2. Channel filter
      if (selectedChannel !== 'all') {
        const matchesChanId = String(log.channelId || '') === selectedChannel;
        const matchesChanName = log.channelName === selectedChannel;
        if (!matchesChanId && !matchesChanName) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCust = (log.customerName || '').toLowerCase().includes(q);
        const matchesMsg = (log.customerMessage || '').toLowerCase().includes(q);
        const matchesAns = (log.botAnswer || '').toLowerCase().includes(q);
        const matchesId = (log.dialogId || '').toLowerCase().includes(q) || (log.chatId || '').toLowerCase().includes(q);
        const matchesResp = (log.responderName || '').toLowerCase().includes(q);
        const matchesChan = (log.channelName || '').toLowerCase().includes(q);
        if (!matchesCust && !matchesMsg && !matchesAns && !matchesId && !matchesResp && !matchesChan) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filter, selectedChannel, searchQuery]);

  const totalLogs = logs.length;
  const handedOffCount = logs.filter((l) => l.handedOff).length;
  const answeredCount = logs.filter((l) => !l.handedOff).length;
  const closedCount = logs.filter((l) => l.status === 'closed').length;
  const handoffRate = totalLogs > 0 ? Math.round((handedOffCount / totalLogs) * 100) : 0;

  const getHandoffReasonLabel = (reason?: string) => {
    switch (reason) {
      case 'keyword':
        return 'Түлхүүр үг илэрсэн';
      case 'user_button':
        return '"Оператор дуудах" товч дарсан';
      case 'low_confidence':
        return 'Мэдээллийн санд олдсонгүй';
      case 'model_declined':
        return 'Мэдээлэл хангалтгүй (AI)';
      case 'ai_error':
        return 'Холболтын алдаа';
      case 'assigned_to_operator':
        return 'Операторт хуваарилагдсан';
      case 'manual_transfer':
        return 'Гараар шилжүүлсэн';
      default:
        return 'Операторт шилжүүлсэн';
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const now = new Date();
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Өнөөдөр ${timeStr}`;
      return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
    } catch {
      return ts;
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '-';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec} сек`;
    return `${(sec / 60).toFixed(1)} мин`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <History className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Диалог ба Харилцан ярианы лог
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Битрикс24 нээлттэй сувгуудаар ирсэн харилцагчдын мессеж, AI ботын өгсөн хариулт, операторын шилжүүлэлтийн бодит түүх.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
          Лог дахин ачаалах
        </button>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Нийт Харилцан яриа</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{totalLogs}</div>
          <span className="text-[11px] text-slate-400 block mt-0.5">Бүх сувгийн лог</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>AI Автомат хариулсан</span>
            <Bot className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{answeredCount}</div>
          <span className="text-[11px] text-emerald-700/80 font-medium block mt-0.5">
            {totalLogs > 0 ? Math.round((answeredCount / totalLogs) * 100) : 0}% автоматжилт
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Операторт шилжсэн</span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{handedOffCount}</div>
          <span className="text-[11px] text-amber-700/80 font-medium block mt-0.5">
            {handoffRate}% шилжүүлэлт
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Шийдвэрлэгдсэн</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1">{closedCount}</div>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {totalLogs > 0 ? Math.round((closedCount / totalLogs) * 100) : 0}% бүрэн хаагдсан
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                filter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Бүх лог ({totalLogs})
            </button>
            <button
              type="button"
              onClick={() => setFilter('answered')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                filter === 'answered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              AI Хариулсан ({answeredCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('handed_off')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                filter === 'handed_off'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Операторт шилжсэн ({handedOffCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('closed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                filter === 'closed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Шийдэгдсэн ({closedCount})
            </button>
          </div>

          {/* Channel dropdown */}
          {availableChannels.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Суваг:
              </span>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] truncate"
              >
                <option value="all">Бүх суваг ({availableChannels.length})</option>
                {availableChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Харилцагчийн нэр, асуултын үг, ID, суваг, эсвэл операторын нэрээр хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/70 placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Result Count */}
        {(searchQuery || selectedChannel !== 'all' || filter !== 'all') && (
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>
              Шүүлтэд таарсан: <strong className="text-slate-800">{filteredLogs.length}</strong> лог
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedChannel('all');
                setFilter('all');
              }}
              className="text-blue-600 hover:underline font-medium"
            >
              Бүх шүүлтийг арилгах
            </button>
          </div>
        )}
      </div>

      {/* Logs Feed */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 sm:p-14 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {logs.length === 0 ? 'Одоогоор чатын лог бүртгэгдээгүй байна' : 'Шүүлтэд тохирох лог олдсонгүй'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {logs.length === 0
              ? 'Харилцагч Битрикс24 нээлттэй сувгаар мессеж бичих үед эсвэл симулятороор туршилт хийхэд бүх харилцан яриа энд бодит цагаар хадгалагдан харагдана.'
              : 'Хайсан үг эсвэл сувгийн шүүлтүүрийг өөрчлөөд дахин оролдоно уу.'}
          </p>
          {logs.length === 0 ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Серверээс шалгах
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedChannel('all');
                setFilter('all');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Шүүлт цэвэрлэх
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredLogs.map((log) => {
            const isHandedOff = log.handedOff;
            const targetChatId = log.chatId || log.dialogId;
            const customerInitials = (log.customerName || 'U')
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={log.id}
                id={`dialog-log-${log.id}`}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-xs transition p-4 sm:p-5 space-y-3.5"
              >
                {/* Card Top: Customer info, Channel, Time, Status badge */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Customer Avatar */}
                    <div className="relative shrink-0">
                      {log.customerAvatar ? (
                        <img
                          src={log.customerAvatar}
                          alt={log.customerName || 'Customer'}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-100"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                          {customerInitials}
                        </div>
                      )}
                    </div>

                    {/* Customer Name & Channel */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {log.customerName || 'Хэрэглэгч'}
                        </h4>
                        {log.channelName && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 truncate max-w-[160px]">
                            {log.channelName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-500">ID: {log.dialogId || log.chatId}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.durationMs > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 font-medium">
                              Хариу: {formatDuration(log.durationMs)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges and Jump to Chat */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isHandedOff ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <UserCheck className="w-3 h-3 text-amber-600" />
                        {getHandoffReasonLabel(log.handoffReason)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        AI Бүрэн шийдсэн
                      </span>
                    )}

                    {log.status === 'closed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        Хаагдсан
                      </span>
                    )}

                    {onSelectChat && targetChatId && (
                      <button
                        type="button"
                        onClick={() => onSelectChat(targetChatId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shrink-0"
                        title="Live Chat цэс рүү үсэрч энэ яриаг нээх"
                      >
                        <span>Чат руу шилжих</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Conversation Interaction Box */}
                <div className="space-y-2.5">
                  {/* Customer Question Bubble */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Харилцагчийн асуулт / мессеж:</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      {log.customerMessage || '(Асуулт илгээгээгүй)'}
                    </p>
                  </div>

                  {/* Bot/Agent Response Bubble */}
                  <div
                    className={`p-3 rounded-xl border ${
                      isHandedOff
                        ? 'bg-amber-50/50 border-amber-200/80 text-amber-950'
                        : 'bg-blue-50/50 border-blue-200/80 text-blue-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        {log.responderType === 'bot' || !isHandedOff ? (
                          <>
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-blue-900">
                              {log.responderName || 'BSB AI Туслах'} (Бот)
                            </span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                            <span className="text-amber-900">
                              {log.responderName || 'Оператор'} (Шилжүүлсэн хариу)
                            </span>
                          </>
                        )}
                      </div>

                      {log.messagesCount && log.messagesCount > 1 && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          Нийт {log.messagesCount} мессеж
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {log.botAnswer}
                    </p>
                  </div>

                  {/* Matched Articles / Tags */}
                  {log.matchedArticles && log.matchedArticles.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        Ашигласан эх сурвалж:
                      </span>
                      {log.matchedArticles.map((art, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200/80"
                        >
                          {art.title}
                          {art.score > 0 && ` (${Math.round(art.score * 100)}%)`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
