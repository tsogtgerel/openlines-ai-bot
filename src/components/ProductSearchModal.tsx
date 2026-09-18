import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Package,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Tag,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import { BsbProduct } from '../types';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertProduct: (formattedText: string) => void;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onInsertProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<BsbProduct[]>([]);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [catalogStats, setCatalogStats] = useState<{
    connected: boolean;
    numberOfDocuments: number;
    index: string;
  } | null>(null);

  // Load catalog stats on open
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/products/stats')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCatalogStats(res.data);
        }
      })
      .catch(() => {});

    // Initial search or top products
    handleSearch('iPhone');
  }, [isOpen]);

  const handleSearch = async (queryText?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append('q', q.trim());
      params.append('limit', '16');
      if (inStockOnly) params.append('inStockOnly', 'true');

      const res = await fetch(`/api/products/search?${params.toString()}`).then((r) => r.json());
      if (res.success && res.data) {
        setProducts(res.data.hits || []);
        setTotalHits(res.data.estimatedTotalHits || res.data.hits?.length || 0);
      }
    } catch (e) {
      console.error('Failed to search products:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCategory = (cat: string) => {
    setSearchQuery(cat);
    handleSearch(cat);
  };

  const handleInsertQuick = (p: BsbProduct) => {
    const stockStr = p.inStock ? 'Бэлэн байгаа' : 'Одоогоор нөөц түр дууссан';
    const text = `Бараа: ${p.name}\nҮнэ: ${p.priceFormatted} (${stockStr})`;
    onInsertProduct(text);
    onClose();
  };

  const handleInsertDetailed = (p: BsbProduct) => {
    const stockStr = p.inStock ? 'Бэлэн байгаа' : 'Одоогоор нөөц түр дууссан';
    const lines = [
      `БСБ Барааны мэдээлэл:`,
      `📌 Загвар: ${p.name}`,
      `💰 Үнэ: ${p.priceFormatted}${p.hasDiscount ? ` (Хямдарсан үнэ, үндсэн: ${p.originalPriceFormatted})` : ''}`,
      `📦 Төлөв: ${stockStr}`,
    ];

    if (p.attributesSummary) {
      lines.push(`⚙️ Үзүүлэлт: ${p.attributesSummary}`);
    }

    onInsertProduct(lines.join('\n'));
    onClose();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  БСБ Барааны Мэдээллийн Сан (MeiliSearch)
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Холбогдсон
                </span>
              </div>
              <p className="text-xs text-slate-500">
                https://meili.bsb.mn • Нийт {catalogStats?.numberOfDocuments ? catalogStats.numberOfDocuments.toLocaleString() : '7,339'} бараа
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Filters */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Барааны нэр, загвар, код эсвэл брэндээр хайх (жишээ: iPhone 16, зурагт, Electrolux)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-xs shrink-0"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Хайх</span>
            </button>
          </form>

          {/* Quick Category Chips */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-medium mr-1">Түргэн хайх:</span>
              {[
                'iPhone 16',
                'Samsung Galaxy',
                'Зурагт 65',
                'Угаалгын машин',
                'Хөргөгч',
                'AirPods',
                'Зөөврийн компьютер',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickCategory(chip)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium transition text-[11px]"
                >
                  {chip}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium select-none ml-auto">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setTimeout(() => handleSearch(), 50);
                }}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-xs">Зөвхөн бэлэн байгааг</span>
            </label>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Олдсон үр дүн: <strong className="text-slate-800">{totalHits}</strong> бараа</span>
            <span className="text-[11px]">БСБ Үндсэн сангаас бодит цаг хугацаанд</span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
              <p className="text-xs font-medium">MeiliSearch мэдээллийн сангаас хайж байна...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2 bg-white rounded-xl border border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Илэрц олдсонгүй</p>
              <p className="text-xs text-slate-500">
                Та хайлтын үгээ өөрчлөх эсвэл брэндийн нэрээр хайж үзнэ үү.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map((product) => (
                <div
                  key={product.id || product.productCode}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-blue-300 hover:shadow-xs transition flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    {/* Brand & Stock Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.brand && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold tracking-wider uppercase">
                            {product.brand}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          #{product.productCode}
                        </span>
                      </div>

                      {product.inStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Бэлэн байгаа
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          Нөөц дууссан
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </h4>

                    {/* Price Block */}
                    <div className="flex items-baseline gap-2 pt-0.5">
                      <span className="text-base sm:text-lg font-black text-blue-600">
                        {product.priceFormatted}
                      </span>
                      {product.hasDiscount && product.originalPriceFormatted && (
                        <span className="text-xs text-slate-400 line-through">
                          {product.originalPriceFormatted}
                        </span>
                      )}
                      {product.promotionPercentage && product.promotionPercentage > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                          -{product.promotionPercentage}%
                        </span>
                      )}
                    </div>

                    {/* Specs / Attributes */}
                    {product.attributesSummary && (
                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-mono">
                        {product.attributesSummary}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(product.productCode)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-[11px] transition flex items-center gap-1"
                      title="Барааны кодыг хуулах"
                    >
                      {copiedCode === product.productCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Код хуулах</span>
                    </button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleInsertQuick(product)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                        title="Зөвхөн нэр болон үнийг оруулах"
                      >
                        Үнэ оруулах
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertDetailed(product)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs"
                        title="Бүх дэлгэрэнгүй үзүүлэлттэй нь оруулах"
                      >
                        Бүтэн оруулах
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            AI бот болон операторын ноорог хариултууд мөн уг сангаас автоматаар шүүгддэг.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
