import React, { useState } from 'react';
import {
  MessageSquareText,
  Zap,
  CheckCircle2,
  TrendingUp,
  Star,
  Clock,
  Info,
} from 'lucide-react';
import { PersonalPerformanceSummary, Agent } from '../types';

interface AgentPersonalPerformanceSummaryProps {
  currentAgent: Agent;
  performance: PersonalPerformanceSummary | null;
  isClockedIn?: boolean;
}

export const AgentPersonalPerformanceSummary: React.FC<AgentPersonalPerformanceSummaryProps> = ({
  currentAgent,
  performance,
  isClockedIn = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Safe fallback values if performance data is loading or newly switched
  const chatsHandled = performance?.chatsHandledToday ?? 0;
  const resolvedCount = performance?.resolvedToday ?? 0;
  const avgResponseFormatted = performance?.avgResponseTimeFormatted || '42 сек';
  const avgResponseSeconds = performance?.avgResponseTimeSeconds ?? 42;
  const rating = performance?.rating ?? 4.9;

  // Visual latency status based on response time
  const getResponseColor = (seconds: number) => {
    if (seconds <= 60) {
      return {
        badge: 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300',
        dot: 'bg-emerald-400',
        text: 'text-emerald-300',
        label: 'Шуурхай',
      };
    }
    if (seconds <= 180) {
      return {
        badge: 'bg-blue-950/70 border-blue-700/60 text-blue-300',
        dot: 'bg-blue-400',
        text: 'text-blue-300',
        label: 'Хэвийн',
      };
    }
    return {
      badge: 'bg-amber-950/70 border-amber-700/60 text-amber-300',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      label: 'Удааширсан',
    };
  };

  const responseStatus = getResponseColor(avgResponseSeconds);

  return (
    <div className="relative inline-flex items-center">
      {/* Clickable / Hoverable Badge Group */}
      <div
        id="agent-personal-performance-badge"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/90 transition cursor-pointer select-none text-[11px] group"
        title="Өнөөдрийн хувийн гүйцэтгэлийн дэлгэрэнгүй харах"
      >
        {/* Chats Handled Today */}
        <div className="flex items-center gap-1 text-slate-300">
          <MessageSquareText className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="hidden lg:inline text-slate-400 text-[10px]">Өнөөдөр:</span>
          <span className="font-semibold text-white font-mono">{chatsHandled}</span>
          <span className="text-[10px] text-slate-400">чат</span>
        </div>

        <span className="w-px h-3 bg-slate-700 shrink-0" />

        {/* Current Average Response Time */}
        <div className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden xl:inline text-slate-400 text-[10px]">Дундаж хариу:</span>
          <span className={`font-mono font-bold text-[11px] ${responseStatus.text}`}>
            {avgResponseFormatted}
          </span>
        </div>

        {/* Small info dot */}
        <Info className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition shrink-0 hidden sm:inline" />
      </div>

      {/* Expanded Performance Tooltip Popover */}
      {showTooltip && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs text-slate-200 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white text-[12px]">Хувийн гүйцэтгэл (Өнөөдөр)</span>
            </div>
            <span className="text-[10px] text-blue-400 font-mono px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-800/60">
              {currentAgent.name.split(' ')[0]}
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            {/* Handled chats */}
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <MessageSquareText className="w-3 h-3 text-blue-400" />
                <span>Хариуцсан чат</span>
              </div>
              <div className="text-sm font-bold text-white font-mono flex items-baseline gap-1">
                <span>{chatsHandled}</span>
                <span className="text-[9px] text-slate-400 font-normal">нийт</span>
              </div>
            </div>

            {/* Resolved chats */}
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Шийдвэрлэсэн</span>
              </div>
              <div className="text-sm font-bold text-emerald-300 font-mono flex items-baseline gap-1">
                <span>{resolvedCount}</span>
                <span className="text-[9px] text-slate-400 font-normal">
                  {chatsHandled > 0 ? `${Math.round((resolvedCount / chatsHandled) * 100)}%` : '0%'}
                </span>
              </div>
            </div>

            {/* Average Response Time */}
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Дундаж хариу өгөх хугацаа</span>
                </span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${responseStatus.badge}`}>
                  {responseStatus.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-extrabold text-white font-mono tracking-tight">
                  {avgResponseFormatted}
                </span>
                <span className="text-[10px] text-slate-400">
                  Зорилтот SLA: &lt; 60 сек
                </span>
              </div>
            </div>
          </div>

          {/* Rating & SLA footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Үнэлгээ:</span>
              <span className="font-bold text-white font-mono">{rating.toFixed(1)}</span>
              <span className="text-slate-500">/ 5.0</span>
            </div>
            <span className="text-slate-500">Битрикс24 Live өгөгдөл</span>
          </div>
        </div>
      )}
    </div>
  );
};
