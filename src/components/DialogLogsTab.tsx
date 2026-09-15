import React, { useState } from 'react';
import { History, RefreshCw, UserCheck, ShieldAlert, Clock, ArrowRight, Tag } from 'lucide-react';
import { DialogLog } from '../types';

interface DialogLogsTabProps {
  logs: DialogLog[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const DialogLogsTab: React.FC<DialogLogsTabProps> = ({ logs, isLoading, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'answered' | 'handed_off'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'answered') return !log.handedOff;
    if (filter === 'handed_off') return log.handedOff;
    return true;
  });

  const totalLogs = logs.length;
  const handedOffCount = logs.filter((l) => l.handedOff).length;
  const answeredCount = totalLogs - handedOffCount;
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
      default:
        return 'Операторт шилжүүлсэн';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium block">Нийт Харилцан Яриа</span>
          <span className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 sm:mt-1 block">{totalLogs}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium block">AI Хариулсан</span>
          <span className="text-lg sm:text-xl font-bold text-emerald-600 mt-0.5 sm:mt-1 block">{answeredCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium block">Операторт Шилжүүлсэн</span>
          <span className="text-lg sm:text-xl font-bold text-amber-600 mt-0.5 sm:mt-1 block">{handedOffCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium block">Шилжүүлэлтийн Хувь</span>
          <span className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1 block">{handoffRate}%</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Бүх лог ({totalLogs})
          </button>
          <button
            onClick={() => setFilter('answered')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === 'answered'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            AI Хариулсан ({answeredCount})
          </button>
          <button
            onClick={() => setFilter('handed_off')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === 'handed_off'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Операторт ({handedOffCount})
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Лог шинэчлэх
        </button>
      </div>

      {/* Logs Feed */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center text-sm text-slate-500">
          Одоогоор чатын лог бичигдээгүй байна. Туршилтын чатаар мессеж бичиж эсвэл нээлттэй сувгаа идэвхжүүлнэ үү!
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleTimeString();

            return (
              <div
                key={log.id}
                className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs transition-all hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-slate-400">ID: {log.dialogId}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {dateStr}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">{log.durationMs}ms</span>
                  </div>

                  <div>
                    {log.handedOff ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <UserCheck className="w-3 h-3 mr-1" />
                        {getHandoffReasonLabel(log.handoffReason)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        AI бүрэн хариулсан
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  {/* Customer message */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-400 font-medium block mb-1">Хэрэглэгчийн асуулт:</span>
                    <p className="text-slate-800 font-medium">{log.customerMessage}</p>
                  </div>

                  {/* Bot response */}
                  <div
                    className={`p-3 rounded-lg border ${
                      log.handedOff
                        ? 'bg-amber-50/40 border-amber-100 text-amber-950'
                        : 'bg-blue-50/40 border-blue-100 text-blue-950'
                    }`}
                  >
                    <span className="text-slate-400 font-medium block mb-1">Ботын үйлдэл / Хариулт:</span>
                    <p className="leading-relaxed">{log.botAnswer}</p>
                  </div>

                  {/* Matched articles */}
                  {log.matchedArticles && log.matchedArticles.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Ашигласан эх сурвалж:</span>
                      {log.matchedArticles.map((art) => (
                        <span
                          key={art.id}
                          className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded border border-slate-200"
                        >
                          {art.title} ({(art.score * 100).toFixed(0)}%)
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
