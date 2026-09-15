# 🤖 BSB Bitrix24 Open Lines AI Bot & Omnichannel Workplace

БСБ (BSB) компанийн **Bitrix24 Open Lines (Нээлттэй сувгууд)**-тай бүрэн интеграци хийгдсэн, хиймэл оюун ухаанд суурилсан харилцагчийн үйлчилгээний бот, операторын нэгдсэн ажлын байр (Live Workplace), ажлын цаг бүртгэл болон харилцагчийн асуултын дүн шинжилгээ, тайлангийн систем.

---

## 📋 Агуулга
1. [Үндсэн боломжууд](#-үндсэн-боломжууд)
2. [Системийн Архитектур & Технологиуд](#-системийн-архитектур--технологиуд)
3. [Файлын бүтэц](#-файлын-бүтэц)
4. [Хүрээлэн буй орчны хувьсагчид (.env)](#-хүрээлэн-буй-орчны-хувьсагчид-env)
5. [Локал орчинд ажиллуулах (Local Development)](#-локал-орчинд-ажиллуулах-local-development)
6. [Өөр сервер дээр Deploy хийх зааварчилгаа (Production Deployment)](#-өөр-сервер-дээр-deploy-хийх-зааварчилгаа-production-deployment)
   - [Сонголт A: Linux (Ubuntu/Debian) VPS дээр PM2 + Nginx + SSL тохируулах](#сонголт-a-linux-ubuntudebian-vps-дээр-pm2--nginx--ssl-тохируулах)
   - [Сонголт B: Docker & Docker Compose ашиглан ажиллуулах](#сонголт-b-docker--docker-compose-ашиглан-ажиллуулах)
   - [Сонголт C: Systemd Service (Linux Daemon) ашиглах](#сонголт-c-systemd-service-linux-daemon-ашиглах)
   - [Сонголт D: Google Cloud Run дээр байршуулах](#сонголт-d-google-cloud-run-дээр-байршуулах)
7. [Bitrix24 Open Lines болон Bot тохируулах заавар](#-bitrix24-open-lines-болон-bot-тохируулах-заавар)
8. [Өгөгдлийн сангийн нөөцлөлт (Backup) & Troubleshooting](#-өгөгдлийн-сангийн-нөөцлөлт-backup--troubleshooting)

---

## ✨ Үндсэн боломжууд

- 💬 **Omnichannel Сувгийн Чат (Live Workplace):**
  - Facebook Comments & Messenger, Web Live Chat, Instagram Direct (@bsb), Telegram Support, WhatsApp сувгуудын нэгдсэн удирдлага.
  - Бодит цагийн чат, харилцагчийн CRM мэдээлэл (Lead, захиалгын түүх, утас, хаяг).
  - 1-Товшилтын **Шуурхай Хариултуудын Самбар (Quick Replies Panel)** болон тусгай шорткодууд (`/deliv`, `/pay`, `/stock`, `/hours` гэх мэт).
  - Чат дуусгах сэтгэгдэл, шийдвэрлэлтийн тэмдэглэл, дотоод санамж (Internal note).
  - Чат дээрээс шууд **"Бот холбох / Бот салгах"** товч.

- 📊 **Харилцагчдын Асуултын Ангилал & AI Тайлан (Inquiry Analytics & AI Report):**
  - Суваг бүрээр болон сонгосон сувгуудаас харилцагчдын асуултуудыг цуглуулах.
  - Семантик аргаар 8 үндсэн сэдэвт (Хүргэлт, Төлбөр & StorePay, Үлдэгдэл & Үнэ, Баталгаат засвар, B2B & НӨАТ, Цагийн хуваарь, Хямдрал, Оператор дуудах) хувь, хандлагатай нь ангилах.
  - Ихэвчлэн асуудаг сэдвүүдэд AI-аар оновчтой бэлэн хариулт үүсгэх.
  - **1-Товшилтоор "Мэдээллийн санд нэмэх"** болон **"Шуурхай хариултад хадгалах"**.
  - Удирдлагын дүгнэлт тайлан (Executive Summary), сувгуудын харьцуулалт.
  - **Тайлан татах (.md)**, **Хэвлэх / PDF болгох**, **Санах ойд хуулах**.

- ⏱️ **Операторын Ажлын Цаг & Ээлж (Worktime & Shift Tracker):**
  - Ээлж эхлүүлэх (Clock-in), дуусгах (Clock-out), түр завсарлага (Break).
  - Өдрийн ажилласан цаг, завсарласан минут, шийдвэрлэсэн чатын тоолуурууд.
  - Ажилтнуудын онлайн/офлайн/завсарлага авсан төлөвийн хяналтын самбар.
  - Bitrix24 Open Lines-д хуваарилагдсан бодит агентуудын синк хийх.

- 🤖 **BSB AI Туслах Бот & Дүрэм:**
  - Google Gemini 2.5 Flash болон BitrixGPT загварууд дээр суурилсан.
  - Мэдээллийн санд тулгуурласан хариулт өгөх ба мэдэхгүй зүйл гарвал зохиохгүйгээр оператор руу шууд шилжүүлэх (Zero-hallucination policy).
  - Автомат Handoff (Оператор дуудах түлхүүр үгс, итгэлцлийн оноо < threshold үед операторт шилжүүлэх).
  - Ботын өнгө аяс (tone), системийн зааварчилгаа, тест симулятор.

- 📚 **Мэдээллийн Сан (Knowledge Base):**
  - Түлхүүр үгийн оновчлолтой хайлтын систем.
  - Нийтлэлүүдийг ангиллаар нь нэмэх, засах, устгах.

---

## 🛠 Системийн Архитектур & Технологиуд

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT / FRONTEND                        │
│   React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion   │
│  (Omnichannel Workplace, Analytics, Shifts, KB, Settings)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST / JSON
┌──────────────────────────────▼──────────────────────────────┐
│                    SERVER / BACKEND                         │
│       Node.js 20+ / Express 4.x (Standalone CJS Bundle)     │
│                                                             │
│   ├── chatManager.ts (Чат & Харилцагчийн урсгал)            │
│   ├── inquiryAnalyticsService.ts (Асуултын ангилал & AI)   │
│   ├── botWorker.ts (Gemini & BitrixGPT хөдөлгүүр)           │
│   ├── knowledgeBase.ts (Мэдээллийн сангийн хайлтын индекс)  │
│   ├── worktimeManager.ts (Ажлын цаг & ээлжийн бүртгэл)      │
│   └── bitrixAgentsService.ts (Bitrix24 OpenLines синк)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    ┌──────────────────────┐       ┌──────────────────────┐
    │  Google Gemini API   │       │ Bitrix24 / VibeCode  │
    │  (gemini-2.5-flash)  │       │ Open Lines REST API  │
    └──────────────────────┘       └──────────────────────┘
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React icons, Motion animations.
- **Backend:** Express, TypeScript, tsx (хөгжүүлэлтийн үед), esbuild (production bundle).
- **AI Models:** Google Gemini (`@google/genai`), BitrixGPT-5.5.
- **Persistence:** Local JSON data store (`/data/` хавтас). Database шаардахгүй тул маш хөнгөн, хурдан, зөөврийн байдлаар ажиллана.

---

## 📁 Файлын бүтэц

```
.
├── data/                               # Өгөгдлийн хадгалалт (JSON)
│   ├── bot_config.json                 # Ботын тохиргоо, дүрмүүд
│   ├── chat_dialogs.json               # Чатын түүх, харилцагчдын өгөгдөл
│   ├── knowledge_base.json             # Мэдээллийн сангийн нийтлэлүүд
│   ├── worktime_shifts.json            # Операторуудын ээлж, ажилласан цаг
│   └── bitrix_agents_cache.json        # Битрикс агентуудын кэш
├── server/                             # Backend сервисийн модулиуд
│   ├── bitrixAgentsService.ts          # Open Lines сувгийн агентууд татах
│   ├── bitrixOpenlinesSync.ts          # Сувгийн тохиргоо синк хийх
│   ├── botWorker.ts                    # AI ботын мессеж боловсруулалт & Handoff
│   ├── chatManager.ts                  # Чатын өгөгдөл, харилцагчийн CRM
│   ├── inquiryAnalyticsService.ts      # Асуулт ангилал, AI зөвлөмж & тайлан
│   ├── knowledgeBase.ts                # Мэдээллийн сангийн хөдөлгүүр
│   ├── vibeApi.ts                      # Bitrix24 REST API хүсэлтийн модуль
│   └── worktimeManager.ts              # Ажлын цаг, завсарлага тооцоолол
├── src/                                # Frontend React эх код
│   ├── components/
│   │   ├── OpenChannelChatWorkplace.tsx# Үндсэн чатын ажлын байр
│   │   ├── QuickRepliesPanel.tsx       # 1-товшилтын бэлэн хариултын самбар
│   │   ├── InquiryAnalyticsTab.tsx     # Асуултын ангилал & AI тайлан
│   │   ├── WorktimeBar.tsx             # Цаг бүртгэлийн дээд хэсэг
│   │   ├── WorktimeModal.tsx           # Багийн төлөвийн цонх
│   │   ├── ChannelSelector.tsx         # Нээлттэй сувгийн жагсаалт & бот холболт
│   │   ├── KnowledgeBaseTab.tsx        # Мэдээллийн сангийн удирдлага
│   │   ├── PromptSettingsTab.tsx       # AI зааварчилгаа, дүрмийн тохиргоо
│   │   ├── SandboxTab.tsx              # Ботыг турших симулятор
│   │   ├── DialogLogsTab.tsx           # Харилцан ярианы лог
│   │   ├── DeployTab.tsx               # Сервер байршуулах удирдлага
│   │   └── Header.tsx                  # Толгой цэс
│   ├── App.tsx                         # Үндсэн удирдлагын компонент
│   ├── main.tsx                        # React entry point
│   ├── index.css                       # Tailwind CSS тохиргоо
│   └── types.ts                        # TypeScript интерфэйсүүд
├── server.ts                           # Express Backend серверийн эхлэл цэг
├── vite.config.ts                      # Vite build тохиргоо
├── package.json                        # Хамаарлууд болон build скриптүүд
├── .env.example                        # Жишээ орчны хувьсагчид
└── README.md                           # Энэхүү зааварчилгаа
```

---

## 🔐 Хүрээлэн буй орчны хувьсагчид (.env)

Төслийн үндсэн хавтсанд `.env` нэртэй файл үүсгэж дараах утгуудыг тохируулна:

```bash
# Серверийн порт (Анхдагч утга 3000)
PORT=3000

# Google Gemini API түлхүүр (Асуултын ангилал, зөвлөмж тайлан гаргах & чат хариулахад ашиглагдана)
# Авах холбоос: https://aistudio.google.com/app/apikey
GEMINI_API_KEY="AIzaSy..."

# Bitrix24 / VibeCode платформын хувийн API түлхүүр
VIBE_API_KEY="vibe_sec_..."

# Систем байршиж буй албан ёсны домэйн эсвэл IP хаяг
APP_URL="https://your-domain.com"

# Node орчин (development эсвэл production)
NODE_ENV="production"
```

---

## 💻 Локал орчинд ажиллуулах (Local Development)

### 1. Урьдчилсан шаардлага:
- **Node.js**: хувилбар `v20.x` буюу түүнээс дээш (LTS санал болгож байна).
- **npm**: хувилбар `10.x` буюу түүнээс дээш.

### 2. Суулгах алхмууд:

```bash
# 1. Төслийн хавтас руу орох
cd /path/to/project

# 2. Шаардлагатай npm package-уудыг суулгах
npm install

# 3. .env файлыг үүсгэх
cp .env.example .env
# .env файл доторх түлхүүрүүдээ өөрийнхөөрөө оруулж хадгална

# 4. Хөгжүүлэлтийн горимд серверийг эхлүүлэх
npm run dev
```

Сервер амжилттай асвал таны хөтөч дээр **http://localhost:3000** хаягаар нээгдэнэ.

### 3. Production Build хийх:

```bash
# Vite frontend-ийг dist/ хавтсанд хөрвүүлж, Express backend-ийг dist/server.cjs болгон багцлах:
npm run build

# Багцалсан бүтээгдэхүүнийг туршиж ажиллуулах:
npm start
```

---

## 🚀 Өөр сервер дээр Deploy хийх зааварчилгаа (Production Deployment)

Та энэхүү системийг өөрийн дурын **Ubuntu VPS (DigitalOcean, AWS EC2, Hetzner, GCP Compute Engine гэх мэт)**, **Docker орчин** эсвэл **Cloud Run** дээр хялбархан байршуулах боломжтой.

---

### Сонголт A: Linux (Ubuntu/Debian) VPS дээр PM2 + Nginx + SSL тохируулах

Энэ нь хамгийн түгээмэл, найдвартай бөгөөд 24/7 тасралтгүй ажиллах стандартын арга юм.

#### 1. Серверээ бэлтгэх (Node.js 20 LTS & PM2 суулгах):
Серверт SSH-ээр холбогдоод коммандуудыг ажиллуулна:

```bash
# Системийг шинэчлэх
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS хувилбарыг суулгах
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Хувилбаруудыг шалгах
node -v # v20.x.x харагдах ёстой
npm -v

# PM2 процессийн менежерийг дэлхий даяар (globally) суулгах
sudo npm install -g pm2
```

#### 2. Төслийн кодыг серверт байршуулах:

```bash
# Төслийг байршуулах хавтас үүсгэх
sudo mkdir -p /var/www/bsb-ai-bot
sudo chown -R $USER:$USER /var/www/bsb-ai-bot

# Кодоо хуулах (Git ашиглах жишээ)
git clone <таны-репозиторын-холбоос> /var/www/bsb-ai-bot
cd /var/www/bsb-ai-bot

# Хамаарлуудыг суулгах
npm install

# .env файлыг үүсгэж тохируулах
nano .env
```
*(.env файлын тохиргоогоо хийгээд `Ctrl+O`, `Enter`, `Ctrl+X` дарж хадгална)*

#### 3. Төслийг Build хийх:

```bash
npm run build
```
Энэ нь `dist/` хавтсанд веб хуудсыг хөрвүүлж, `dist/server.cjs` нэртэй бие даасан серверийг үүсгэнэ.

#### 4. PM2-оор серверийг эхлүүлэх & автоматаар асах тохиргоо:

```bash
# PM2-оор серверийг эхлүүлэх
pm2 start dist/server.cjs --name "bsb-ai-bot"

# Сервер дахин ачаалагдах (reboot) үед автоматаар асаах тохиргоог идэвхжүүлэх
pm2 startup
# (Дэлгэц дээр гарч ирсэн sudo env PATH=... эхлэх коммандыг хуулж ажиллуулна)
pm2 save

# Төлөв шалгах
pm2 status
pm2 logs bsb-ai-bot
```

#### 5. Nginx Reverse Proxy тохируулах (Port 80/443-ыг 3000 руу чиглүүлэх):

```bash
# Nginx суулгах
sudo apt install -y nginx

# Тохиргооны файл үүсгэх
sudo nano /etc/nginx/sites-available/bsb-ai-bot
```

Файлд дараах тохиргоог хуулж тавина (`your-domain.com` гэсэн хэсгийг өөрийн домэйн эсвэл серверийн IP-ээр солино):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Хамгийн их илгээх файлын хэмжээ (зураг, файл оруулахад)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Тохиргоог идэвхжүүлж Nginx-ийг дахин ачааллах:

```bash
sudo ln -s /etc/nginx/sites-available/bsb-ai-bot /etc/nginx/sites-enabled/
sudo nginx -t # Алдаагүй эсэхийг шалгана
sudo systemctl restart nginx
```

#### 6. Үнэгүй SSL (HTTPS) сертификат суулгах (Certbot):

Bitrix24 Open Lines болон Webhook нь **заавал HTTPS (SSL)** протокол шаарддаг.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Certbot нь сертификатыг автоматаар суулгаж, хугацаа нь дуусахаас өмнө автоматаар сунгах тохиргоог хийнэ.

---

### Сонголт B: Docker & Docker Compose ашиглан ажиллуулах

Хэрэв та Docker ашиглахыг илүүд үзэж байвал дараах байдлаар маш хялбар ажиллуулж болно.

#### 1. Төслийн үндсэн хавтсанд `Dockerfile` үүсгэх:

```dockerfile
# Build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production run phase
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/server.ts ./

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

#### 2. `docker-compose.yml` файл үүсгэх:

```yaml
version: '3.8'

services:
  bsb-ai-bot:
    build: .
    container_name: bsb-ai-bot-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - VIBE_API_KEY=${VIBE_API_KEY}
      - APP_URL=${APP_URL}
    volumes:
      # Data хавтсыг host дээр хадгалснаар контейнер устсан ч мэдээлэл хадгалагдаж үлдэнэ
      - ./data:/app/data
```

#### 3. Ажиллуулах:

```bash
# Эхлүүлэх
docker compose up -d --build

# Лог шалгах
docker compose logs -f
```

---

### Сонголт C: Systemd Service (Linux Daemon) ашиглах

Хэрэв PM2 ашиглахгүйгээр шууд Линуксийн системийн сервис (systemd) болгохыг хүсвэл:

1. Сервисийн файл үүсгэх:
```bash
sudo nano /etc/systemd/system/bsb-bot.service
```

2. Доорх агуулгыг бичих:
```ini
[Unit]
Description=BSB OpenLines AI Bot & Workplace Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/bsb-ai-bot
ExecStart=/usr/bin/node /var/www/bsb-ai-bot/dist/server.cjs
Restart=always
RestartSec=10
EnvironmentFile=/var/www/bsb-ai-bot/.env

[Install]
WantedBy=multi-user.target
```

3. Идэвхжүүлэх ба асаах:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bsb-bot
sudo systemctl start bsb-bot
sudo systemctl status bsb-bot
```

---

### Сонголт D: Google Cloud Run дээр байршуулах

```bash
# 1. Google Cloud CLI нэвтрэх
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Cloud Run дээр шууд байршуулах
gcloud run deploy bsb-openlines-bot \
  --source . \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,PORT=3000,GEMINI_API_KEY=YOUR_KEY"
```

---

## 🔗 Bitrix24 Open Lines болон Bot тохируулах заавар

1. **Bitrix24 порталдаа нэвтрэх:**
   - Таны порталын хаяг (Жишээ нь: `https://bsb.bitrix24.com` эсвэл холбогдох портал).
2. **Нээлттэй сувгийн тохиргоо (Open Channels Settings):**
   - *CRM -> Add-ons -> Contact Center* эсвэл *Open Lines* цэс рүү орно.
   - Холбохыг хүссэн суваг (Facebook Comments, Web Live Chat, Instagram, Telegram г.м)-аа сонгоно.
3. **AI Бот бүртгэх & Холбох:**
   - Манай систем дээрх **"Нээлттэй сувгууд"** цэс рүү ороод:
     - Хүссэн сувгийнхаа ард байрлах **"Бот холбох"** товчийг дарна.
     - Эсвэл Чатын дээд хэсэгт байрлах **"Боттой холбох"** товчийг дарснаар Bitrix24 дээр уг сувагт BSB AI Туслах бот автоматаар бүртгэгдэнэ.
4. **Бот ажиллах дараалал:**
   - Хэрэглэгч чатад анхлан мессеж бичихэд BSB AI Бот мэдээллийн сангаас хариултыг хайж хариулна.
   - Хэрэглэгч *"хүнтэй ярих"*, *"оператор"* гэж бичих эсвэл тодорхойгүй асуулт тавигдсан үед бот өөрөө чатнаас гарч дараалалд байгаа оператор луу шилжүүлнэ.

---

## 💾 Өгөгдлийн сангийн нөөцлөлт (Backup) & Troubleshooting

### 1. Өгөгдөл нөөцлөх (Backup):
Системийн бүх өгөгдөл (чатууд, мэдээллийн сан, ээлж, ботын дүрмүүд) төслийн `/data/` хавтсанд хадгалагддаг.
Нөөцлөлт хийхдээ уг хавтсыг архивлан авахад хангалттай:

```bash
# Data хавтсыг огноотой архивлах
tar -czvf bsb_data_backup_$(date +%Y%m%d_%H%M%S).tar.gz data/
```

### 2. Серверийн Лог шалгах:
Аливаа алдаа гарсан эсэхийг дараах коммандуудаар шалгана:

```bash
# PM2 ашиглаж байгаа бол:
pm2 logs bsb-ai-bot --lines 100

# Nginx алдааны лог:
sudo tail -f /var/log/nginx/error.log

# Systemd ашиглаж байгаа бол:
sudo journalctl -u bsb-bot -f
```

### 3. Түгээмэл асуудлууд (Troubleshooting):
- **Port 3000 already in use:**
  `sudo lsof -i :3000` коммандаар шалгаж, өмнөх хуучин процессыг `kill -9 <PID>` хийнэ.
- **Gemini API Error:**
  `.env` файл доторх `GEMINI_API_KEY` зөв эсэхийг шалгана.
- **Chat дээр Quick replies хадгалагдахгүй байх:**
  Хөтчийн localStorage цэвэрлэсэн эсэхийг шалгах, `Inquiry Analytics & AI Report` цэснээс "Шуурхай хариултад хадгалах" товч дарж автоматаар дахин бүртгэнэ.

---

## 👨‍💻 Хөгжүүлэлтийн баг & Дэмжлэг
- **Төсөл:** BSB OpenLines AI Bot & Omnichannel Operator Workplace
- **Компани:** БСБ Электроникс ХХК
- **Технологийн дэмжлэг:** Google AI Studio / Gemini API & Bitrix24 REST API
