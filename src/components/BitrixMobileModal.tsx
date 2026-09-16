import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Layers,
  X,
  Share2,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getAppUrl, isBitrix24Environment } from '../utils/bitrixMobile';

interface BitrixMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BitrixMobileModal: React.FC<BitrixMobileModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'bitrix_menu' | 'pwa' | 'qr'>('bitrix_menu');
  const [isBitrix, setIsBitrix] = useState(false);

  const appUrl = typeof window !== 'undefined' ? getAppUrl() : '';

  useEffect(() => {
    if (isOpen) {
      setIsBitrix(isBitrix24Environment());
      if (appUrl) {
        QRCode.toDataURL(appUrl, {
          width: 260,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        })
          .then((url) => setQrDataUrl(url))
          .catch((err) => console.error('Failed to generate QR code:', err));
      }
    }
  }, [isOpen, appUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Битрикс24 Гар утасны апп-д нээх</h3>
              <p className="text-xs text-blue-100">
                Гар утсан дээрх Битрикс24 апп дотор чатын ажлын байрыг харуулах заавар
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
            title="Хаах"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Environment status banner */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isBitrix ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
            <span>
              {isBitrix
                ? 'Та одоогоор Битрикс24 орчинд нээсэн байна (BX24 SDK идэвхтэй)'
                : 'Битрикс24 порталтай шууд холбогдож ажиллахад бэлэн'}
            </span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
            PWA & Mobile Ready
          </span>
        </div>

        {/* URL Box with 1-click Copy */}
        <div className="p-4 sm:p-5 pb-3 shrink-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Аппликейшны шууд холбоос (URL):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={appUrl}
              className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              id="copy-mobile-app-url-btn"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition shrink-0 ${
                copied ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Хуулах</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-5 border-b border-slate-200 flex gap-2 shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('bitrix_menu')}
            className={`pb-2.5 pt-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'bitrix_menu'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Битрикс24 цэсэнд нэмэх (Шилдэг арга)</span>
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 pt-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>2. QR Кодоор нээх</span>
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 pt-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>3. Утасны дэлгэцэнд суулгах</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {activeTab === 'bitrix_menu' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
                <span className="font-bold">Хэрхэн Битрикс24 Гар утасны апп дотор шууд харагдуулах вэ?</span>
                <p className="mt-1 text-slate-600">
                  Битрикс24-ийн зүүн үндсэн цэсэнд хувийн цэс (Custom menu item) нэмэхэд уг цэс нь
                  <strong> Битрикс24 гар утасны апп (iOS / Android)-ын "Цэс / Еще" хэсэгт автоматаар орж</strong>,
                  утаснаасаа шууд нээгддэг.
                </p>
              </div>

              <ol className="space-y-3 pl-1">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">Компьютер дээрээ Битрикс24 рүү орно:</span>
                    <p className="text-slate-600 mt-0.5">
                      Зүүн талын үндсэн цэсний хамгийн доор байрлах <strong>"Цэсийн тохиргоо" (Configure menu)</strong> дээр дарна.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">"Цэс нэмэх" (Add custom menu item) сонгоно:</span>
                    <div className="mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-24 shrink-0">Цэсийн нэр:</span>
                        <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 border border-slate-200 rounded">
                          Сувгийн чат (Live Chat)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-24 shrink-0">Холбоос (URL):</span>
                        <span className="font-mono text-[11px] text-blue-600 truncate bg-white px-2 py-0.5 border border-slate-200 rounded">
                          {appUrl}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <span>Нээх хэлбэр:</span>
                        <span className="text-slate-700">Шинэ цонх / Слайдер</span>
                      </div>
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">Гар утасны апп дээрээ нээх:</span>
                    <p className="text-slate-600 mt-0.5">
                      Битрикс24 гар утасны апп-аа нээгээд баруун доод талын <strong>"Цэс" (Еще / 3 зураас)</strong> рүү ороход
                      <strong> "Сувгийн чат"</strong> цэс шууд харагдах ба дарж нэвтэрнэ.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Битрикс24 JS SDK-г автоматаар холбосон тул гар утасны апп дотор дэлгэцэндээ таарч бүрэн ажиллана.</span>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
              <p className="text-slate-600 max-w-sm">
                Гар утасныхаа камераар уг QR кодыг уншуулан утасны хөтөч эсвэл Битрикс апп-аар шууд нээнэ үү:
              </p>

              <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-md inline-block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="App QR Code" className="w-52 h-52 mx-auto rounded-lg" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                    <span>QR үүсгэж байна...</span>
                  </div>
                )}
              </div>

              <div className="text-slate-500 text-[11px] font-mono break-all max-w-sm px-3 py-1.5 bg-slate-100 rounded-lg">
                {appUrl}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Хуулагдлаа!' : 'Холбоос хуулах'}</span>
                </button>
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Шинэ цонхонд нээх</span>
                </a>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                <span className="font-bold">Гар утасны үндсэн дэлгэцэнд суулгах (PWA):</span>
                <p className="mt-1 text-slate-600">
                  Энэ апп нь Progressive Web App (PWA) стандарттай тул тусдаа апп шиг утасны дэлгэц дээр сууж бүтэн дэлгэцээр ажиллана.
                </p>
              </div>

              {/* iOS Safari */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Apple iOS (iPhone / iPad - Safari хөтөч)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
                  <li>Safari хөтчөөр дээрх холбоосыг нээнэ.</li>
                  <li>Дэлгэцийн доод талын <strong>"Хуваалцах" (Share)</strong> товчийг дарна.</li>
                  <li>Доош гүйлгээд <strong>"Нүүр дэлгэцэнд нэмэх" (Add to Home Screen)</strong> сонгоно.</li>
                  <li>Дэлгэц дээр <strong>"BSB Chat"</strong> нэртэй апп дүрс гарч ирнэ.</li>
                </ol>
              </div>

              {/* Android Chrome */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Android (Google Chrome хөтөч)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
                  <li>Chrome хөтчөөр холбоосыг нээнэ.</li>
                  <li>Баруун дээд талын 3 цэг (⋮) дарна.</li>
                  <li><strong>"Апп суулгах" (Install app)</strong> эсвэл <strong>"Нүүр дэлгэцэнд нэмэх"</strong> сонгоно.</li>
                  <li>Бүтэн дэлгэцээр бие даасан апп мэт нээгдэнэ.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>SSL HTTPS & Bitrix24 аюулгүй байдлын хамгаалалттай</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
