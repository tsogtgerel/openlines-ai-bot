import React, { useState } from 'react';
import {
  Sliders,
  Save,
  Sparkles,
  AlertCircle,
  Check,
  Database,
  Package,
  CheckCircle2,
  ExternalLink,
  Link,
  Layers,
  Tag,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Info,
  UserCheck,
  RotateCcw,
  GitMerge,
  ShieldCheck,
  Target,
  ShieldAlert,
  ShoppingBag,
  HelpCircle,
  Compass,
} from 'lucide-react';
import { BotConfig, ProductDisplayConfig } from '../types';
import { FormattedMessageText } from './FormattedMessageText';

interface PromptSettingsTabProps {
  botConfig: BotConfig | null;
  onUpdateConfig: (updates: Partial<BotConfig>) => Promise<void>;
}

const DEFAULT_PRODUCT_CONFIG: ProductDisplayConfig = {
  websiteBaseUrl: 'https://bsb.mn',
  productUrlPattern: 'https://bsb.mn/products/by-code/{code}',
  categoryUrlPattern: 'https://bsb.mn/categories/{slug}',
  includeProductLink: true,
  includeCategoryLink: true,
  includePrice: true,
  includeStock: true,
  includeBrand: true,
  includeSpecs: true,
  includeWarranty: true,
  includePromotions: true,
  includeImage: false,
  linkStyle: 'markdown',
  outputFormatTemplate: 'category_focused',
};

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
  const [productSearchEnabled, setProductSearchEnabled] = useState<boolean>(
    botConfig?.productSearchEnabled ?? true
  );
  const [productSearchLimit, setProductSearchLimit] = useState<number>(
    botConfig?.productSearchLimit ?? 4
  );
  const [crmMode, setCrmMode] = useState<'classic' | 'simple'>(botConfig?.crmMode || 'classic');
  const [sessionContextRuleEnabled, setSessionContextRuleEnabled] = useState<boolean>(
    botConfig?.sessionContextRuleEnabled ?? true
  );
  const [contextualIntentDetection, setContextualIntentDetection] = useState<boolean>(
    botConfig?.contextualIntentDetection ?? true
  );

  // MeiliSearch product output & format config
  const [productConfig, setProductConfig] = useState<ProductDisplayConfig>(() => {
    const raw: ProductDisplayConfig = {
      ...DEFAULT_PRODUCT_CONFIG,
      ...(botConfig?.productConfig || {}),
    };
    // Auto-heal legacy /product/ or /category/ patterns
    if (
      raw.productUrlPattern.includes('/product/{slug}') ||
      raw.productUrlPattern.includes('/product/{code}') ||
      raw.productUrlPattern.includes('/products/{slug}') ||
      raw.productUrlPattern === 'https://bsb.mn/product/{slug}'
    ) {
      raw.productUrlPattern = 'https://bsb.mn/products/by-code/{code}';
    }
    if (
      raw.categoryUrlPattern.includes('/category/{slug}') ||
      raw.categoryUrlPattern.includes('/category/') ||
      raw.categoryUrlPattern === 'https://bsb.mn/category/{slug}'
    ) {
      raw.categoryUrlPattern = 'https://bsb.mn/categories/{slug}';
    }
    return raw;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Live preview state
  const [previewQuery, setPreviewQuery] = useState('iPhone 16 үнэ хэд вэ?');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPromptText, setPreviewPromptText] = useState<string | null>(null);
  const [previewSampleAnswer, setPreviewSampleAnswer] = useState<string | null>(null);
  const [previewDetectedContext, setPreviewDetectedContext] = useState<any>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'answer' | 'prompt'>('answer');

  const updateProductConfig = <K extends keyof ProductDisplayConfig>(
    key: K,
    val: ProductDisplayConfig[K]
  ) => {
    setProductConfig((prev) => ({ ...prev, [key]: val }));
  };

  const applyPreset = (type: 'category_focused' | 'standard' | 'rich' | 'compact') => {
    if (type === 'category_focused') {
      setProductConfig((prev) => ({
        ...prev,
        includeProductLink: true,
        includeCategoryLink: true,
        includePrice: true,
        includeStock: true,
        includeBrand: true,
        includeSpecs: true,
        includeWarranty: true,
        includePromotions: true,
        outputFormatTemplate: 'category_focused',
        linkStyle: 'markdown',
      }));
    } else if (type === 'standard') {
      setProductConfig((prev) => ({
        ...prev,
        includeProductLink: true,
        includeCategoryLink: false,
        includePrice: true,
        includeStock: true,
        includeBrand: true,
        includeSpecs: true,
        includeWarranty: false,
        includePromotions: false,
        outputFormatTemplate: 'standard',
        linkStyle: 'markdown',
      }));
    } else if (type === 'rich') {
      setProductConfig((prev) => ({
        ...prev,
        includeProductLink: true,
        includeCategoryLink: true,
        includePrice: true,
        includeStock: true,
        includeBrand: true,
        includeSpecs: true,
        includeWarranty: true,
        includePromotions: true,
        outputFormatTemplate: 'rich',
        linkStyle: 'markdown',
      }));
    } else if (type === 'compact') {
      setProductConfig((prev) => ({
        ...prev,
        includeProductLink: true,
        includeCategoryLink: false,
        includePrice: true,
        includeStock: true,
        includeBrand: false,
        includeSpecs: false,
        includeWarranty: false,
        includePromotions: false,
        outputFormatTemplate: 'compact',
        linkStyle: 'markdown',
      }));
    }
  };

  const handleRunPreview = async () => {
    if (!previewQuery.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/products/format-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: previewQuery.trim(),
          config: productConfig,
          contextualIntentDetection,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPreviewPromptText(data.data.promptText);
        setPreviewDetectedContext(data.data.detectedContext || null);

        const detectedCtx = data.data.detectedContext;
        const hits = data.data.hits || [];

        // Check if contextual intent detection blocked product recommendations
        if (contextualIntentDetection && detectedCtx && !detectedCtx.hasPurchaseOrRecommendationIntent) {
          const typeLabel = detectedCtx.intentType === 'service_term'
            ? 'Үйлчилгээний нөхцөл / сервис лавлагаа'
            : detectedCtx.intentType === 'small_talk'
            ? 'Мэндчилгээ / Энгийн яриа'
            : 'Ерөнхий лавлагаа';
          setPreviewSampleAnswer(
            `🛡️ [Contextual Intent Filter ИДЭВХЖСЭН]: Хэрэглэгчийн асуултад бараа худалдан авах эсвэл зөвлөмж хүссэн шууд зорилго илрээгүй (${typeLabel}).\n\nБот дур мэдэн барааны холбоос болон ангиллын линк хавсаргахгүй, зөвхөн хэрэглэгчийн асуусан лавлагаанд шууд тодорхой хариулна.`
          );
        } else if (hits.length === 0) {
          setPreviewSampleAnswer(`Уучлаарай, "${previewQuery}" түлхүүр үгээр барааны мэдээллийн санд одоогоор бэлэн бараа олдсонгүй.`);
        } else {
          const top = hits[0];
          let sample = `Сайн байна уу! Таны асуусан **${top.name}**-ийн мэдээллийг хүргэж байна:\n\n`;
          if (productConfig.includePrice) {
            sample += `• **Үнэ:** ${top.priceFormatted}${top.hasDiscount ? ` (хямдарсан, үндсэн үнэ: ${top.originalPriceFormatted})` : ''}\n`;
          }
          if (productConfig.includeStock) {
            sample += `• **Төлөв:** ${top.inStock ? 'Бэлэн байгаа' : 'Нөөц түр дууссан'}${top.siteRemainsSummary ? ` (${top.siteRemainsSummary})` : ''}\n`;
          }
          if (productConfig.includeWarranty && top.warrantyMonth) {
            sample += `• **Баталгаа:** ${top.warrantyMonth}\n`;
          }
          if (productConfig.includePromotions && top.promotionsSummary) {
            sample += `• **Урамшуулал:** ${top.promotionsSummary}\n`;
          }
          if (productConfig.includeSpecs && top.attributesSummary) {
            sample += `• **Үзүүлэлт:** ${top.attributesSummary}\n`;
          }

          if (productConfig.includeProductLink && top.productUrl) {
            if (productConfig.linkStyle === 'markdown') {
              sample += `\n🛒 [Барааг дэлгэрэнгүй үзэх](${top.productUrl})\n`;
            } else if (productConfig.linkStyle === 'bracket') {
              sample += `\n🔗 Барааны хуудас: [${top.productUrl}]\n`;
            } else {
              sample += `\nБарааны холбоос: ${top.productUrl}\n`;
            }
          }

          if (productConfig.includeCategoryLink && top.categoryUrl) {
            if (productConfig.linkStyle === 'markdown') {
              sample += `📁 [Ангилал: ${top.category || 'Ижил төстэй бараанууд'}](${top.categoryUrl})\n`;
            } else {
              sample += `Ангиллын холбоос: ${top.categoryUrl}\n`;
            }
          }

          setPreviewSampleAnswer(sample);
        }
      }
    } catch (e: any) {
      console.error('Preview error:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

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
        productSearchEnabled,
        productSearchLimit,
        productConfig,
        crmMode,
        sessionContextRuleEnabled,
        contextualIntentDetection,
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

        {/* MeiliSearch BSB Product Database Integration & Output Formatting */}
        <div className="p-4 sm:p-5 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    БСБ Барааны Мэдээллийн Сан (MeiliSearch)
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Идэвхтэй холбогдсон
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Сервер: https://meili.bsb.mn • Индекс: app_bsb_products (7,339+ бараа)
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-indigo-100 shadow-2xs">
              <input
                type="checkbox"
                checked={productSearchEnabled}
                onChange={(e) => setProductSearchEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                {productSearchEnabled ? 'Барааны хайлт асаалттай' : 'Унтраасан'}
              </span>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Хэрэглэгч бараа лавлахад MeiliSearch-ээс бодит үнэ, нөөц, техникийн үзүүлэлтийг шүүж, хариултандаа <strong>тухайн барааны шууд линк</strong> болон <strong>ижил төрлийн барааны ангиллын линкийг</strong> хамт илгээх тохиргоог эндээс удирдана.
          </p>

          {/* Quick Presets */}
          <div className="pt-2 border-t border-indigo-100/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                Бэлэн загварууд (Presets):
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('category_focused')}
                className={`px-3 py-2 rounded-xl text-left text-xs border transition-all ${
                  productConfig.outputFormatTemplate === 'category_focused' && productConfig.includeCategoryLink
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Бараа + Ангилал</span>
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <div className={`text-[10px] mt-0.5 ${productConfig.outputFormatTemplate === 'category_focused' && productConfig.includeCategoryLink ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Барааны & ангиллын линк
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className={`px-3 py-2 rounded-xl text-left text-xs border transition-all ${
                  productConfig.outputFormatTemplate === 'standard' && !productConfig.includeCategoryLink
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="font-bold">Стандарт линк</div>
                <div className={`text-[10px] mt-0.5 ${productConfig.outputFormatTemplate === 'standard' && !productConfig.includeCategoryLink ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Зөвхөн барааны линк
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('rich')}
                className={`px-3 py-2 rounded-xl text-left text-xs border transition-all ${
                  productConfig.outputFormatTemplate === 'rich'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="font-bold">Дэлгэрэнгүй</div>
                <div className={`text-[10px] mt-0.5 ${productConfig.outputFormatTemplate === 'rich' ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Үзүүлэлт, баталгаа, линкүүд
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('compact')}
                className={`px-3 py-2 rounded-xl text-left text-xs border transition-all ${
                  productConfig.outputFormatTemplate === 'compact'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="font-bold">Товч мэдээлэл</div>
                <div className={`text-[10px] mt-0.5 ${productConfig.outputFormatTemplate === 'compact' ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Зөвхөн нэр, үнэ, линк
                </div>
              </button>
            </div>
          </div>

          {/* Contextual Intent Detection Card */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-white space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-xs font-bold text-slate-900">
                      Contextual Intent Detection (Зорилго таних шүүлтүүр)
                    </h5>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      Anti-Spam
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Хэрэглэгч бараа авах эсвэл зөвлөмж хүсээгүй үед барааны линк шидэхийг хатуу хориглоно.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 shadow-2xs">
                <input
                  type="checkbox"
                  checked={contextualIntentDetection}
                  onChange={(e) => setContextualIntentDetection(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {contextualIntentDetection ? 'Шүүлтүүр асаалттай' : 'Унтраасан'}
                </span>
              </label>
            </div>

            {/* 3 Intent Mode Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-white border border-emerald-200/80 shadow-2xs">
                <div className="flex items-center gap-1 font-bold text-emerald-800 mb-0.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  1. Худалдан авах зорилго (Buy)
                </div>
                <p className="text-[10.5px] text-slate-600">
                  Үнэ, авах, захиалах, бэлэн нөөц, лизинг, сагслах зэрэгт <strong>барааны үнэ & шууд холбоосыг хавсаргана</strong>.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-white border border-blue-200/80 shadow-2xs">
                <div className="flex items-center gap-1 font-bold text-blue-800 mb-0.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  2. Зөвлөмж хүссэн (Recommendation)
                </div>
                <p className="text-[10.5px] text-slate-600">
                  Санал болгооч, ямар загвар дээр вэ, харьцуулах хүсэлтэд <strong>зөвлөмж & ангиллын холбоосоор хангана</strong>.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-white border border-rose-200/80 shadow-2xs">
                <div className="flex items-center gap-1 font-bold text-rose-800 mb-0.5">
                  <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
                  3. Ерөнхий & Үйлчилгээ (Service)
                </div>
                <p className="text-[10.5px] text-slate-600">
                  Сервис төв, баталгаат засвар, хүргэлтийн ерөнхий журам, гомдол, мэндчилгээнд <strong>барааны линк шидэхгүй, зөвхөн шууд хариулна</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* 1. Fields to include */}
          <div className="pt-3 border-t border-indigo-100/80 space-y-2">
            <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              1. Хариултад багтаах мэдээллийн талбарууд:
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeProductLink}
                  onChange={(e) => updateProductConfig('includeProductLink', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Барааны шууд хуудасны линк ('url')</span>
                  <span className="text-[10px] text-slate-500">Жишээ: [Бараа үзэх](https://bsb.mn/products/by-code/12345)</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeCategoryLink}
                  onChange={(e) => updateProductConfig('includeCategoryLink', e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Барааны ангиллын линк ('categoryUrl')</span>
                  <span className="text-[10px] text-slate-500">Жишээ: [Ангилал: Зурагт](https://bsb.mn/categories/tv)</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includePrice}
                  onChange={(e) => updateProductConfig('includePrice', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Үнэ & Хямдралын хувь</span>
                  <span className="text-[10px] text-slate-500">Үндсэн болон хямдарсан үнэ (₮-өөр)</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeStock}
                  onChange={(e) => updateProductConfig('includeStock', e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Нөөц & Салбарын үлдэгдэл</span>
                  <span className="text-[10px] text-slate-500">Бэлэн байгаа эсэх, дэлгүүрийн байршил</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeSpecs}
                  onChange={(e) => updateProductConfig('includeSpecs', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Техникийн гол үзүүлэлтүүд</span>
                  <span className="text-[10px] text-slate-500">Хэмжээ, багтаамж, процессор гэх мэт</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeWarranty}
                  onChange={(e) => updateProductConfig('includeWarranty', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Баталгаат хугацаа</span>
                  <span className="text-[10px] text-slate-500">Жишээ: 12 сар, 24 сар</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includePromotions}
                  onChange={(e) => updateProductConfig('includePromotions', e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Урамшуулал & Бэлэгтэй худалдаа</span>
                  <span className="text-[10px] text-slate-500">Дагалдах бэлэг, онцгой купон</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productConfig.includeBrand}
                  onChange={(e) => updateProductConfig('includeBrand', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Брэндийн нэр</span>
                  <span className="text-[10px] text-slate-500">Apple, Samsung, Panasonic, Electrolux</span>
                </div>
              </label>
            </div>
          </div>

          {/* 2. URL & Link Pattern Customization */}
          <div className="pt-3 border-t border-indigo-100/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-indigo-600" />
                2. Холбоосын хаяг & Загвар (URL Patterns):
              </h5>
              <button
                type="button"
                onClick={() => {
                  setProductConfig((prev) => ({
                    ...prev,
                    websiteBaseUrl: 'https://bsb.mn',
                    productUrlPattern: 'https://bsb.mn/products/by-code/{code}',
                    categoryUrlPattern: 'https://bsb.mn/categories/{slug}',
                  }));
                }}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                BSB албан ёсны холбоос сэргээх (/products/by-code/:code)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Вэбсайт домэйн (Base URL)
                </label>
                <input
                  type="text"
                  value={productConfig.websiteBaseUrl}
                  onChange={(e) => updateProductConfig('websiteBaseUrl', e.target.value)}
                  placeholder="https://bsb.mn"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Барааны линк загвар
                </label>
                <input
                  type="text"
                  value={productConfig.productUrlPattern}
                  onChange={(e) => updateProductConfig('productUrlPattern', e.target.value)}
                  placeholder="https://bsb.mn/products/by-code/{code}"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  <span className="text-emerald-700 font-semibold">{'{code}'}</span> нь BSB барааны кодоор (жишээ: APPL-MY373X) солигдоно
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ангиллын линк загвар
                </label>
                <input
                  type="text"
                  value={productConfig.categoryUrlPattern}
                  onChange={(e) => updateProductConfig('categoryUrlPattern', e.target.value)}
                  placeholder="https://bsb.mn/categories/{slug}"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  <span className="text-emerald-700 font-semibold">{'{slug}'}</span> нь ангиллаар (жишээ: mobile, tv, ref_freezer) солигдоно
                </span>
              </div>
            </div>
          </div>

          {/* 3. Link Style & Quantity */}
          <div className="pt-3 border-t border-indigo-100/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Линк харуулах хэлбэр:</span>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateProductConfig('linkStyle', 'markdown')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    productConfig.linkStyle === 'markdown'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  [Товчлуур / Markdown]
                </button>
                <button
                  type="button"
                  onClick={() => updateProductConfig('linkStyle', 'bracket')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    productConfig.linkStyle === 'bracket'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔗 Хаалтан дотор
                </button>
                <button
                  type="button"
                  onClick={() => updateProductConfig('linkStyle', 'plain')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    productConfig.linkStyle === 'plain'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Шууд URL бичвэр
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Хариултад хавсаргах барааны тоо:</span>
              <input
                type="number"
                min="1"
                max="8"
                value={productSearchLimit}
                onChange={(e) => setProductSearchLimit(Math.max(1, Math.min(8, parseInt(e.target.value) || 4)))}
                className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-slate-400 text-[11px]">бараа</span>
            </div>
          </div>

          {/* 4. Live Format Preview & Verification Tool */}
          <div className="pt-3 border-t border-indigo-100/80 bg-indigo-100/30 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 sm:p-5 rounded-b-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-bold text-indigo-950">
                  Шууд туршилт & Хариултын Live Preview:
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-white p-0.5 rounded-lg border border-indigo-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('answer')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    activePreviewTab === 'answer' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Хэрэглэгчид очих хариулт
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('prompt')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    activePreviewTab === 'prompt' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  AI Prompt-д очих бүтэц
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={previewQuery}
                  onChange={(e) => setPreviewQuery(e.target.value)}
                  placeholder="Жишээ: iPhone 16 үнэ хэд вэ?, сервис хаана байдаг вэ..."
                  className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleRunPreview}
                  disabled={previewLoading || !previewQuery.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                  {previewLoading ? 'Шалгаж байна...' : 'Шалгах / Preview'}
                </button>
              </div>

              {/* Quick query chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                <span className="text-indigo-900/70 font-semibold">Турших асуултууд:</span>
                <button
                  type="button"
                  onClick={() => setPreviewQuery('iPhone 16 үнэ хэд вэ, авах гэсэн юм')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 transition"
                >
                  🛒 "iPhone 16 үнэ..." (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuery('LG хөргөгч санал болгооч, ямар загвар дээр вэ')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 border border-blue-200 text-blue-800 transition"
                >
                  💡 "Хөргөгч санал болгооч..." (Rec)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuery('Сервис төвийн хаяг, баталгаат засвар хаана байдаг вэ?')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-rose-50 border border-rose-200 text-rose-800 transition"
                >
                  🛡️ "Сервис төвийн хаяг..." (Service)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuery('Сайн байна уу, өнөөдөр салбарууд ажиллаж байгаа юу?')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  💬 "Салбар ажиллаж байгаа юу?" (General)
                </button>
              </div>

              {/* Detected intent banner */}
              {previewDetectedContext && (
                <div className="pt-1">
                  {contextualIntentDetection && !previewDetectedContext.hasPurchaseOrRecommendationIntent ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">Contextual Intent Detection идэвхжсэн:</span> Барааны холбоос хаагдсан (
                        {previewDetectedContext.intentType === 'service_term'
                          ? 'Үйлчилгээ / Сервис лавлагаа'
                          : previewDetectedContext.intentType === 'small_talk'
                          ? 'Мэндчилгээ'
                          : 'Ерөнхий асуулт'}
                        ). Бот хэрэглэгчид дур мэдэн барааны линк шидэхгүй!
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Зорилго зөвшөөрөгдсөн:</span>{' '}
                        {previewDetectedContext.intentType === 'buy'
                          ? '🛒 Худалдан авах зорилго (Buy Intent)'
                          : '💡 Зөвлөмж авах хүсэлт (Recommendation Intent)'}{' '}
                        тул барааны үнэ, мэдээлэл болон албан ёсны линкийг хавсаргав.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview Output Box */}
            {previewSampleAnswer && activePreviewTab === 'answer' && (
              <div className="p-3.5 bg-white border border-indigo-200 rounded-xl shadow-xs text-xs text-slate-800 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[11px] text-slate-500">
                  <span className="font-bold text-indigo-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Ботын өгөх бодит хариулт (товчлуур болон линкүүдтэй):
                  </span>
                  <span className="text-[10px] text-slate-400">MeiliSearch бодит өгөгдөл</span>
                </div>
                <FormattedMessageText text={previewSampleAnswer} />
              </div>
            )}

            {previewPromptText && activePreviewTab === 'prompt' && (
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-xs text-xs text-emerald-400 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed animate-in fade-in duration-150">
                {previewPromptText}
              </div>
            )}

            {!previewSampleAnswer && (
              <div className="text-[11px] text-indigo-900/70 italic flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                Та "Шалгах / Preview" товчийг дарж дээрх тохиргоогоор барааны линк болон ангилал ботын хариултад хэрхэн орохыг бодит бүтээгдэхүүнээр харна уу.
              </div>
            )}
          </div>
        </div>

        {/* CRM Session Context Resolution Rule Section */}
        <div className="p-4 sm:p-5 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/50 to-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Нээлттэй сувгийн CRM сесс тодорхойлох дүрэм
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                    <ShieldCheck className="w-3 h-3 text-sky-600" />
                    Session Context Rule
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Open Channel-аар мессеж ирэх үед харилцагчийг утас/сошиал ID-аар нь таньж, Lead/Deal-ийн төлөвийг шалгах
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-sky-200 shadow-2xs">
              <input
                type="checkbox"
                checked={sessionContextRuleEnabled}
                onChange={(e) => setSessionContextRuleEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                {sessionContextRuleEnabled ? 'Дүрэм асаалттай' : 'Унтраасан'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-sky-100">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                CRM Горим (CRM Architecture Mode)
              </label>
              <select
                value={crmMode}
                onChange={(e) => setCrmMode(e.target.value as 'classic' | 'simple')}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="classic">Classic CRM — Давтан сэжим үүсгэх (Repeat Lead)</option>
                <option value="simple">Simple CRM — Давтан хэлцэл үүсгэх (Repeat Deal)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Бүх Lead/Deal хаагдсан харилцагч дахин хандахад Classic горимд "Давтан Lead", Simple горимд "Давтан Deal" үүсгэнэ.
              </p>
            </div>

            <div className="flex flex-col justify-center p-2.5 rounded-xl bg-white border border-sky-100 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-sky-600" />
                Давтан харилцагчийн мэндчилгээ:
              </span>
              <p className="text-[11px] text-slate-700 italic bg-slate-50 px-2 py-1 rounded border border-slate-100">
                "Эргэн тавтай морилно уу! Танд өнөөдөр юугаар туслах вэ?"
              </p>
              <span className="text-[10px] text-emerald-700 font-medium">
                ✓ Нэр, утасны дугаар зэрэг суурь мэдээллийг дахин давтан шалгаахгүй.
              </span>
            </div>
          </div>

          {/* Context Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-sky-100/80 text-xs">
            <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-800 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                1. Идэвхтэй Сэжимтэй бол
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Мессежийг уг Active Lead-д холбоно. Шинэ Lead <strong>үүсгэхгүй</strong>. Өмнөх тодруулгаа үргэлжлүүлнэ.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                2. Идэвхтэй Хэлцэлтэй бол
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Мессежийг уг Active Deal-д холбоно. Захиалгын статус шалгах эсвэл хариуцсан менежерт дамжуулна.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-purple-800 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                3. Хаагдсан / Шинэ бол
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Давтан хэрэглэгч гэж үзэн {crmMode === 'classic' ? 'Repeat Lead' : 'Repeat Deal'} үүсгэж, шууд эелдэг угтана.
              </p>
            </div>
          </div>
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
