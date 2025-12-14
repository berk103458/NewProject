/**
 * Supabase Schema Setup Script
 * Bu script schema.sql dosyasını Supabase'e yükler
 * 
 * Kullanım: node scripts/setup-supabase.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://zgbjsqpreilsqiebyaka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmpzcXByZWlsc3FpZWJ5YWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTA1NzYsImV4cCI6MjA4MTEyNjU3Nn0.arJjXO5kiri92XrGo2vUykI0IB_MMXuts0h54QLfbbQ';

async function setupSchema() {
  try {
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Schema SQL dosyası okundu...');
    console.log('\n⚠️  ÖNEMLİ: Bu script Supabase REST API üzerinden direkt SQL çalıştıramaz.');
    console.log('📝 Aşağıdaki adımları takip edin:\n');
    console.log('1. Supabase Dashboard\'a gidin: https://app.supabase.com');
    console.log('2. Projenizi seçin');
    console.log('3. Sol menüden "SQL Editor" seçin');
    console.log('4. "New query" butonuna tıklayın');
    console.log('5. Aşağıdaki SQL kodunu kopyalayıp yapıştırın:\n');
    console.log('─'.repeat(80));
    console.log(schemaSQL);
    console.log('─'.repeat(80));
    console.log('\n6. "Run" butonuna tıklayın');
    console.log('✅ Schema başarıyla oluşturulacak!\n');

    // Ayrıca .env.local dosyası için talimat
    console.log('📄 .env.local dosyası oluşturulmalı:');
    console.log('─'.repeat(80));
    console.log(`NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`);
    console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`);
    console.log('─'.repeat(80));
    console.log('\n💡 İpucu: Proje root dizininde .env.local dosyası oluşturup yukarıdaki değerleri ekleyin.\n');

  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

setupSchema();

