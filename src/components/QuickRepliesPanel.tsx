import React, { useState, useEffect } from 'react';
import {
  Zap,
  Search,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  CreditCard,
  Truck,
  ShieldCheck,
  Smile,
  Clock,
  Send,
  HelpCircle,
  CornerDownLeft,
} from 'lucide-react';

export interface QuickReplyItem {
  id: string;
  title: string;
  category: 'Мэндчилгээ' | 'Төлбөр' | 'Хүргэлт' | 'Лизинг' | 'Үйлчилгээ' | 'Төгсгөл' | 'Бусад';
  text: string;
  shortcut?: string;
  isCustom?: boolean;
}

export const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  {
    id: 'qr-1',
    title: 'Албан ёсны мэндчилгээ',
    category: 'Мэндчилгээ',
    text: 'Сайн байна уу! БСБ онлайн харилцагчийн үйлчилгээний төвтэй холбогдсонд баярлалаа. Танд ямар бараа, үйлчилгээгээр туслах вэ?',
    shortcut: '/hi',
  },
  {
    id: 'qr-2',
    title: 'Түр хүлээнэ үү (Шалгаж байна)',
    category: 'Үйлчилгээ',
    text: 'Би таны асуусан барааны үлдэгдэл болон дэлгэрэнгүй мэдээллийг системээс шалгаж байна. Түр хүлээнэ үү...',
    shortcut: '/wait',
  },
  {
    id: 'qr-3',
    title: 'Хаан банкны дансны дугаар',
    category: 'Төлбөр',
    text: 'Хүлээн авагч: "БСБ Электроникс" ХХК\nБанк: ХААН БАНК\nДансны дугаар: 5000000000\nГүйлгээний утга: [Таны утасны дугаар, захиалгын дугаар]',
    shortcut: '/bank',
  },
  {
    id: 'qr-4',
    title: 'Үнэгүй хүргэлт & угсралт',
    category: 'Хүргэлт',
    text: 'Улаанбаатар хот дотор бүх төрлийн цахилгаан бараа, тавилгыг 24-48 цагийн дотор гэрийн хаягаар үнэгүй хүргэж, мэргэжлийн инженерүүд угсарч өгдөг. Орон нутгийн унаанд мөн 24 цагт найдвартай ачуулна.',
    shortcut: '/deliv',
  },
  {
    id: 'qr-5',
    title: 'StorePay & PocketZero 0% зээл',
    category: 'Лизинг',
    text: 'Та ямар ч урьдчилгаа төлбөргүй, 0% хүүтэйгээр StorePay болон PocketZero үйлчилгээгээр 4-өөс 6 хуваан төлөх боломжтой. Би танд шууд төлөлтийн холбоосыг бэлдэж өгөх үү?',
    shortcut: '/loan',
  },
  {
    id: 'qr-6',
    title: 'Утас, хаяг авах хүсэлт',
    category: 'Хүргэлт',
    text: 'Та холбогдох утасны дугаар болон хүргэлт авах дэлгэрэнгүй хаягаа (дүүрэг, хороо, байр, орц) үлдээнэ үү, бид захиалгыг баталгаажуулъя.',
    shortcut: '/addr',
  },
  {
    id: 'qr-7',
    title: 'Баталгаат хугацаа & Засвар',
    category: 'Үйлчилгээ',
    text: 'БСБ-ээс худалдан авсан цахилгаан бараа үйлдвэрийн 1-3 жилийн албан ёсны баталгаатай. Сервис төв: 7722-0222 дугаараар өдөр бүр 09:00-18:00 цагт үйлчилж байна.',
    shortcut: '/warr',
  },
  {
    id: 'qr-8',
    title: 'Салбаруудын цагийн хуваарь',
    category: 'Үйлчилгээ',
    text: 'БСБ-гийн бүх салбар их дэлгүүрүүд Даваа-Ням гарагт өдөр бүр 10:00 - 20:00 цагийн хооронд завсарлагагүй ажиллаж байна.',
    shortcut: '/hours',
  },
  {
    id: 'qr-9',
    title: 'Талархал илэрхийлээд хаах',
    category: 'Төгсгөл',
    text: 'Биднийг сонгон үйлчлүүлсэн танд баярлалаа. Өдрийг сайхан өнгөрүүлээрэй! Дахин холбогдохдоо сэтгэл хангалуун байх болно.',
    shortcut: '/bye',
  },
  {
    id: 'qr-10',
    title: 'Өөр асуулт байгаа эсэх',
    category: 'Төгсгөл',
    text: 'Танд өөр тодруулах зүйл байгаа юу? Хэрэв асуулт байхгүй бол чатыг хааж байна. Танд амжилт хүсье!',
    shortcut: '/help',
  },
];

const LOCAL_STORAGE_KEY = 'bsb_custom_quick_replies';

interface QuickRepliesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertReply: (text: string) => void;
  className?: string;
}

export const QuickRepliesPanel: React.FC<QuickRepliesPanelProps> = ({
  isOpen,
  onClose,
  onInsertReply,
  className = '',
}) => {
  const [replies, setReplies] = useState<QuickReplyItem[]>(DEFAULT_QUICK_REPLIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Бүгд');
  const [recentlyInsertedId, setRecentlyInsertedId] = useState<string | null>(null);

  // New quick reply modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<QuickReplyItem['category']>('Үйлчилгээ');
  const [newText, setNewText] = useState('');
  const [newShortcut, setNewShortcut] = useState('');

  // Load custom replies from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: QuickReplyItem[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReplies([...DEFAULT_QUICK_REPLIES, ...parsed]);
        }
      }
    } catch (e) {
      console.error('Failed to load custom quick replies from localStorage:', e);
    }
  }, []);

  const categories = ['Бүгд', 'Мэндчилгээ', 'Төлбөр', 'Хүргэлт', 'Лизинг', 'Үйлчилгээ', 'Төгсгөл'];

  const filteredReplies = replies.filter((item) => {
    const matchesCategory = selectedCategory === 'Бүгд' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCategory;

    const matchesSearch =
      item.title.toLowerCase().includes(q) ||
      item.text.toLowerCase().includes(q) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  const handleInsert = (item: QuickReplyItem) => {
    onInsertReply(item.text);
    setRecentlyInsertedId(item.id);
    setTimeout(() => {
      setRecentlyInsertedId((curr) => (curr === item.id ? null : curr));
    }, 1500);
  };

  const handleAddCustomReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) return;

    const newItem: QuickReplyItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      text: newText.trim(),
      shortcut: newShortcut.trim() ? (newShortcut.startsWith('/') ? newShortcut.trim() : `/${newShortcut.trim()}`) : undefined,
      isCustom: true,
    };

    const updated = [...replies, newItem];
    setReplies(updated);

    // Save custom replies to localStorage
    try {
      const customOnly = updated.filter((r) => r.isCustom);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
    } catch (e) {
      console.error('Failed to save custom quick replies:', e);
    }

    setNewTitle('');
    setNewText('');
    setNewShortcut('');
    setShowAddModal(false);
  };

  const handleDeleteCustomReply = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = replies.filter((r) => r.id !== id);
    setReplies(updated);

    try {
      const customOnly = updated.filter((r) => r.isCustom);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
    } catch (err) {
      console.error('Failed to update localStorage after deleting quick reply:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="quick-replies-panel"
      className={`bg-slate-50 border-t border-slate-200 p-3 sm:p-4 space-y-3 transition-all ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              Хурдан хариултууд (Quick Replies)
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                {filteredReplies.length}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Нэг товшилтоор хариултын талбарт шууд бэлэн текст оруулах
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            id="add-custom-quick-reply-btn"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition shadow-xs"
            title="Өөрийн байнгын ашигладаг шинэ бэлэн хариулт нэмэх"
          >
            <Plus className="w-3 h-3 text-blue-600" />
            <span className="hidden xs:inline">Шинэ хэллэг</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            title="Хурдан хариултын самбарыг хаах"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative shrink-0 sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Хэллэг, түлхүүр үг хайх..."
            className="w-full pl-8 pr-6 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Replies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
        {filteredReplies.length === 0 ? (
          <div className="col-span-full py-6 text-center text-xs text-slate-500 space-y-1">
            <HelpCircle className="w-5 h-5 mx-auto text-slate-400" />
            <p>Таны хайсан илэрц олдсонгүй.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Бүгд');
              }}
              className="text-blue-600 hover:underline text-[11px]"
            >
              Бүх хэллэгүүдийг харах
            </button>
          </div>
        ) : (
          filteredReplies.map((item) => {
            const isJustInserted = recentlyInsertedId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => handleInsert(item)}
                className={`group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between select-none ${
                  isJustInserted
                    ? 'bg-emerald-50 border-emerald-400 shadow-sm ring-1 ring-emerald-400'
                    : 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-xs'
                }`}
                title="Товшиж хариултын талбарт оруулах"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {item.title}
                      </span>
                      {item.shortcut && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-mono shrink-0">
                          {item.shortcut}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                          item.category === 'Мэндчилгээ'
                            ? 'bg-blue-50 text-blue-700'
                            : item.category === 'Төлбөр'
                            ? 'bg-amber-50 text-amber-700'
                            : item.category === 'Хүргэлт'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.category === 'Лизинг'
                            ? 'bg-purple-50 text-purple-700'
                            : item.category === 'Төгсгөл'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.category}
                      </span>

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomReply(item.id, e)}
                          className="text-slate-300 hover:text-rose-600 p-0.5 transition"
                          title="Устгах"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {item.text}
                  </p>
                </div>

                {/* Footer action */}
                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CornerDownLeft className="w-3 h-3" />
                    1 товшилтоор оруулах
                  </span>

                  <span
                    className={`font-semibold flex items-center gap-1 transition ${
                      isJustInserted
                        ? 'text-emerald-700 font-bold'
                        : 'text-blue-600 group-hover:underline'
                    }`}
                  >
                    {isJustInserted ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Орууллаа!
                      </>
                    ) : (
                      'Оруулах'
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Quick Reply Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-slate-900">Шинэ хурдан хариулт нэмэх</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomReply} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Гарчиг / Товч нэр *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Жишээ: Шинэ жимсний шүүс бэлэглэх урамшуулал"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ангилал
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as QuickReplyItem['category'])}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Мэндчилгээ">Мэндчилгээ</option>
                    <option value="Төлбөр">Төлбөр & Данс</option>
                    <option value="Хүргэлт">Хүргэлт & Хаяг</option>
                    <option value="Лизинг">Лизинг & Зээл</option>
                    <option value="Үйлчилгээ">Үйлчилгээ & Баталгаа</option>
                    <option value="Төгсгөл">Төгсгөл & Хаалт</option>
                    <option value="Бусад">Бусад</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Шорткат (сонголтоор)
                  </label>
                  <input
                    type="text"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder="Жишээ: /gift"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Оруулах бэлэн хариултын текст *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Харилцагчийн чатанд автоматаар орох бүтэн текстийг энд бичнэ үү..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
