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
  Layers,
  Database,
  RefreshCw,
  FileText,
  Bookmark,
  Sliders,
  FolderTree,
  Building2,
} from 'lucide-react';
import { BsbProduct, BsbProductTerm, BsbBrand, BsbTaxon, BsbAttribute } from '../types';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertProduct: (formattedText: string) => void;
}

type ActiveIndexTab = 'products' | 'terms' | 'taxons' | 'brands' | 'attributes';

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onInsertProduct,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveIndexTab>('products');
  const [searchQuery, setSearchQuery] = useState('');

  // Products state (app_bsb_products)
  const [products, setProducts] = useState<BsbProduct[]>([]);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Terms state (app_bsb_product_terms)
  const [terms, setTerms] = useState<BsbProductTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<BsbProductTerm | null>(null);

  // Taxons state (app_bsb_taxons)
  const [taxons, setTaxons] = useState<BsbTaxon[]>([]);

  // Brands state (app_bsb_brands)
  const [brands, setBrands] = useState<BsbBrand[]>([]);

  // Attributes state (app_bsb_attributes)
  const [attributes, setAttributes] = useState<BsbAttribute[]>([]);

  // Indices status stats
  const [indicesStats, setIndicesStats] = useState<Record<string, { count: number; name: string; description: string; status: string }>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load all indices status on open
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/meili/indices')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setIndicesStats(res.data);
        }
      })
      .catch(() => {});

    // Initial search based on tab
    handleTabSearch(activeTab, searchQuery);
  }, [isOpen]);

  // When tab changes, load appropriate data
  useEffect(() => {
    if (!isOpen) return;
    handleTabSearch(activeTab, searchQuery);
  }, [activeTab]);

  const handleTabSearch = async (tab: ActiveIndexTab, q: string) => {
    setIsLoading(true);
    try {
      if (tab === 'products') {
        const params = new URLSearchParams();
        if (q.trim()) params.append('q', q.trim());
        params.append('limit', '16');
        if (inStockOnly) params.append('inStockOnly', 'true');

        const res = await fetch(`/api/products/search?${params.toString()}`).then((r) => r.json());
        if (res.success && res.data) {
          setProducts(res.data.hits || []);
          setTotalHits(res.data.estimatedTotalHits || res.data.hits?.length || 0);
        }
      } else if (tab === 'terms') {
        const res = await fetch(`/api/meili/terms?q=${encodeURIComponent(q)}`).then((r) => r.json());
        if (res.success && res.data) {
          setTerms(res.data || []);
          if (!selectedTerm && res.data.length > 0) {
            setSelectedTerm(res.data[0]);
          }
        }
      } else if (tab === 'taxons') {
        const res = await fetch(`/api/meili/taxons?q=${encodeURIComponent(q)}&limit=30`).then((r) => r.json());
        if (res.success && res.data) {
          setTaxons(res.data || []);
        }
      } else if (tab === 'brands') {
        const res = await fetch(`/api/meili/brands?q=${encodeURIComponent(q)}&limit=36`).then((r) => r.json());
        if (res.success && res.data) {
          setBrands(res.data || []);
        }
      } else if (tab === 'attributes') {
        const res = await fetch(`/api/meili/attributes?q=${encodeURIComponent(q)}&limit=30`).then((r) => r.json());
        if (res.success && res.data) {
          setAttributes(res.data || []);
        }
      }
    } catch (e) {
      console.error('Failed searching index tab:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTabSearch(activeTab, searchQuery);
  };

  const handleQuickCategory = (cat: string) => {
    setSearchQuery(cat);
    handleTabSearch(activeTab, cat);
  };

  const handleInsertQuickProduct = (p: BsbProduct) => {
    const stockStr = p.inStock ? 'Бэлэн байгаа' : 'Одоогоор нөөц түр дууссан';
    const prodUrl = p.url || p.productUrl || `https://bsb.mn/products/by-code/${p.productCode}`;
    const text = `Бараа: [${p.name}](${prodUrl})\nҮнэ: ${p.priceFormatted} (${stockStr})\nХолбоос: ${prodUrl}`;
    onInsertProduct(text);
    onClose();
  };

  const handleInsertDetailedProduct = (p: BsbProduct) => {
    const stockStr = p.inStock ? 'Бэлэн байгаа' : 'Одоогоор нөөц түр дууссан';
    const prodUrl = p.url || p.productUrl || `https://bsb.mn/products/by-code/${p.productCode}`;
    const lines = [
      `БСБ Барааны мэдээлэл:`,
      `📌 Загвар: [${p.name}](${prodUrl})`,
      `💰 Үнэ: ${p.priceFormatted}${p.hasDiscount ? ` (Хямдарсан үнэ, үндсэн: ${p.originalPriceFormatted})` : ''}`,
      `📦 Төлөв: ${stockStr}`,
    ];

    if (p.attributesSummary) {
      lines.push(`⚙️ Үзүүлэлт: ${p.attributesSummary}`);
    }

    lines.push(`🔗 Барааны линк: ${prodUrl}`);

    if (p.categoryUrl && p.category) {
      lines.push(`📁 Ангилал: [${p.category}](${p.categoryUrl})`);
    }

    onInsertProduct(lines.join('\n'));
    onClose();
  };

  const handleInsertTerm = (term: BsbProductTerm) => {
    const text = `📄 **${term.name}**\n${term.description}\n\n${term.plainContent || term.content.replace(/<[^>]+>/g, '')}`;
    onInsertProduct(text);
    onClose();
  };

  const handleInsertTaxon = (taxon: BsbTaxon) => {
    const catUrl = `https://bsb.mn/categories/${taxon.slug}`;
    const text = `📁 **БСБ Ангилал: [${taxon.name}](${catUrl})**\nНийт ${taxon.productTotal} бараа байна.\nХолбоос: ${catUrl}`;
    onInsertProduct(text);
    onClose();
  };

  const handleInsertBrand = (brand: BsbBrand) => {
    const text = `🏷️ **БСБ Албан ёсны брэнд: ${brand.name}**\nНийт бараа: ${brand.totalProducts}\nАнгилал: ${brand.taxons.join(', ')}`;
    onInsertProduct(text);
    onClose();
  };

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  БСБ MeiliSearch Мэдээллийн Сангууд
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  5 Индекс холбогдсон
                </span>
              </div>
              <p className="text-xs text-slate-500">
                https://meili.bsb.mn • Бараа бүтээгдэхүүн, ангилал, брэнд, албан ёсны журам, шинж чанар
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

        {/* Index Tabs Navigation */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-200 bg-slate-100/70 overflow-x-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'products'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Бараа бүтээгдэхүүн</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {indicesStats['app_bsb_products']?.count ? indicesStats['app_bsb_products'].count.toLocaleString() : '7,339'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'terms'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Үйлчилгээний нөхцөл</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-bold">
              {indicesStats['app_bsb_product_terms']?.count || '3'} журам
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('taxons')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'taxons'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Ангилал / Taxons</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {indicesStats['app_bsb_taxons']?.count || '621'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('brands')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'brands'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Брэндүүд</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {indicesStats['app_bsb_brands']?.count || '146'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attributes')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'attributes'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Үзүүлэлт / Attributes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {indicesStats['app_bsb_attributes']?.count || '164'}
            </span>
          </button>
        </div>

        {/* Search Bar & Filters */}
        <div className="p-3.5 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'products'
                    ? 'Барааны нэр, загвар, код эсвэл брэндээр хайх (жишээ: iPhone 16, зурагт 65, Electrolux)...'
                    : activeTab === 'terms'
                    ? 'Журмаас хайх (жишээ: буцаалт, 72 цаг, хүргэлтийн үнэ, хотын бүс)...'
                    : activeTab === 'taxons'
                    ? 'Ангилал хайх (жишээ: хөргөгч, угаалгын машин, зөөврийн компьютер)...'
                    : activeTab === 'brands'
                    ? 'Брэнд хайх (жишээ: Samsung, Delonghi, Sony, Apple, TCL)...'
                    : 'Техникийн үзүүлэлт хайх...'
                }
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-xs shrink-0"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Хайх</span>
            </button>
          </form>

          {/* Quick chips for products */}
          {activeTab === 'products' && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px] font-medium mr-1">Түргэн хайх:</span>
                {[
                  'iPhone 16',
                  'Samsung Galaxy',
                  'Зурагт 65',
                  'Угаалгын машин',
                  'Хөргөгч',
                  'Delonghi',
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

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium select-none ml-auto text-xs">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    handleTabSearch('products', searchQuery);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Зөвхөн бэлэн байгааг</span>
              </label>
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 min-h-[360px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-medium">MeiliSearch сангаас өгөгдөл татаж байна...</p>
            </div>
          )}

          {/* TAB 1: PRODUCTS */}
          {!isLoading && activeTab === 'products' && (
            products.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Бараа олдсонгүй</p>
                <p className="text-xs text-slate-400 mt-1">Хайх түлхүүр үгээ өөрчилж үзнэ үү.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {products.map((product) => (
                  <div
                    key={product.productCode}
                    className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-slate-500 text-[11px] truncate max-w-[140px]">
                          {product.brand || 'БСБ'}
                        </span>
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

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                        {product.name}
                      </h4>

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

                      {product.attributesSummary && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-mono">
                          {product.attributesSummary}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleCopy(product.productCode, product.productCode)}
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
                          onClick={() => handleInsertQuickProduct(product)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                        >
                          Үнэ оруулах
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertDetailedProduct(product)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs"
                        >
                          Бүтэн оруулах
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TAB 2: PRODUCT TERMS (app_bsb_product_terms) */}
          {!isLoading && activeTab === 'terms' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Terms Sidebar / List */}
              <div className="md:col-span-1 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                  Албан ёсны журмууд ({terms.length})
                </p>
                {terms.map((term) => (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => setSelectedTerm(term)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-1 ${
                      selectedTerm?.id === term.id
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {term.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {term.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {term.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Selected Term Detail View */}
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
                {selectedTerm ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                          app_bsb_product_terms • ID #{selectedTerm.id}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {selectedTerm.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedTerm.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInsertTerm(selectedTerm)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Чат руу оруулах</span>
                      </button>
                    </div>

                    <div className="prose prose-xs max-w-none text-xs text-slate-700 leading-relaxed max-h-[380px] overflow-y-auto pr-2">
                      {selectedTerm.plainContent ? (
                        <pre className="font-sans whitespace-pre-wrap text-slate-700 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          {selectedTerm.plainContent}
                        </pre>
                      ) : (
                        <div
                          dangerouslySetInnerHTML={{ __html: selectedTerm.content }}
                          className="text-xs text-slate-700 space-y-2"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Журам сонгоно уу</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TAXONS / CATEGORIES (app_bsb_taxons) */}
          {!isLoading && activeTab === 'taxons' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {taxons.map((t) => {
                const catUrl = `https://bsb.mn/categories/${t.slug}`;
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-mono text-slate-400">Код: {t.code}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {t.productTotal} бараа
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {t.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                        /categories/{t.slug}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
                      <a
                        href={catUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <span>Нээх</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleInsertTaxon(t)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Холбоос оруулах
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: BRANDS (app_bsb_brands) */}
          {!isLoading && activeTab === 'brands' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 text-sm">{b.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {b.totalProducts} бараа
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Код: {b.code}
                    </p>
                    {b.taxons && b.taxons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {b.taxons.slice(0, 3).map((tx, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-slate-50 text-slate-600 rounded text-[10px] border border-slate-100 truncate max-w-[120px]"
                          >
                            {tx}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleInsertBrand(b)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                    >
                      Чат руу оруулах
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: ATTRIBUTES (app_bsb_attributes) */}
          {!isLoading && activeTab === 'attributes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {attributes.map((attr) => (
                <div
                  key={attr.id}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 text-xs">{attr.name}</span>
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono">
                        {attr.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      code: {attr.code}
                    </p>
                    {attr.configuration && attr.configuration.length > 0 && (
                      <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono truncate">
                        {attr.configuration.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onInsertProduct(`Үзүүлэлт: ${attr.name} (${attr.code})`);
                        onClose();
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      Нэр оруулах
                    </button>
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
            AI бот болон оператор бүх 5 MeiliSearch индексийн бодит мэдээллийг шууд ашигладаг.
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
