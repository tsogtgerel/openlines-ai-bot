import React from 'react';
import { Bot, Radio, Server, CheckCircle2, AlertTriangle, Unlink, Link2, Rocket } from 'lucide-react';
import { BotConfig, PortalInfo } from '../types';

interface HeaderProps {
  portalInfo: PortalInfo | null;
  botConfig: BotConfig | null;
  onTogglePolling: () => void;
  isToggling: boolean;
  onUnbindLine?: (lineId: number) => Promise<void>;
  onNavigateToChannels?: () => void;
  isAgentRole?: boolean;
  onOpenRedeploy?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  portalInfo,
  botConfig,
  onTogglePolling,
  isToggling,
  onUnbindLine,
  onNavigateToChannels,
  isAgentRole = false,
  onOpenRedeploy,
}) => {
  const isPolling = botConfig?.isPollingActive ?? false;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Bot className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-semibold tracking-tight text-white truncate">
                Нээлттэй сувгийн AI Бот
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-950 text-blue-300 border border-blue-800 shrink-0">
                Битрикс24 Open Lines
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 truncate">
              <span className="truncate">{portalInfo?.portal || 'БСБ Битрикс24'}</span>
              <span>•</span>
              <span className="shrink-0">{botConfig?.selectedLineName ? `Суваг: ${botConfig.selectedLineName}` : (portalInfo?.tariffName || 'Enterprise')}</span>
            </div>
          </div>
        </div>

        {/* Right Status Indicators & Polling Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Bot Registration Badge - desktop/tablet */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <span className="text-slate-400">Бот:</span>
            <span className="font-medium text-white">{botConfig?.botName || 'Бүртгэгдээгүй'}</span>
            {botConfig?.botId && (
              <span className="text-slate-400 font-mono text-[11px]">#{botConfig.botId}</span>
            )}
          </div>

          {/* Connected Channel Badge - desktop */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <span className="text-slate-400">Суваг:</span>
            <span className="font-medium text-emerald-400 truncate max-w-[150px] lg:max-w-[200px]">
              {botConfig?.selectedLineName || 'Сонгоогүй'}
            </span>
            {botConfig?.selectedLineId && onUnbindLine && !isAgentRole ? (
              <button
                id="header-unbind-bot-btn"
                onClick={() => onUnbindLine(botConfig.selectedLineId!)}
                disabled={isToggling}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-800 rounded transition disabled:opacity-50"
                title={`'${botConfig.selectedLineName}' сувгаас BSB AI ботыг салгах`}
              >
                <Unlink className="w-3 h-3 text-rose-400" />
                <span>Салгах</span>
              </button>
            ) : onNavigateToChannels && !botConfig?.selectedLineId && !isAgentRole ? (
              <button
                onClick={onNavigateToChannels}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-300 hover:text-white bg-blue-950/70 hover:bg-blue-900 border border-blue-800 rounded transition"
                title="Суваг сонгож боттой холбох"
              >
                <Link2 className="w-3 h-3 text-blue-400" />
                <span>Сонгох</span>
              </button>
            ) : null}
          </div>

          {/* Redeploy Button for Admin/Supervisor */}
          {onOpenRedeploy && !isAgentRole && (
            <button
              id="header-redeploy-btn"
              onClick={onOpenRedeploy}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition shrink-0"
              title="Код шинэчлэгдсэн үед дахин Build & Deploy хийх"
            >
              <Rocket className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Redeploy</span>
            </button>
          )}

          {/* Polling Switch Button */}
          <button
            id="toggle-polling-btn"
            onClick={onTogglePolling}
            disabled={isToggling || !botConfig?.botId}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm ${
              isPolling
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="relative flex h-2 w-2">
              {isPolling && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isPolling ? 'bg-white' : 'bg-slate-400'
                }`}
              ></span>
            </span>
            <span className="hidden sm:inline">
              {isPolling ? 'Чат хүлээж авч байна (Active)' : 'Ботыг идэвхжүүлэх'}
            </span>
            <span className="sm:hidden">
              {isPolling ? 'Live идэвхтэй' : 'Бот асаах'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
