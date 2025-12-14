# GamerMatch Quick Setup Script (PowerShell)
# Bu script Supabase schema kurulumu için hızlı talimatlar verir

Write-Host "🚀 GamerMatch - Supabase Setup" -ForegroundColor Cyan
Write-Host ""

# .env.local kontrolü
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local dosyası mevcut" -ForegroundColor Green
} else {
    Write-Host "❌ .env.local dosyası bulunamadı!" -ForegroundColor Red
    Write-Host "Oluşturuluyor..." -ForegroundColor Yellow
    @"
NEXT_PUBLIC_SUPABASE_URL=https://zgbjsqpreilsqiebyaka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmpzcXByZWlsc3FpZWJ5YWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTA1NzYsImV4cCI6MjA4MTEyNjU3Nn0.arJjXO5kiri92XrGo2vUykI0IB_MMXuts0h54QLfbbQ
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host "✅ .env.local oluşturuldu" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 ŞİMDİ YAPMANIZ GEREKENLER:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Supabase Dashboard'a gidin:" -ForegroundColor White
Write-Host "   https://app.supabase.com/project/zgbjsqpreilsqiebyaka" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Sol menüden 'SQL Editor' seçin" -ForegroundColor White
Write-Host ""
Write-Host "3. 'New query' butonuna tıklayın" -ForegroundColor White
Write-Host ""
Write-Host "4. 'supabase/schema.sql' dosyasını açın ve içeriğini kopyalayın" -ForegroundColor White
Write-Host ""
Write-Host "5. SQL Editor'e yapıştırıp 'Run' butonuna tıklayın" -ForegroundColor White
Write-Host ""
Write-Host "✅ Schema başarıyla kurulduktan sonra:" -ForegroundColor Green
Write-Host "   npm install" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Detaylı talimatlar için: SETUP_INSTRUCTIONS.md dosyasına bakın" -ForegroundColor Gray
Write-Host ""

