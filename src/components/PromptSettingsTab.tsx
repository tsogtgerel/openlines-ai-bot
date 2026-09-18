import React, { useState } from 'react';
import { Sliders, Save, Sparkles, AlertCircle, Check } from 'lucide-react';
import { BotConfig } from '../types';

interface PromptSettingsTabProps {
  botConfig: BotConfig | null;
  onUpdateConfig: (updates: Partial<BotConfig>) => Promise<void>;
}

export const PromptSettingsTab: React.FC<PromptSettingsTabProps> = ({
  botConfig,
  onUpdateConfig,
}) => {
  const [tone, setTone] = useState<BotConfig['tone']>(botConfig?.tone || 'professional');
  const [handoffThreshold, setHandoffThreshold] = useState(botConfig?.handoffThreshold ?? 0.2);
  const [fallbackMessage, setFallbackMessage] = useState(botConfig?.fallbackMessage || '');
  const [operatorKeywords, setOperatorKeywords] = useState(
    botConfig?.operatorKeywords ? botConfig.operatorKeywords.join(', ') : ''
  );
  const [systemPromptAddition, setSystemPromptAddition] = useState(
    botConfig?.systemPromptAddition || ''
  );
  const [model, setModel] = useState(botConfig?.model || 'bitrix/bitrixgpt-5.5');
  const [botAssignmentMode, setBotAssignmentMode] = useState<BotConfig['botAssignmentMode']>(
    botConfig?.botAssignmentMode || 'manual_only'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onUpdateConfig({
        tone,
        handoffThreshold,
        fallbackMessage,
        operatorKeywords: operatorKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        systemPromptAddition,
        model,
        botAssignmentMode,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs max-w-4xl">
      <div className="flex flex-wrap items-center justify-between pb-4 sm:pb-6 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Модель & Хариултын Дүрэм</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Системийн заавар, оператор руу шилжүүлэх босго, хариулах өнгө аясыг тохируулна уу.
          </p>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
            <Check className="w-3.5 h-3.5 mr-1" /> Тохиргоо амжилттай хадгалагдлаа!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {/* Model Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Хиймэл Оюуны Модель (VibeCode AI Platform)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                model === 'bitrix/bitrixgpt-5.5'
                  ? 'border-blue-600 bg-blue-50/40 text-blue-950 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="ai-model"
                value="bitrix/bitrixgpt-5.5"
                checked={model === 'bitrix/bitrixgpt-5.5'}
                onChange={() => setModel('bitrix/bitrixgpt-5.5')}
                className="text-blue-600"
              />
              <div>
                <span className="text-xs block font-semibold">bitrix/bitrixgpt-5.5</span>
                <span className="text-[11px] text-slate-500">
                  Битрикс24 порталын квоттой шууд уялдсан албан ёсны LLM
                </span>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                model === 'openai/gpt-4o-mini'
                  ? 'border-blue-600 bg-blue-50/40 text-blue-950 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="ai-model"
                value="openai/gpt-4o-mini"
                checked={model === 'openai/gpt-4o-mini'}
                onChange={() => setModel('openai/gpt-4o-mini')}
                className="text-blue-600"
              />
              <div>
                <span className="text-xs block font-semibold">openai/gpt-4o-mini</span>
                <span className="text-[11px] text-slate-500">
                  Өндөр хурдтай авсаархан OpenAI модель
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Bot Assignment Mode */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Бот чатад холбогдох горим (Chat Assignment Mode)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                botAssignmentMode === 'manual_only'
                  ? 'border-purple-600 bg-purple-50/40 text-purple-950 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="bot-assignment-mode"
                value="manual_only"
                checked={botAssignmentMode === 'manual_only'}
                onChange={() => setBotAssignmentMode('manual_only')}
                className="mt-0.5 text-purple-600"
              />
              <div>
                <span className="text-xs block font-semibold flex items-center gap-1.5">
                  🎯 Зөвхөн заасан тухайлсан чатад холбогдох
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Зөвлөмжит</span>
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                  Бүх шинэ чат операторын дараалалд орно. Оператор шаардлагатай чат дээрээ "🤖 Бот холбох" товч дарж тухайн чатад ботыг даалгана.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                botAssignmentMode === 'all_chats'
                  ? 'border-blue-600 bg-blue-50/40 text-blue-950 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="bot-assignment-mode"
                value="all_chats"
                checked={botAssignmentMode === 'all_chats'}
                onChange={() => setBotAssignmentMode('all_chats')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <span className="text-xs block font-semibold">
                  🌐 Сувгийн бүх чатад автоматаар хариулах
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                  Харилцагч бичсэн бүх шинэ чатад бот шууд хариулж угтана. Боломжгүй үед операторт шилжүүлнэ.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Tone Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Хариултын Өнгө Аяс
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'professional', label: 'Албан ёсны (Professional)', desc: 'Хүндэтгэлтэй, эелдэг, нарийн' },
              { id: 'friendly', label: 'Найрсаг (Friendly)', desc: 'Дулаан, ярианы найрсаг хэв маягтай' },
              { id: 'concise', label: 'Товч бөгөөд тодорхой', desc: 'Урт сунжруулахгүй, шууд гол хариулт' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id as any)}
                className={`p-3 text-left rounded-xl border text-xs transition-all ${
                  tone === t.id
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-semibold">{t.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Threshold Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-800">
              Операторт шилжүүлэх магадлалын босго (Confidence Threshold)
            </label>
            <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {Math.round(handoffThreshold * 100)}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">
            Хэрэглэгчийн асуулт мэдээллийн сантай тохирох хувь энэ босгоос доош байвал бот өөрөө тааж хариулахгүй, шууд оператор руу шилжүүлнэ.
          </p>
          <input
            type="range"
            min="0.05"
            max="0.80"
            step="0.05"
            value={handoffThreshold}
            onChange={(e) => setHandoffThreshold(parseFloat(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
            <span>5% (Өргөн хамаарах)</span>
            <span>20% (Зөвлөмжит стандарт)</span>
            <span>80% (Маш чанга)</span>
          </div>
        </div>

        {/* Operator Trigger Keywords */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Оператор дуудах түлхүүр үгс (таслалаар тусгаарлах)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Хэрэглэгчийн мессежид эдгээр үгс орсон бол хиймэл оюун шалгахгүй шууд амьд хүн рүү (оператор) шилжүүлнэ.
          </p>
          <input
            type="text"
            value={operatorKeywords}
            onChange={(e) => setOperatorKeywords(e.target.value)}
            placeholder="оператор, хүн, ажилтан, менежер, мэргэжилтэн, туслах, /operator"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Fallback Message */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Систем саатах үеийн эелдэг мэдэгдэл (Fallback message)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            AI серверийн холболт саатах эсвэл түр гацах үед хэрэглэгчид илгээгээд шууд операторын дараалалд оруулна.
          </p>
          <textarea
            rows={2}
            value={fallbackMessage}
            onChange={(e) => setFallbackMessage(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
        </div>

        {/* Custom Prompt Additions */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Нэмэлт Системийн Заавар (System Prompt)
          </label>
          <textarea
            rows={3}
            value={systemPromptAddition}
            onChange={(e) => setSystemPromptAddition(e.target.value)}
            placeholder="Жишээ: Үргэлж Монгол хэлээр хариулж, барааны үнэ асуувал одоо явагдаж буй урамшууллыг дурдана уу."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            id="save-settings-btn"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Хадгалж байна...' : 'Тохиргоо хадгалах'}
          </button>
        </div>
      </form>
    </div>
  );
};
