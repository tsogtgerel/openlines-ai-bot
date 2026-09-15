import React, { useState } from 'react';
import { BookOpen, Plus, Search, Trash2, Edit3, Tag, Check, AlertCircle, X } from 'lucide-react';
import { KnowledgeArticle } from '../types';

interface KnowledgeBaseTabProps {
  articles: KnowledgeArticle[];
  isLoading: boolean;
  onAddArticle: (article: Omit<KnowledgeArticle, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateArticle: (id: string, updates: Partial<KnowledgeArticle>) => Promise<void>;
  onDeleteArticle: (id: string) => Promise<void>;
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
  articles,
  isLoading,
  onAddArticle,
  onUpdateArticle,
  onDeleteArticle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Бүгд');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Ерөнхий');
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categories = ['Бүгд', ...Array.from(new Set(articles.map((a) => a.category)))];

  const filteredArticles = articles.filter((art) => {
    const matchesCat = selectedCategory === 'Бүгд' || art.category === selectedCategory;
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingArticle(null);
    setTitle('');
    setCategory('Ерөнхий');
    setContent('');
    setKeywords('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (art: KnowledgeArticle) => {
    setEditingArticle(art);
    setTitle(art.title);
    setCategory(art.category);
    setContent(art.content);
    setKeywords(art.keywords.join(', '));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setIsSaving(true);
      const parsedKeywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (editingArticle) {
        await onUpdateArticle(editingArticle.id, {
          title,
          category,
          content,
          keywords: parsedKeywords,
        });
      } else {
        await onAddArticle({
          title,
          category,
          content,
          keywords: parsedKeywords,
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Та энэ мэдээллийн сангийн нийтлэлийг устгахдаа итгэлтэй байна уу?')) {
      await onDeleteArticle(id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Knowledge Base Overview Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Байгууллагын Мэдээллийн Сан (Knowledge Base)</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            AI бот нь харилцагчийн асуултад зөвхөн доорх мэдээллийн сангаас баримттай хариулна. Санд байхгүй асуулт ирвэл шууд операторт шилжүүлнэ.
          </p>
        </div>

        <button
          id="add-article-btn"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" /> Нийтлэл нэмэх
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            id="search-kb-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Түлхүүр үг, текстээр хайх..."
            className="pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.map((art) => (
          <div
            key={art.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {art.category}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(art)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                    title="Засах"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(art.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="Устгах"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mt-2">{art.title}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-4">
                {art.content}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5 items-center">
                <Tag className="w-3 h-3 text-slate-400 mr-1" />
                {art.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[10px] font-mono bg-blue-50 text-blue-700 rounded border border-blue-100"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                {editingArticle ? 'Нийтлэл засах' : 'Шинэ нийтлэл нэмэх'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Гарчиг
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Жишээ: Буцаалтын журам & Баталгаа"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ангилал
                </label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Жишээ: Төлбөр, Хүргэлт, Баталгаа, Ерөнхий"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Агуулга / Ботын ашиглах баримтат мэдээлэл
                </label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ботын хариулт бэлтгэхэд ашиглах байгууллагын үнэн зөв мэдээллийг бичнэ үү..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Түлхүүр үгс (таслалаар тусгаарлах)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Жишээ: буцаалт, баталгаа, солих, эвдэрсэн, хугацаа"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Хадгалж байна...' : 'Нийтлэл хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
