# Supabase Database Setup

Bu klasörde GamerMatch projesi için Supabase veritabanı şemaları bulunmaktadır.

## Kurulum Adımları

1. **Supabase Projesi Oluştur**
   - [Supabase Dashboard](https://app.supabase.com) üzerinden yeni bir proje oluşturun
   - Proje URL ve Anon Key'i kopyalayın

2. **Environment Variables Ayarla**
   - `.env.local` dosyası oluşturun:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **SQL Şemasını Çalıştır**
   - Supabase Dashboard > SQL Editor'e gidin
   - `schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
   - "Run" butonuna tıklayın

4. **Doğrulama**
   - Table Editor'de şu tabloların oluşturulduğunu kontrol edin:
     - `profiles`
     - `games`
     - `user_game_profiles`
     - `matches`
     - `messages`
     - `reports`
     - `game_sessions`

## Tablo Yapısı

### profiles
Kullanıcı profilleri ve kişilik analizi verileri.

### games
Desteklenen oyunlar ve rank sistemleri.

### user_game_profiles
Kullanıcıların her oyun için rank ve rol bilgileri.

### matches
Kullanıcılar arası eşleşmeler (pending, matched, rejected).

### messages
Eşleşen kullanıcılar arası mesajlaşma.

### reports
Toxicity tracking için rapor sistemi.

### game_sessions
Eşleşen kullanıcıların birlikte oynadığı oyun kayıtları.

## Özellikler

- ✅ Row Level Security (RLS) politikaları
- ✅ Otomatik timestamp güncellemeleri
- ✅ Yeni kullanıcı kaydında otomatik profil oluşturma
- ✅ Toxicity score otomatik güncelleme
- ✅ Match puan sistemi
- ✅ Performans için index'ler
- ✅ Seed data (LoL, Valorant, CS2)

