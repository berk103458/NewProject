# 🚀 Production Deployment Rehberi

Bu rehber, GamerMatch projesini production'a yayınlamak için adım adım talimatlar içerir.

## 📋 Gereksinimler

### Environment Variables (Gerekli)

Production'da şu environment variable'ları ayarlamanız gerekiyor:

```
NEXT_PUBLIC_SUPABASE_URL=https://zgbjsqpreilsqiebyaka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmpzcXByZWlsc3FpZWJ5YWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTA1NzYsImV4cCI6MjA4MTEyNjU3Nn0.arJjXO5kiri92XrGo2vUykI0IB_MMXuts0h54QLfbbQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmpzcXByZWlsc3FpZWJ5YWthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTU1MDU3NiwiZXhwIjoyMDgxMTI2NTc2fQ.qWB3EgJgPSZ1gYpgbSP2gap1jnw2rKLCmB1ETHH6agg
NEXT_PUBLIC_CHAT_BUCKET=chat-media
```

**⚠️ ÖNEMLİ:** `SUPABASE_SERVICE_ROLE_KEY` sadece server-side'da kullanılır, asla client-side'da expose edilmemelidir!

---

## 🎯 Seçenek 1: Vercel (ÖNERİLEN - En Kolay)

Vercel, Next.js'in kendi platformu olduğu için en kolay ve en optimize seçenektir.

### Adımlar:

1. **GitHub'a Push Et**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/kullaniciadi/gamermatch.git
   git push -u origin main
   ```

2. **Vercel'e Git**
   - [vercel.com](https://vercel.com) adresine git
   - "Sign Up" ile GitHub hesabınla giriş yap
   - "Add New Project" butonuna tıkla
   - GitHub repo'nu seç

3. **Environment Variables Ayarla**
   - Vercel proje ayarlarında "Environment Variables" sekmesine git
   - Yukarıdaki tüm environment variable'ları ekle:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (sadece Production için)
     - `NEXT_PUBLIC_CHAT_BUCKET`

4. **Deploy Et**
   - "Deploy" butonuna tıkla
   - Vercel otomatik olarak build edip deploy edecek
   - Deploy tamamlandığında bir URL alacaksın (örn: `gamermatch.vercel.app`)

5. **Custom Domain (Opsiyonel)**
   - Settings > Domains'den kendi domain'ini ekleyebilirsin

### Avantajlar:
- ✅ Otomatik HTTPS
- ✅ Global CDN
- ✅ Otomatik build ve deploy
- ✅ Preview deployments (her PR için)
- ✅ Ücretsiz tier yeterli (hobby plan)

---

## 🎯 Seçenek 2: Railway

Railway modern bir deployment platformudur, kolay kurulum sağlar.

### Adımlar:

1. **Railway'a Git**
   - [railway.app](https://railway.app) adresine git
   - GitHub ile giriş yap

2. **Yeni Proje Oluştur**
   - "New Project" > "Deploy from GitHub repo"
   - Repo'nu seç

3. **Environment Variables**
   - Settings > Variables'dan environment variable'ları ekle

4. **Build Settings**
   - Build Command: `npm run build`
   - Start Command: `npm start`

5. **Deploy**
   - Railway otomatik deploy edecek

---

## 🎯 Seçenek 3: Render

Render, kolay kullanımlı bir alternatiftir.

### Adımlar:

1. **Render'a Git**
   - [render.com](https://render.com) adresine git
   - GitHub ile giriş yap

2. **Yeni Web Service**
   - "New" > "Web Service"
   - GitHub repo'nu bağla

3. **Ayarlar**
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Environment Variables ekle

4. **Deploy**
   - Render otomatik deploy edecek

---

## 🎯 Seçenek 4: Kendi Sunucun (VPS)

Eğer kendi sunucunda çalıştırmak istersen:

### Gereksinimler:
- Node.js 18+ yüklü
- PM2 (process manager)
- Nginx (reverse proxy)

### Adımlar:

1. **Sunucuya Bağlan**
   ```bash
   ssh kullanici@sunucu-ip
   ```

2. **Projeyi Klonla**
   ```bash
   git clone https://github.com/kullaniciadi/gamermatch.git
   cd gamermatch
   ```

3. **Dependencies Yükle**
   ```bash
   npm install
   ```

4. **Environment Variables**
   ```bash
   nano .env.production
   # Yukarıdaki environment variable'ları ekle
   ```

5. **Build Et**
   ```bash
   npm run build
   ```

6. **PM2 ile Çalıştır**
   ```bash
   npm install -g pm2
   pm2 start npm --name "gamermatch" -- start
   pm2 save
   pm2 startup
   ```

7. **Nginx Konfigürasyonu**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. **SSL (Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## ✅ Deployment Sonrası Kontroller

1. **Supabase Storage Bucket**
   - `chat-media` bucket'ının public olduğundan emin ol
   - RLS policies'in doğru olduğunu kontrol et

2. **Supabase Realtime**
   - Realtime'in aktif olduğundan emin ol
   - Tüm tablolar için Realtime publication açık olmalı

3. **Environment Variables**
   - Tüm environment variable'ların doğru ayarlandığını kontrol et
   - `NEXT_PUBLIC_*` prefix'li olanlar client-side'da expose edilir

4. **Build Test**
   - Local'de `npm run build` çalıştırıp hata olmadığından emin ol

---

## 🔧 Troubleshooting

### Build Hatası
- `npm run build` local'de çalıştır, hataları gör
- TypeScript hatalarını düzelt
- Missing dependencies kontrol et

### Environment Variables Çalışmıyor
- Vercel/Railway/Render'da environment variables'ın doğru eklendiğini kontrol et
- `NEXT_PUBLIC_*` prefix'ini unutma
- Deploy sonrası yeniden build et

### Supabase Bağlantı Hatası
- Supabase URL ve key'lerin doğru olduğunu kontrol et
- Supabase dashboard'da projenin aktif olduğunu kontrol et

### Storage Bucket Hatası
- `chat-media` bucket'ının oluşturulduğunu kontrol et
- Bucket'ın public olduğunu kontrol et
- RLS policies'in doğru olduğunu kontrol et

---

## 📞 Destek

Sorun yaşarsan:
1. Console loglarını kontrol et
2. Browser DevTools > Network tab'ını kontrol et
3. Vercel/Railway/Render logs'larını kontrol et
4. Supabase dashboard'da hataları kontrol et

---

## 🎉 Başarılar!

Deployment tamamlandıktan sonra projen canlıda olacak! 🚀

