import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BarChart3,
  Layers,
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Send,
  Zap,
  CheckCircle2,
  Share2,
  Globe,
  Radio,
} from 'lucide-react';
import {
  CustomerInquiryItem,
  InquiryAnalyticsReport,
  CategoryStat,
  ChannelStat,
  OpenLineItem,
} from '../types';

interface InquiryAnalyticsTabProps {
  openLines: OpenLineItem[];
  onAddArticleToKb?: (article: { title: string; category: string; content: string }) => void;
  onNavigateToChat?: () => void;
}

export const InquiryAnalyticsTab: React.FC<InquiryAnalyticsTabProps> = ({
  openLines,
  onAddArticleToKb,
  onNavigateToChat,
}) => {
  const [report, setReport] = useState<InquiryAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'channels' | 'report'>('categories');

  // UI feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedKbCategory, setAddedKbCategory] = useState<string | null>(null);
  const [savedQuickCategory, setSavedQuickCategory] = useState<string | null>(null);

  // Available channel filters
  const channelFilterOptions = [
    { id: 'all', label: 'Бүх сувгууд (Omnichannel)', icon: Globe },
    { id: '39', label: 'Facebook (БСБ Мебель)', icon: MessageSquare },
    { id: '40', label: 'Web Live Chat (Их Дэлгүүр)', icon: Radio },
    { id: '41', label: 'Instagram Direct (@bsb)', icon: MessageSquare },
    { id: '42', label: 'Telegram Corporate Support', icon: Send },
    { id: '43', label: 'WhatsApp Business', icon: MessageSquare },
  ];

  const fetchReport = async (channelsToFetch: string[] = selectedChannels) => {
    try {
      setIsLoading(true);
      setError(null);
      const isAll = channelsToFetch.includes('all');
      const res = await fetch('/api/analytics/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: isAll ? undefined : channelsToFetch,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error?.message || 'Тайлан үүсгэхэд алдаа гарлаа');
      }
    } catch (e: any) {
      console.error('Failed to generate report:', e);
      setError(e.message || 'Сүлжээний алдаа');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedChannels);
  }, []);

  const handleChannelToggle = (chId: string) => {
    let next: string[];
    if (chId === 'all') {
      next = ['all'];
    } else {
      const current = selectedChannels.filter((c) => c !== 'all');
      if (current.includes(chId)) {
        next = current.filter((c) => c !== chId);
        if (next.length === 0) next = ['all'];
      } else {
        next = [...current, chId];
      }
    }
    setSelectedChannels(next);
    fetchReport(next);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1-Click: Add recommended response to Knowledge Base
  const handleAddToKb = async (cat: CategoryStat) => {
    try {
      const res = await fetch('/api/analytics/add-to-kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Түгээмэл асуулт: ${cat.title}`,
          category: 'Харилцагчийн түгээмэл асуулт',
          content: cat.recommendedAIResponse,
          keywords: [cat.title, cat.category, ...(cat.sampleQueries.slice(0, 2))],
        }),
      }).then((r) => r.json());

      if (res.success) {
        setAddedKbCategory(cat.category);
        if (onAddArticleToKb && res.data) {
          onAddArticleToKb(res.data);
        }
        setTimeout(() => setAddedKbCategory(null), 3500);
      }
    } catch (e) {
      console.error('Failed to add to KB:', e);
    }
  };

  // 1-Click: Save to Quick Replies
  const handleSaveToQuickReplies = (cat: CategoryStat) => {
    try {
      const saved = localStorage.getItem('bsb_quick_replies_custom');
      const existing = saved ? JSON.parse(saved) : [];
      const newReply = {
        id: `qr-ai-${cat.category}-${Date.now()}`,
        title: `AI Зөвлөмж: ${cat.title}`,
        text: cat.recommendedAIResponse,
        category: cat.title,
        shortcut: cat.recommendedShortcut || `/${cat.category.slice(0, 5)}`,
      };
      const updated = [newReply, ...existing.filter((x: any) => x.shortcut !== newReply.shortcut)];
      localStorage.setItem('bsb_quick_replies_custom', JSON.stringify(updated));
      setSavedQuickCategory(cat.category);
      setTimeout(() => setSavedQuickCategory(null), 3500);
    } catch (e) {
      console.error('Failed to save quick reply:', e);
    }
  };

  // Export as Markdown download
  const handleDownloadMarkdown = () => {
    if (!report) return;

    let md = `# БСБ Нээлттэй Сувгийн Харилцагчийн Асуултын Ангилал & AI Тайлан\n`;
    md += `Огноо: ${new Date(report.generatedAt).toLocaleString('mn-MN')}\n`;
    md += `Хамрах хугацаа: ${report.period}\n`;
    md += `Сонгогдсон сувгууд: ${selectedChannels.join(', ')}\n\n`;
    md += `## 1. Гүйцэтгэлийн Хураангуй (Executive Summary)\n${report.executiveSummary}\n\n`;
    md += `Нийт асуулт: ${report.totalInquiriesCount} | Нийт харилцагч: ${report.totalCustomersCount}\n\n`;

    md += `## 2. Ихэвчлэн Асуудаг Сэдвүүдийн Ангилал & AI Зөвлөмж Хариултууд\n\n`;
    report.categories.forEach((cat, idx) => {
      md += `### ${idx + 1}. ${cat.title} (${cat.count} асуулт, ${cat.percentage}%)\n`;
      md += `- **Тайлбар:** ${cat.description}\n`;
      md += `- **AI-аар бэлтгэсэн оновчтой хариулт:**\n  > "${cat.recommendedAIResponse}"\n`;
      md += `- **Санал болгож буй үйл ажиллагааны алхам:** ${cat.actionRecommendation}\n`;
      md += `- **Ирсэн бодит асуултууд:**\n`;
      cat.sampleQueries.forEach((q) => {
        md += `  - "${q}"\n`;
      });
      md += `\n`;
    });

    md += `## 3. Суваг Бүрийн Харьцуулалт (Channel Breakdown)\n\n`;
    md += `| Суваг | Нийт асуулт | Хувь | Голлох Сэдэв | Ботоор шийдсэн % |\n`;
    md += `|---|---|---|---|---|\n`;
    report.channelBreakdown.forEach((ch) => {
      md += `| ${ch.channelName} | ${ch.totalInquiries} | ${ch.percentage}% | ${ch.topCategory} | ${ch.botHandledRate}% |\n`;
    });

    md += `\n## 4. Мэдээллийн Санд Нэмэх Шаардлагатай Сэдвүүд (KB Gap Analysis)\n\n`;
    report.kbGapAnalysis.forEach((gap, idx) => {
      md += `### ${idx + 1}. ${gap.recommendedArticleTitle} (${gap.frequency} удаа асуугдсан)\n`;
      md += `Санал болгож буй нийтлэлийн эх ноорог:\n"${gap.recommendedDraft}"\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BSB_Inquiry_AI_Report_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter categories by search
  const filteredCategories = report
    ? report.categories.filter((c) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.sampleQueries.some((sq) => sq.toLowerCase().includes(q)) ||
          c.recommendedAIResponse.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0" id="inquiry-analytics-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden print:hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Харилцагчийн Чат Аналитик & AI Зөвлөмж</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Харилцагчдын Асуултын Ангилал & AI Хариултын Тайлан
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Open Channel бүрээр болон сонгосон сувгуудаас харилцагчдын бичсэн бодит асуултуудыг цуглуулж ангилан, ихэвчлэн асуудаг сэдвүүдэд өгөх оновчтой бэлэн хариултыг AI-аар үүсгэн бүрэн тайлан гаргана.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              id="refresh-analytics-btn"
              onClick={() => {
                setIsGenerating(true);
                fetchReport(selectedChannels);
              }}
              disabled={isLoading || isGenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'AI Шинжилж байна...' : 'Дахин шинжлэх'}</span>
            </button>

            <button
              type="button"
              id="download-report-btn"
              onClick={handleDownloadMarkdown}
              disabled={!report}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold border border-white/15 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Тайлан татах (.md)</span>
            </button>

            <button
              type="button"
              id="print-report-btn"
              onClick={() => window.print()}
              disabled={!report}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold border border-white/15 transition disabled:opacity-50"
              title="PDF хэлбэрээр хэвлэх эсвэл хадгалах"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Хэвлэх / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Channel Multi-Selector Bar */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Суваг Сонгох (Channel Filter):
            </span>
            <span className="text-xs text-slate-500">
              ({selectedChannels.includes('all') ? 'Бүх суваг хамрагдсан' : `${selectedChannels.length} суваг сонгосон`})
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="search-inquiries-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Сэдэв, асуултаар хайх..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {channelFilterOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedChannels.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                id={`filter-channel-${opt.id}`}
                onClick={() => handleChannelToggle(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3 h-3 ml-0.5 text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Нийт Асуултын Тоо</span>
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {report.totalInquiriesCount}
            </div>
            <p className="text-[11px] text-slate-500">
              {report.totalCustomersCount} харилцагчийн бодит мессеж
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Ихэвчлэн Асуудаг Сэдэв</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-700 truncate" title={report.categories[0]?.title}>
              {report.categories[0]?.title || 'Хүргэлт & Тээвэр'}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              Нийт асуултын {report.categories[0]?.percentage || 0}%-ийг эзэлж байна
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Ангилсан Сэдвүүд</span>
              <Layers className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-900">
              {report.categories.length} Сэдэв
            </div>
            <p className="text-[11px] text-slate-500">
              Бүгд AI бэлэн хариулттай
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Бот Автоматжуулалт</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600">
              52%
            </div>
            <p className="text-[11px] text-slate-500">
              Оператор дуудалгүй ботоор шийдэгдсэн
            </p>
          </div>
        </div>
      )}

      {/* Subtabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 print:hidden">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            id="subtab-categories"
            onClick={() => setActiveSubTab('categories')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'categories'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Асуултын Ангилал & AI Хариулт ({filteredCategories.length})</span>
          </button>

          <button
            type="button"
            id="subtab-channels"
            onClick={() => setActiveSubTab('channels')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'channels'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Суваг Бүрээр Харьцуулах ({report?.channelBreakdown.length || 0})</span>
          </button>

          <button
            type="button"
            id="subtab-report"
            onClick={() => setActiveSubTab('report')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'report'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Бүрэн Тайлан & Дүгнэлт</span>
          </button>
        </div>

        {report && (
          <span className="text-xs text-slate-400 hidden sm:inline">
            Сүүлд шинэчлэгдсэн: {new Date(report.generatedAt).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && !report && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">
            Харилцагчдын чатын өгөгдлийг цуглуулж AI-аар ангилж байна...
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Facebook, Instagram, WebChat, Telegram зэрэг сувгуудаар ирсэн асуултуудыг семантик аргаар бүлэглэж, ихэвчлэн асуудаг асуултуудын бэлэн хариултыг бэлтгэж байна.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase">Алдаа гарлаа</h4>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* SUBTAB 1: Categories & AI Recommended Responses */}
      {report && activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredCategories.map((cat, idx) => (
              <div
                key={cat.category}
                id={`category-card-${cat.category}`}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Header bar */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {cat.title}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                          {cat.count} асуулт ({cat.percentage}%)
                        </span>
                        {cat.inKb && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Мэдээллийн санд бий</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  {/* Top channel tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Гол сувгууд:</span>
                    {cat.topChannels.map((tc, tidx) => (
                      <span
                        key={tidx}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium shadow-2xs"
                      >
                        {tc.channelName.split(' - ')[0]} ({tc.count})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Progress Bar & Percentage */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 font-medium">
                      <span>Эзлэх хувь</span>
                      <span className="font-bold text-slate-900">{cat.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(cat.percentage, 5)}%` }}
                      />
                    </div>
                  </div>

                  {/* Sample Customer Queries */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Харилцагчдын бодит асуултуудын жишээ:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {cat.sampleQueries.map((query, qidx) => (
                        <div
                          key={qidx}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 italic flex items-start gap-2"
                        >
                          <span className="text-blue-500 font-bold">“</span>
                          <span className="flex-1">{query}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommended Response Box */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 fill-current" />
                        <span className="text-xs font-bold text-amber-900">
                          AI-аар Үүсгэсэн Оновчтой Бэлэн Хариулт:
                        </span>
                        {cat.recommendedShortcut && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-mono text-[10px] font-semibold">
                            Шорткод: {cat.recommendedShortcut}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyText(cat.recommendedAIResponse, `copy-${cat.category}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition active:scale-95"
                          title="Хариултын текстийг хуулах"
                        >
                          {copiedId === `copy-${cat.category}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Хууллаа!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Хуулах</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveToQuickReplies(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition active:scale-95 ${
                            savedQuickCategory === cat.category
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                          }`}
                          title="Чат дээр оператор шууд 1 товшилтоор ашиглах Шуурхай Хариултад хадгалах"
                        >
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span>
                            {savedQuickCategory === cat.category ? 'Хадгалагдлаа ✓' : 'Шуурхай хариултад нэмэх'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddToKb(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition active:scale-95 ${
                            addedKbCategory === cat.category
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                          }`}
                          title="Бот автоматаар хариулдаг болох Мэдээллийн санд оруулах"
                        >
                          <BookOpen className="w-3 h-3 text-blue-600" />
                          <span>
                            {addedKbCategory === cat.category ? 'Мэдээллийн санд оров ✓' : 'Мэдээллийн санд нэмэх'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-amber-200/80 text-xs text-slate-800 font-medium leading-relaxed select-all">
                      {cat.recommendedAIResponse}
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-amber-800">
                      <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>AI Үйл ажиллагааны зөвлөмж:</strong> {cat.actionRecommendation}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Channel-by-Channel Breakdown */}
      {report && activeSubTab === 'channels' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Суваг Бүрээр Харьцуулсан Дэлгэрэнгүй Шинжилгээ
              </h3>
              <p className="text-xs text-slate-500">
                Харилцагчид аль сувгаар юуг хамгийн их лавлаж байгааг харьцуулж, суваг бүрт тохирсон үйлчилгээний бодлого баримтална.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.channelBreakdown.map((ch, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">
                          {ch.channelType}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          {ch.channelName}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs shrink-0">
                        {ch.percentage}%
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Нийт асуулт:</span>
                        <span className="font-bold text-slate-900">{ch.totalInquiries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Тэргүүлэх сэдэв:</span>
                        <span className="font-bold text-blue-700">{ch.topCategory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ботын шийдвэрлэлт:</span>
                        <span className="font-semibold text-emerald-600">{ch.botHandledRate}%</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed">
                      <strong className="text-slate-900">Онцлог:</strong> {ch.primaryConcern}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannels([String(ch.channelId)]);
                      setActiveSubTab('categories');
                      fetchReport([String(ch.channelId)]);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 transition"
                  >
                    <span>Энэ сувгийн асуултуудыг шүүх</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Executive Report & Export View */}
      {report && activeSubTab === 'report' && (
        <div className="space-y-6" id="printable-executive-report">
          {/* Executive Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Удирдлагын Дүгнэлт Тайлан (Executive Summary)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Огноо: {new Date(report.generatedAt).toLocaleDateString('mn-MN')}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed font-medium">
              {report.executiveSummary}
            </div>

            {/* Strategic Insights */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Стратегийн Гол Зөвлөмжүүд:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {report.aiInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-200/70 text-blue-900">
                          {insight.priority === 'high' ? 'Өндөр Ач холбогдол' : 'Дунд зэрэг'}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900">
                        {insight.title}
                      </h5>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {insight.description}
                      </p>
                    </div>

                    <div className="text-[11px] text-blue-800 font-semibold bg-white p-2 rounded-lg border border-blue-200/80">
                      💡 {insight.suggestedAction}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Base Gap Analysis */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Мэдээллийн Санд Нэмэх Шаардлагатай Сэдвүүд (KB Gap Analysis):
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Харилцагчид олон удаа давтан асууж байгаа боловч мэдээллийн санд одоогоор бэлэн хариултгүй байгаа сэдвүүд:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.kbGapAnalysis.map((gap, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-emerald-950">
                        {gap.recommendedArticleTitle}
                      </h5>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {gap.frequency} хандалт
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-emerald-100">
                      "{gap.recommendedDraft}"
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddToKb({
                          category: 'delivery',
                          title: gap.recommendedArticleTitle,
                          description: gap.missingTopic,
                          color: 'emerald',
                          count: gap.frequency,
                          percentage: 10,
                          sentimentBreakdown: { positive: 0, neutral: 0, negative: 0, urgent: 0 },
                          topChannels: [],
                          sampleQueries: [],
                          recommendedAIResponse: gap.recommendedDraft,
                          actionRecommendation: '',
                          inKb: false,
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      <span>Энэ нийтлэлийг шууд санд нэмэх</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
