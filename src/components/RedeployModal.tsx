import React, { useState, useEffect, useRef } from 'react';
import { Rocket, RefreshCw, CheckCircle2, AlertCircle, Terminal, X, ExternalLink, RotateCcw, ArrowUpRight } from 'lucide-react';
import { DeployState } from '../types';

interface RedeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RedeployModal: React.FC<RedeployModalProps> = ({ isOpen, onClose }) => {
  const [deployState, setDeployState] = useState<DeployState>({
    status: 'idle',
    lastDeployedAt: null,
    logs: [],
  });
  const [isTriggering, setIsTriggering] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Poll status while open, especially when building
  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/system/deploy-status').then((r) => r.json());
        if (res.success && res.data) {
          setDeployState(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch deploy status:', err);
      }
    };

    fetchStatus();

    const interval = setInterval(fetchStatus, deployState.status === 'building' ? 1000 : 3000);
    return () => clearInterval(interval);
  }, [isOpen, deployState.status]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [deployState.logs]);

  const handleTriggerRedeploy = async () => {
    try {
      setIsTriggering(true);
      const res = await fetch('/api/system/redeploy', { method: 'POST' }).then((r) => r.json());
      if (res.success) {
        setDeployState((prev) => ({
          ...prev,
          status: 'building',
          logs: ['[Redeploy] Шинэ барилт эхэллээ...'],
        }));
      } else {
        alert(res.error?.message || 'Redeploy эхлүүлэхэд алдаа гарлаа');
      }
    } catch (err: any) {
      alert(`Алдаа: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  if (!isOpen) return null;

  const isBuilding = deployState.status === 'building' || isTriggering;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                <span>VibeCode Үүлэн Дэд Бүтэц рүү Дахин Deploy хийх</span>
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Bitrix24 Cloud
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Frontend (Vite) & Backend (Express)-ийг хөрвүүлэн VibeCode Galaxy серверийн контейнерт шууд байршуулна
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status & Timing Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-medium text-slate-500 block">Одоогийн байдал</span>
              <div className="mt-1 flex items-center gap-2">
                {deployState.status === 'building' ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-xs font-semibold text-blue-700">Үүлэн серверт байршуулж байна...</span>
                  </>
                ) : deployState.status === 'success' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">VibeCode серверт амжилттай байршсан</span>
                  </>
                ) : deployState.status === 'failed' ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-semibold text-rose-700">Алдаа гарсан</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700">Бэлэн (Idle)</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-medium text-slate-500 block">Сүүлд байршуулсан хугацаа</span>
              <span className="text-xs font-semibold text-slate-800 block mt-1">
                {deployState.lastDeployedAt
                  ? new Date(deployState.lastDeployedAt).toLocaleString('mn-MN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Төлөв тодорхойгүй'}
                {deployState.durationMs ? ` (${(deployState.durationMs / 1000).toFixed(1)} сек)` : ''}
              </span>
            </div>
          </div>

          {/* VibeCode Server Info Badge */}
          {deployState.targetServer && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-800">
                  {deployState.targetServer.displayName || deployState.targetServer.name}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">({deployState.targetServer.id.slice(0, 8)}...)</span>
              </div>
              {deployState.targetServer.appUrl && (
                <a
                  href={deployState.targetServer.appUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium text-[11px]"
                >
                  <span>Үүлэн апп нээх</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Action Trigger Card */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-blue-950">Шинэчлэгдсэн кодыг дахин байршуулах</h3>
              <p className="text-[11px] text-blue-800/80 mt-0.5">
                Код зассаны дараа энэ товчийг дарахад <code>npm run build</code> автоматаар ажиллаж хамгийн сүүлийн хувилбарыг бэлтгэнэ.
              </p>
            </div>
            <button
              id="modal-run-redeploy-btn"
              onClick={handleTriggerRedeploy}
              disabled={isBuilding}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition disabled:opacity-50 shrink-0"
            >
              <Rocket className={`w-4 h-4 ${isBuilding ? 'animate-bounce' : ''}`} />
              <span>{isBuilding ? 'Deploy хийж байна...' : '🚀 Дахин Deploy хийх'}</span>
            </button>
          </div>

          {/* Success Banner with Reload Action */}
          {deployState.status === 'success' && !isBuilding && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-900 font-medium truncate">
                  Шинэ код амжилттай байршлаа. Хуудсаа сэргээж шинэчлэлтийг харна уу.
                </span>
              </div>
              <button
                onClick={handleReload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Хуудсыг сэргээх</span>
              </button>
            </div>
          )}

          {/* Terminal Output Log */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>Барилтын явцын терминал лог (Build logs)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {deployState.logs.length} мөр
              </span>
            </div>
            <div
              ref={logContainerRef}
              className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-xl h-44 overflow-y-auto border border-slate-800 space-y-0.5 select-text shadow-inner"
            >
              {deployState.logs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">
                  Одоогоор лог байхгүй байна. "Дахин Deploy хийх" товчийг дарна уу.
                </div>
              ) : (
                deployState.logs.map((line, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      line.includes('❌') || line.includes('error') || line.includes('Error')
                        ? 'text-rose-400 font-semibold'
                        : line.includes('✅') || line.includes('built in')
                        ? 'text-emerald-400 font-semibold'
                        : line.includes('🚀')
                        ? 'text-blue-300 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>💡</span>
            <span>Google AI Studio дэлгэцийн баруун дээд булан дахь Deploy товчоор мөн нийтэд цацаж болно.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
