import React, { useState } from 'react';
import { Server, Cloud, RefreshCw, CheckCircle2, ShieldAlert, Play, Terminal, ArrowUpRight } from 'lucide-react';
import { InfraServer } from '../types';

interface DeployTabProps {
  servers: InfraServer[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateServer: (name: string) => Promise<void>;
}

export const DeployTab: React.FC<DeployTabProps> = ({
  servers,
  isLoading,
  onRefresh,
  onCreateServer,
}) => {
  const [serverName, setServerName] = useState('openlines-ai-bot');
  const [isCreating, setIsCreating] = useState(false);
  const [deployStep, setDeployStep] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setDeployStep('VibeCode bitrix-cloud дээр шинэ сервер үүсгэж байна (Франкфурт)...');
      await onCreateServer(serverName);
      setDeployStep('Сервер амжилттай үүсгэгдлээ! Бэлтгэж байна...');
    } catch (err: any) {
      alert(`Сервер үүсгэхэд алдаа гарлаа: ${err.message}`);
      setDeployStep(null);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl">
      {/* Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-900">VibeCode Үүлэн Дэд Бүтэц (Cloud Infra)</h2>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Black Hole Горим
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Энэхүү AI ботыг 24/7 тасралтгүй ажиллах Битрикс24-ийн үүлэн сервер дээр байршуулах.
            </p>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Серверүүдийг шинэчлэх
          </button>
        </div>

        {/* Deploy Spec Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium block">Платформ & Багц</span>
            <span className="text-slate-900 font-semibold block mt-0.5">Bitrix24 Cloud (bc-small)</span>
            <span className="text-[11px] text-slate-500">2 CPU • 2GB RAM • 20GB SSD</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium block">Бүсчлэл & ҮС</span>
            <span className="text-slate-900 font-semibold block mt-0.5">Франкфурт (bc-eu-central)</span>
            <span className="text-[11px] text-slate-500">Ubuntu 24.04 LTS (amd64)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium block">Ажиллах орчин</span>
            <span className="text-slate-900 font-semibold block mt-0.5">Node 22 + Systemd Daemon</span>
            <span className="text-[11px] text-slate-500">Унтарвал автоматаар дахин асна</span>
          </div>
        </div>
      </div>

      {/* Existing Servers List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Бүртгэлтэй Үүлэн Серверүүд ({servers.length})</h3>
        </div>

        {servers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 space-y-3">
            <p>Одоогоор таны VibeCode түлхүүр дээр үүссэн сервер байхгүй байна.</p>
            <p className="text-xs text-slate-400">
              Та доорх хэсгээс Битрикс24 Үүлэн Серверийг 1 товшилтоор үүсгэх боломжтой.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {servers.map((srv) => (
              <div key={srv.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{srv.name}</span>
                      <span className="text-xs font-mono text-slate-400">({srv.id})</span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {srv.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Багц: <strong>{srv.plan}</strong></span>
                      <span>Бүс: <strong>{srv.region}</strong></span>
                      {srv.subdomain && (
                        <span>Холбоос: <strong className="text-blue-600">{srv.subdomain}</strong></span>
                      )}
                      {srv.blackholeStatus && (
                        <span>BlackHole: <strong>{srv.blackholeStatus}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-medium">Ажиллаж байна</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Server Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Шинэ Бот Сервер Үүсгэх</h3>
        <p className="text-xs text-slate-500 mb-4">
          VibeCode платформын <code>POST /v1/infra/servers</code> дуудлагаар тусгай үүлэн виртуал сервер асаана.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            required
            id="server-name-input"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="серверийн-нэр"
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            id="create-server-btn"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <Cloud className="w-4 h-4" />
            {isCreating ? 'Үүсгэж байна...' : 'VibeCode Сервер Асаах'}
          </button>
        </form>

        {deployStep && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-xs flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{deployStep}</span>
          </div>
        )}
      </div>

      {/* Deployment Manual / Instructions Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Өөр сервер дээр Deploy хийх заавар (Production Deployment)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Та энэхүү төслийг өөрийн дурын Linux VPS (Ubuntu/Debian), Docker эсвэл Cloud Run дээр байршуулах боломжтой.
            </p>
          </div>
          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
            Node.js 20+ • Port 3000
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Method 1: PM2 + Nginx */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">1</span>
              <span>Linux VPS (PM2 + Nginx)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              24/7 тасралтгүй ажиллах стандартын арга. Сервер унтарвал автоматаар асна.
            </p>
            <pre className="bg-slate-900 text-slate-100 text-[10px] p-2.5 rounded-lg overflow-x-auto font-mono">
{`npm install
npm run build
pm2 start dist/server.cjs --name "bsb-bot"
pm2 startup && pm2 save`}
            </pre>
          </div>

          {/* Method 2: Docker Compose */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">2</span>
              <span>Docker & Compose</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Контейнер орчинд 1 коммандаар бүрэн ажиллуулах (Dockerfile & compose бэлэн).
            </p>
            <pre className="bg-slate-900 text-slate-100 text-[10px] p-2.5 rounded-lg overflow-x-auto font-mono">
{`# 1 товшилтоор асаах:
docker compose up -d --build
# Лог шалгах:
docker compose logs -f`}
            </pre>
          </div>

          {/* Method 3: Reverse Proxy & SSL */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">3</span>
              <span>Nginx + Let's Encrypt SSL</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Bitrix24 Open Lines нь заавал HTTPS шаарддаг тул үнэгүй SSL суулгах.
            </p>
            <pre className="bg-slate-900 text-slate-100 text-[10px] p-2.5 rounded-lg overflow-x-auto font-mono">
{`sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com`}
            </pre>
          </div>
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Бүх нарийвчилсан зааварчилгаа, Nginx-ийн бэлэн <code>.conf</code> тохиргоо болон Bitrix24 Open Lines холболтын дэлгэрэнгүй тайлбарыг төслийн үндсэн хавтас дахь <strong>README.md</strong> файлаас харна уу.
          </span>
        </div>
      </div>
    </div>
  );
};
