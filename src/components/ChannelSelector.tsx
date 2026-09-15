import React, { useState } from 'react';
import {
  Radio,
  Check,
  Link2,
  Unlink,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Sparkles,
  Activity,
  Phone,
  Mail
} from 'lucide-react';
import { OpenLineItem, BotConfig, ChannelAgent } from '../types';

interface ChannelSelectorProps {
  openLines: OpenLineItem[];
  botConfig: BotConfig | null;
  isLoading: boolean;
  onRefresh: () => void;
  onBindLine: (lineId: number, lineName: string) => Promise<void>;
  onUnbindLine: (lineId: number) => Promise<void>;
  onRegisterBot: (name: string, code: string) => Promise<void>;
  onSyncAgents?: () => Promise<void>;
  isSyncingAgents?: boolean;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  openLines,
  botConfig,
  isLoading,
  onRefresh,
  onBindLine,
  onUnbindLine,
  onRegisterBot,
  onSyncAgents,
  isSyncingAgents = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [botNameInput, setBotNameInput] = useState(botConfig?.botName || 'BSB AI Туслах');
  const [botCodeInput, setBotCodeInput] = useState(botConfig?.botCode || 'kb_ai_helper');
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null);

  const filteredLines = openLines.filter((line) =>
    line.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute total operator links across channels
  const totalOperatorAssignments = openLines.reduce(
    (acc, cur) => acc + (cur.operatorsCount || cur.assignedAgents?.length || 0),
    0
  );

  const handleBind = async (line: OpenLineItem) => {
    try {
      setIsActionLoading(line.id);
      await onBindLine(line.id, line.name);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleUnbind = async (lineId: number) => {
    try {
      setIsActionLoading(lineId);
      await onUnbindLine(lineId);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSaveBot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsRegistering(true);
      await onRegisterBot(botNameInput, botCodeInput);
    } finally {
      setIsRegistering(false);
    }
  };

  const toggleExpand = (lineId: number) => {
    setExpandedLineId(expandedLineId === lineId ? null : lineId);
  };

  return (
    <div className="space-y-6">
      {/* Bot Registration & Portal Channel Overview Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Бүртгэлтэй Битрикс24 Бот</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Портал дээр идэвхтэй
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Бот нь Битрикс24-ийн <code>imbot.v2</code> системд <code>fetch</code> (эвент татах) горимоор амжилттай бүртгэгдсэн байна.
            </p>
          </div>

          <form onSubmit={handleSaveBot} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              id="bot-name-input"
              value={botNameInput}
              onChange={(e) => setBotNameInput(e.target.value)}
              placeholder="Ботын нэр"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              id="bot-code-input"
              value={botCodeInput}
              onChange={(e) => setBotCodeInput(e.target.value)}
              placeholder="bot_code"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              id="update-bot-btn"
              disabled={isRegistering}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isRegistering ? 'Хадгалж байна...' : 'Ботыг шинэчлэх'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block">Ботын ID</span>
            <span className="font-semibold text-slate-800 font-mono">#{botConfig?.botId || 'Байхгүй'}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Төрөл</span>
            <span className="font-semibold text-slate-800">bot (OpenLine туслах)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Эвент хүлээн авах</span>
            <span className="font-semibold text-slate-800">fetch (тогтмол шалгах)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Сувгуудад оноосон операторууд</span>
            <span className="font-semibold text-blue-600 font-mono">
              {totalOperatorAssignments} холбоос
            </span>
          </div>
        </div>
      </div>

      {/* Bitrix Assigned Agents Sync Bar */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Битрикс24-ийн суваг бүрт оноосон агентууд (Channel Operators Queue)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Live REST API
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Битрикс24 дээр суваг тус бүрт (Facebook, Instagram, Webchat г.м) тохируулсан операторуудыг шууд татаж, чат хуваарилалт болон ээлжийн бүртгэлтэй автоматаар холбодог.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center shrink-0">
          {onSyncAgents && (
            <button
              type="button"
              id="sync-bitrix-agents-btn"
              onClick={onSyncAgents}
              disabled={isSyncingAgents || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-all disabled:opacity-50"
              title="Битрикс24-ийн бүх сувгийн операторуудыг шинэчлэн татах"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAgents ? 'animate-spin' : ''}`} />
              <span>{isSyncingAgents ? 'Битриксээс татаж байна...' : 'Битриксээс агентууд татах'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Open Lines List with Assigned Operators */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Порталын Нээлттэй Сувгууд (Open Channels)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Суваг бүрт хариуцан ажиллаж буй Битрикс24 операторууд болон угтах AI ботын тохиргоо.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              id="search-channels-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Суваг хайх..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
            />
            <button
              id="refresh-channels-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              title="Сувгийн жагсаалтыг шинэчлэх"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {filteredLines.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {isLoading ? 'Битрикс24-ээс сувгуудыг уншиж байна...' : 'Нээлттэй суваг олдсонгүй.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLines.map((line) => {
              const isSelected = botConfig?.selectedLineId === line.id;
              const hasWelcomeBot = line.welcomeBotEnable === 'Y';
              const isBoundToOurBot =
                (hasWelcomeBot && String(line.welcomeBotId) === String(botConfig?.botId)) ||
                isSelected;
              const assignedAgents = line.assignedAgents || [];
              const isExpanded = expandedLineId === line.id;
              const onlineAgentsCount = assignedAgents.filter((a) => a.status === 'online').length;

              return (
                <div
                  key={line.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Channel Main Row */}
                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{line.name}</span>
                          <span className="text-[11px] font-mono text-slate-400">ID: #{line.id}</span>
                          {line.active ? (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Идэвхтэй
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600">
                              Идэвхгүй
                            </span>
                          )}

                          {/* Operator Badge with Avatar Stack */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(line.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            <Users className="w-3 h-3 text-slate-500" />
                            <span>
                              <strong>{assignedAgents.length}</strong> оператор
                            </span>
                            {onlineAgentsCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Онлайн оператор байна" />
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>

                        {/* Sub metadata */}
                        <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 items-center">
                          <span>
                            Угтах бот:{' '}
                            <strong className={hasWelcomeBot ? 'text-blue-600' : 'text-slate-600'}>
                              {hasWelcomeBot ? `Залгагдсан (ID: ${line.welcomeBotId})` : 'Идэвхгүй'}
                            </strong>
                          </span>
                          {line.welcomeBotLeft && (
                            <span>
                              Бот гарах үед:{' '}
                              <strong className="text-slate-700">
                                {line.welcomeBotLeft === 'queue' ? 'Операторын дараалалд шилжүүлнэ' : line.welcomeBotLeft}
                              </strong>
                            </span>
                          )}

                          {/* Avatar preview stack */}
                          {assignedAgents.length > 0 && (
                            <div className="flex items-center gap-1 pl-1">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {assignedAgents.slice(0, 4).map((op) => (
                                  <img
                                    key={op.userId}
                                    src={op.avatar}
                                    alt={op.fullName}
                                    title={`${op.fullName} (${op.workPosition}) - ${op.status}`}
                                    className="inline-block h-5 w-5 rounded-full ring-1 ring-white object-cover"
                                  />
                                ))}
                              </div>
                              {assignedAgents.length > 4 && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  +{assignedAgents.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpand(line.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Хаах' : 'Агентууд'}</span>
                      </button>

                      {isBoundToOurBot ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <Check className="w-3.5 h-3.5 mr-1" /> Манай бот холбогдсон
                          </span>
                          <button
                            id={`unbind-btn-${line.id}`}
                            onClick={() => handleUnbind(line.id)}
                            disabled={isActionLoading === line.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                            title="Энэ сувгаас ботыг салгах"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>{isActionLoading === line.id ? 'Салгаж байна...' : 'Бот салгах'}</span>
                          </button>
                        </div>
                      ) : hasWelcomeBot ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                            title={`Одоо залгагдсан ботын ID: ${line.welcomeBotId}`}
                          >
                            Бот #{line.welcomeBotId} залгаатай
                          </span>
                          <button
                            id={`bind-btn-${line.id}`}
                            onClick={() => handleBind(line)}
                            disabled={isActionLoading === line.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                            title="Энэ сувагт манай AI ботыг шилжүүлж холбох"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{isActionLoading === line.id ? 'Холбож байна...' : 'Боттой холбох'}</span>
                          </button>
                          <button
                            id={`unbind-btn-${line.id}`}
                            onClick={() => handleUnbind(line.id)}
                            disabled={isActionLoading === line.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                            title="Суваг дээрх угтах ботыг бүрэн салгах"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>{isActionLoading === line.id ? 'Салгаж байна...' : 'Бот салгах'}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`bind-btn-${line.id}`}
                          onClick={() => handleBind(line)}
                          disabled={isActionLoading === line.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                          title="Энэ нээлттэй сувагт BSB AI туслах ботыг холбох"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{isActionLoading === line.id ? 'Холбож байна...' : 'Боттой холбох'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Accordion: List of Bitrix-assigned Agents */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-4 pt-1 bg-slate-50/70 border-t border-slate-100">
                      <div className="flex items-center justify-between py-2">
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>Битрикс24 дээр энэ сувагт оноогдсон операторууд ({assignedAgents.length}):</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {onlineAgentsCount} онлайн / {assignedAgents.length - onlineAgentsCount} офлайн
                        </span>
                      </div>

                      {assignedAgents.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                          Битрикс24 портал дээр энэ нээлттэй сувагт оператор оноогоогүй байна.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
                          {assignedAgents.map((agent) => (
                            <div
                              key={agent.userId}
                              className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-start gap-3 hover:border-blue-300 transition"
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={agent.avatar}
                                  alt={agent.fullName}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-100"
                                />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                    agent.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                  title={agent.status === 'online' ? 'Online' : 'Offline'}
                                />
                              </div>

                              <div className="flex-1 min-w-0 text-xs">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="font-semibold text-slate-900 truncate">
                                    {agent.fullName}
                                  </h4>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    #{agent.userId}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {agent.workPosition}
                                </p>

                                <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                                  <span className="inline-flex items-center gap-1 font-medium">
                                    <Activity className="w-2.5 h-2.5 text-blue-500" />
                                    {agent.activeSessions} чат
                                  </span>
                                  <span>•</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-medium ${
                                      agent.status === 'online'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {agent.status === 'online' ? 'Идэвхтэй' : 'Офлайн'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
