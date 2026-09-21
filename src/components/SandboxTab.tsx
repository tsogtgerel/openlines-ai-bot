import React, { useState } from 'react';
import { Send, Bot, User, Headphones, CheckCircle, AlertTriangle, Sparkles, RefreshCw, Database } from 'lucide-react';
import { FormattedMessageText } from './FormattedMessageText';

interface SandboxMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  handedOff?: boolean;
  keyboard?: { text: string; action: string }[];
  timestamp: string;
}

export const SandboxTab: React.FC = () => {
  const [messages, setMessages] = useState<SandboxMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: 'Сайн байна уу! БСБ компанийн харилцагчийн туслах AI бот байна. Танд юугаар туслах вэ?',
      keyboard: [{ text: 'Оператор дуудах', action: '/operator' }],
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const presetQuestions = [
    'iPhone 16 үнэ хэд вэ, бэлэн байгаа юу?',
    'Panasonic ухаалаг ТВ ямар үнэтэй байгаа вэ?',
    'Electrolux угаалгын машин байгаа юу?',
    'Танай ажлын цагийн хуваарь ямар байдаг вэ?',
    'Захиалгаа StorePay-ээр хүүгүй хувааж төлж болох уу?',
    'Хүргэлт хэдэн цагийн дотор ирэх вэ? Үнэгүй юу?',
    'Бараа гэмтэлтэй ирвэл хэрхэн буцаах, солиулах вэ?',
    'Намайг оператортой холбоод өгөөч',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isSending) return;

    const userMsg: SandboxMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/test-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();

      if (data.success) {
        const botMsg: SandboxMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.data.answer,
          handedOff: data.data.handedOff,
          keyboard: !data.data.handedOff
            ? [{ text: 'Оператор дуудах', action: '/operator' }]
            : undefined,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.data.handedOff) {
          const sysMsg: SandboxMessage = {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: 'Систем: Бот чатнаас гарч, хэрэглэгчийг амьд операторын дараалалд шилжүүллээ.',
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => [...prev, sysMsg]);
        }
      } else {
        const errMsg: SandboxMessage = {
          id: `err-${Date.now()}`,
          sender: 'system',
          text: `Алдаа: ${data.error?.message || 'Хариулт авахад алдаа гарлаа'}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'system',
          text: `Холболтын алдаа: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleOperatorButton = () => {
    handleSend('/operator');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Interactive Chat Pane */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[500px] sm:h-[600px] overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-900 truncate">Чат Туршилтын Симулятор (Sandbox)</h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Database className="w-3 h-3 text-emerald-600" />
                  MeiliSearch холбогдсон
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                Ботын хариулт, MeiliSearch барааны сан (https://meili.bsb.mn), оператор руу шилжих үйлдлийг турших
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'm1',
                  sender: 'bot',
                  text: 'Сайн байна уу! БСБ компанийн харилцагчийн туслах AI бот байна. Танд юугаар туслах вэ?',
                  keyboard: [{ text: 'Оператор дуудах', action: '/operator' }],
                  timestamp: new Date().toLocaleTimeString(),
                },
              ])
            }
            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Чатыг шинэчлэх</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4 bg-slate-50/30">
          {messages.map((m) => {
            if (m.sender === 'system') {
              return (
                <div key={m.id} className="flex justify-center my-2">
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    {m.text}
                  </span>
                </div>
              );
            }

            const isBot = m.sender === 'bot';

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${isBot ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isBot ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                  }`}
                >
                  {isBot ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>

                <div className="space-y-1.5">
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isBot
                        ? m.handedOff
                          ? 'bg-amber-50 border border-amber-200 text-amber-950 rounded-tl-xs'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                        : 'bg-blue-600 text-white rounded-tr-xs'
                    }`}
                  >
                    <FormattedMessageText text={m.text} isOperator={!isBot} />

                    {/* Inline Button (like in Bitrix24 Openline chat) */}
                    {m.keyboard && m.keyboard.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        {m.keyboard.map((btn, i) => (
                          <button
                            key={i}
                            onClick={handleOperatorButton}
                            disabled={isSending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            <Headphones className="w-3 h-3" />
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block px-1">{m.timestamp}</span>
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 self-start max-w-[80%]">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl text-xs text-slate-500 rounded-tl-xs flex items-center gap-2">
                <span className="animate-pulse">Мэдээллийн сангаас хариулт бэлтгэж байна...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              id="sandbox-chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Асуулт бичнэ үү (жишээ нь: 'Хүргэлт үнэгүй юу?')..."
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <button
              type="submit"
              id="sandbox-send-btn"
              disabled={isSending || !inputText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Илгээх
            </button>
          </form>
        </div>
      </div>

      {/* Preset Queries & How it Works */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Бэлэн Туршилтын Асуултууд
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Төрөл бүрийн асуулт нь мэдээллийн сангаас хариулах эсвэл оператор руу шилжих хэрхэн ажилладгийг шалгах:
          </p>

          <div className="space-y-2">
            {presetQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={isSending}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs text-slate-700 transition-all block font-medium"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Хүлээн авах шалгуурууд
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Мэдээллийн санд байгаа асуултад шууд, тодорхой, эелдэг хариулна.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Санд байхгүй асуултад худлаа зохиохгүй, мэргэжилтэн рүү шилжүүлнэ.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>"Оператор дуудах" товч эсвэл түлхүүр үг илэрмэгц шууд амьд хүн рүү шилжүүлнэ.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
