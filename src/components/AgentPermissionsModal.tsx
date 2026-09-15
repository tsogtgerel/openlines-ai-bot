import React, { useState } from 'react';
import {
  Shield,
  X,
  Check,
  Search,
  Radio,
  UserCheck,
  Layers,
  Lock,
  MessageSquare,
  Sparkles,
  Save,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Agent, OpenLineItem, AccessRole } from '../types';

interface AgentPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents?: Agent[];
  team?: Agent[];
  openLines?: OpenLineItem[];
  currentAgent?: Agent | null;
  onUpdatePermissions: (
    agentId: string,
    updates: {
      accessRole: AccessRole;
      assignedChannelIds: number[];
      assignedChannelNames: string[];
      canAccessAllChannels: boolean;
    }
  ) => Promise<void>;
  onSwitchAgent?: (agentId: string) => Promise<void>;
}

// Fallback open lines list if openLines is empty
const DEFAULT_OPEN_LINES: { id: number; name: string; type: string }[] = [
  { id: 1, name: 'Бидэнтэй чатлаарай! BSB.mn', type: 'livechat' },
  { id: 3, name: 'Интернэт дэлгүүр - Facebook - comments only', type: 'facebook' },
  { id: 9, name: 'Интернэт дэлгүүр - Instagram', type: 'instagram' },
  { id: 11, name: 'Интернэт дэлгүүр - Facebook - Messenger', type: 'facebook' },
  { id: 13, name: 'Интернэт дэлгүүр - Telegram', type: 'telegram' },
  { id: 15, name: 'Интернэт дэлгүүр - WhatsApp - Instant', type: 'whatsapp' },
  { id: 17, name: 'live chat - bsbgroup.mn', type: 'livechat' },
  { id: 21, name: 'БСБ Оффис Мебель - Facebook - Messenger', type: 'facebook' },
  { id: 27, name: 'БСБ Мебель - Instagram', type: 'instagram' },
  { id: 29, name: 'БСБ Оффис Мебель - Instagram', type: 'instagram' },
  { id: 31, name: 'БСБ Мебель - Facebook - Messenger', type: 'facebook' },
  { id: 33, name: 'Chat bot test - bsb . mn', type: 'livechat' },
  { id: 35, name: 'Chat bot n8n', type: 'other' },
  { id: 37, name: 'БСБ Оффис Мебель - Facebook - Comments', type: 'facebook' },
  { id: 39, name: 'БСБ Мебель - Facebook - Comments', type: 'facebook' },
  { id: 41, name: 'Viber Test Channel', type: 'viber' },
];

export const AgentPermissionsModal: React.FC<AgentPermissionsModalProps> = ({
  isOpen,
  onClose,
  agents: rawAgents,
  team,
  openLines = [],
  currentAgent = null,
  onUpdatePermissions,
  onSwitchAgent,
}) => {
  const agents = rawAgents || team || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (currentAgent?.id) return currentAgent.id;
    if (agents && agents.length > 0) return agents[0].id;
    return '';
  });

  // Keep selectedAgentId valid if agents load asynchronously
  React.useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(currentAgent?.id || agents[0]?.id || '');
    }
  }, [agents, currentAgent?.id, selectedAgentId]);

  // Form state for selected agent
  const [selectedRole, setSelectedRole] = useState<AccessRole>('agent');
  const [canAccessAll, setCanAccessAll] = useState<boolean>(false);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use either dynamic openLines or fallback
  const allChannels =
    openLines && openLines.length > 0
      ? openLines.map((l) => ({ id: l.id, name: l.name, type: 'channel' }))
      : DEFAULT_OPEN_LINES;

  const currentSelectedAgent = (agents && agents.length > 0)
    ? agents.find((a) => a.id === selectedAgentId) || agents[0]
    : null;

  // Whenever selected agent changes, sync local form state
  React.useEffect(() => {
    if (currentSelectedAgent) {
      const role: AccessRole =
        currentSelectedAgent.accessRole ||
        (currentSelectedAgent.bitrixUserId === 15 || currentSelectedAgent.id === 'agent-1'
          ? 'admin'
          : 'agent');
      setSelectedRole(role);
      setCanAccessAll(
        currentSelectedAgent.canAccessAllChannels ?? (role === 'admin' || role === 'supervisor')
      );
      setSelectedChannels(currentSelectedAgent.assignedChannelIds || [1, 3, 11, 39]);
      setSaveSuccess(false);
      setErrorMessage(null);
    }
  }, [selectedAgentId, currentSelectedAgent]);

  if (!isOpen) return null;

  const filteredAgents = agents.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.bitrixUserId && String(a.bitrixUserId).includes(q))
    );
  });

  const handleToggleChannel = (channelId: number) => {
    setSelectedChannels((prev) => {
      if (prev.includes(channelId)) {
        return prev.filter((id) => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handleSelectAllChannels = () => {
    setSelectedChannels(allChannels.map((c) => c.id));
  };

  const handleClearChannels = () => {
    setSelectedChannels([]);
  };

  const handleSelectWebAndFacebook = () => {
    const matched = allChannels
      .filter((c) => {
        const n = c.name.toLowerCase();
        return n.includes('bsb.mn') || n.includes('facebook') || n.includes('messenger');
      })
      .map((c) => c.id);
    setSelectedChannels(matched);
  };

  const handleSelectFurnitureChannels = () => {
    const matched = allChannels
      .filter((c) => c.name.toLowerCase().includes('мебель'))
      .map((c) => c.id);
    setSelectedChannels(matched);
  };

  const handleSave = async () => {
    if (!currentSelectedAgent) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);

      const assignedChannelNames = allChannels
        .filter((c) => selectedChannels.includes(c.id))
        .map((c) => c.name);

      await onUpdatePermissions(currentSelectedAgent.id, {
        accessRole: selectedRole,
        canAccessAllChannels: canAccessAll,
        assignedChannelIds: selectedChannels,
        assignedChannelNames,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Тохиргоо хадгалахад алдаа гарлаа');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAsAgent = async () => {
    if (!currentSelectedAgent) return;
    await onSwitchAgent(currentSelectedAgent.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Системийн эрхийн тохиргоо & Суваг хуваарилалт
              </h2>
              <p className="text-xs text-slate-400">
                Операторуудын хандах цэс, сувгийн хязгаарлалт болон чат харагдах дүрмийг удирдах
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance Banner */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 text-xs text-blue-900 flex items-start gap-2.5 shrink-0">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Аюулгүй байдлын шаардлага:</span>{' '}
            <b>«Оператор (Agent)»</b> эрхтэй хэрэглэгч нь зөвхөн <b>Live Chat</b> цэсийг харах бөгөөд өөрт
            оноогдсон сувгийн чат болон хуваарилагдаагүй чатуудыг харна. Бусад удирдлагын цэсүүд
            (Аналитик, Сувгууд, Мэдээллийн сан, AI тохиргоо, Deploy) харагдахгүй.
          </div>
        </div>

        {/* Modal Body: Left list + Right editor */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
          {/* Left Column: Agents List */}
          <div className="w-full md:w-80 bg-slate-50/50 flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ажилтан хайх (нэр, албан тушаал)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredAgents.map((agent) => {
                const isSelected = agent.id === selectedAgentId;
                const isCurrent = currentAgent?.id === agent.id;
                const role: AccessRole =
                  agent.accessRole ||
                  (agent.bitrixUserId === 15 || agent.id === 'agent-1' ? 'admin' : 'agent');
                const channelCount = agent.canAccessAllChannels
                  ? 'Бүх суваг'
                  : `${agent.assignedChannelIds?.length || 0} суваг`;

                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 shadow-xs'
                        : 'bg-white hover:bg-slate-100 border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={agent.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={agent.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                          agent.status === 'online'
                            ? 'bg-emerald-500'
                            : agent.status === 'busy'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {agent.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.2 rounded-full shrink-0 font-medium">
                            Та
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{agent.role}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`px-1.5 py-0.2 text-[9px] rounded-md font-semibold ${
                            role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : role === 'supervisor'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {role === 'admin' ? 'Админ' : role === 'supervisor' ? 'Ахлах' : 'Оператор'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {channelCount}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Permission & Channel Editor */}
          {currentSelectedAgent ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Agent Summary Card */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        currentSelectedAgent.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                      }
                      alt={currentSelectedAgent.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-300"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {currentSelectedAgent.name}
                        {currentSelectedAgent.bitrixUserId && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm font-mono font-normal">
                            Bitrix ID: {currentSelectedAgent.bitrixUserId}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{currentSelectedAgent.role}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {currentSelectedAgent.email || 'Имэйл бүртгэлгүй'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleTestAsAgent}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-xs transition"
                    title="Энэ хэрэглэгчийн эрхээр систем ямар харагдахыг шалгах"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Энэ эрхээр шалгах</span>
                  </button>
                </div>

                {/* Section 1: Role Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    1. Системийн хандах үүрэг (Role)
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Admin Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('admin')}
                      className={`p-3 rounded-xl border text-left transition relative ${
                        selectedRole === 'admin'
                          ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-400/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-purple-900">Администратор</span>
                        {selectedRole === 'admin' && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Бүх цэс, бүх суваг, тохиргоо, ботын удирдлага болон эрх хуваарилалт.
                      </p>
                    </button>

                    {/* Supervisor Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('supervisor')}
                      className={`p-3 rounded-xl border text-left transition relative ${
                        selectedRole === 'supervisor'
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-blue-900">Ахлах оператор</span>
                        {selectedRole === 'supervisor' && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Live чат, аналитик тайлан, чатын хяналт болон диалог лог харах.
                      </p>
                    </button>

                    {/* Agent Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('agent')}
                      className={`p-3 rounded-xl border text-left transition relative ${
                        selectedRole === 'agent'
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-900">
                          Оператор (Agent)
                        </span>
                        {selectedRole === 'agent' && (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Зөвхөн <b>Live Chat</b> цэс. Зөвхөн оноогдсон сувгийн чат & хуваарилагдаагүй чат.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Section 2: Channel Assignments */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      2. Хариуцах нээлттэй сувгууд (Channel Assignment)
                    </label>

                    {/* All Channels Toggle */}
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition">
                      <input
                        type="checkbox"
                        checked={canAccessAll}
                        onChange={(e) => setCanAccessAll(e.target.checked)}
                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Бүх сувагт нэвтрэх эрх олгох</span>
                    </label>
                  </div>

                  {!canAccessAll ? (
                    <div className="space-y-2">
                      {/* Quick Channel Filters */}
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={handleSelectAllChannels}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px]"
                        >
                          Бүгдийг сонгох
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectWebAndFacebook}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px]"
                        >
                          Зөвхөн BSB.mn & Facebook
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectFurnitureChannels}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px]"
                        >
                          Зөвхөн Мебель
                        </button>
                        <button
                          type="button"
                          onClick={handleClearChannels}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px]"
                        >
                          Цэвэрлэх
                        </button>
                      </div>

                      {/* Channels Checkbox Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                        {allChannels.map((channel) => {
                          const isChecked = selectedChannels.includes(channel.id);
                          return (
                            <label
                              key={channel.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                isChecked
                                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-medium'
                                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleChannel(channel.id)}
                                className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-[10px] font-mono px-1 py-0.5 rounded-sm bg-slate-200 text-slate-700 shrink-0">
                                #{channel.id}
                              </span>
                              <span className="truncate flex-1">{channel.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Сонгогдсон суваг: <b>{selectedChannels.length}</b> / {allChannels.length}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Энэ хэрэглэгчид бүх <b>({allChannels.length})</b> сувагт нэвтрэх бүрэн эрх
                        олгогдсон байна.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Message */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <b>{currentSelectedAgent.name}</b> операторын эрх ба сувгийн тохиргоо амжилттай
                    хадгалагдлаа!
                  </span>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                >
                  Хаах
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Хадгалж байна...' : 'Тохиргоог хадгалах'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
              Ажилтан сонгогдоогүй байна
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
