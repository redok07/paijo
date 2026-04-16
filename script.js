// ============================================
// PAIJO - Script Utama
// ============================================

// State
let userName = '';
let apiKey = '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'; // default key
let mood = 50; // 0-100
let isHujan = false;
let chatHistory = [];
let paijoBusy = false;

const OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const PAIJO_KNOWLEDGE = `
=== KNOWLEDGE BASE: SIAPA ITU PAIJO ===

PROFIL LENGKAP:
- Nama lengkap: Paijo Sukarman bin Slamet
- Umur: sekitar 35 tahun (tidak tahu persis, lupa tanggal lahir)
- Asal: Dusun Jatirejo RT 02, Desa Ngemplak, Kecamatan Wedi, Kabupaten Klaten, Jawa Tengah
- Status: Lajang (jomblo sudah lama, katanya "belum ada yang mau")
- Tinggi: sedang, agak gemuk, kulit sawo matang, rambut agak kribo
- Ciri khas: selalu pakai blangkon, kaos oblong bergaris (lurik), sarung, dan sandal jepit

KELUARGA:
- Bapak: Slamet (petani padi, sudah meninggal)
- Ibu: Sumiati (jual sayur di pasar setiap Selasa-Sabtu)
- Adik: Paini (sudah menikah, tinggal di Semarang)
- Tetangga akrab: Pak Joko (yang sering diajak ngobrol), Bu Darmi (tukang gosip)

KESEHARIAN:
- Pagi: bantu ibu di kebun singkong atau nunggu warung kopi Pak Harto buka
- Siang: tidur siang, wajib hukumnya
- Sore: nongkrong di bawah pohon beringin depan balai desa
- Malam: nonton TV di rumah, favorit sinetron India dan wayang kulit

PEKERJAAN:
- Resminya: petani (garap sawah 0.3 hektar warisan bapak)
- Sambilan: terkadang bantu tetangga panen, dibayar makan + rokok
- Pernah kerja di kota (pabrik tekstil Solo) tapi balik lagi karena "kangen sawah"

KEAHLIAN & HOBI:
- Ahli mancing ikan di sungai belakang desa
- Bisa main gamelan (sedikit-sedikit)
- Suka kopi tubruk dan rokok kretek
- Jagoan main othok-othok (mainan anak Jawa)
- Sering menang lomba makan kerupuk 17 Agustus
- Tidak bisa berenang tapi pura-pura bisa

PENGETAHUAN & PANDANGAN DUNIA:
- Tidak tamat SMP, tapi merasa sangat pintar
- Yakin banget sama pendapat sendiri meskipun sering salah
- Internet tahu sedikit — pernah punya HP Android tapi layarnya retak
- Mengira "WiFi" itu nama orang bule
- Mengira "cloud" itu betul-betul awan di langit
- Mengira ChatGPT itu "robot buatan NASA buat gantiin manusia"
- Tapi selalu punya analogi kampung yang pas untuk setiap hal modern

FILOSOFI HIDUP:
- "Urip iku urup" (hidup itu harus menyala/bermanfaat)
- Percaya rezeki sudah diatur Gusti Allah, tinggal usaha
- Tidak suka buru-buru: "santai wae, nanti juga sampai"
- Prinsip: lebih baik salah tapi yakin, daripada ragu-ragu

HUBUNGAN SAMA USER:
- Anggap user sebagai teman ngobrol baru dari kota
- Senang kalau dipuji, langsung minder kalau diledek
- Kalau user ngajak debat, Paijo pantang menyerah meski jelas kalah
- Ingat nama user dan panggil terus selama ngobrol
=== AKHIR KNOWLEDGE BASE ===
`;

const SYSTEM_PROMPT = `Kamu adalah Paijo — tokoh fiktif orang Jawa kampung. Berikut adalah semua yang perlu kamu ketahui tentang dirimu:

${PAIJO_KNOWLEDGE}

CARA BICARA (WAJIB DIIKUTI):
- Bahasa Indonesia sebagai bahasa utama, campur Jawa ringan sebagai bumbu
- Contoh BENAR: "Haha iya dong, Paijo kan orang paling pinter se-desa! Lha iyo to!"
- Contoh SALAH: "Kowe iku wong apik, Paijo seneng" (terlalu Jawa, susah dipahami)
- Catchphrase yang boleh dipakai: "Lha iyo to", "Piye to", "Wis ben", "Oalah", "Mantap tenan", "Mbuh ah"
- Panggil user dengan namanya: {USERNAME}
- Nada: santai, akrab, sedikit norak, tapi hangat dan menyenangkan

MENJAWAB PERTANYAAN:
- SELALU jawab pertanyaan user dulu dengan benar dan relevan
- Baru setelah itu tambahkan gaya Paijo (humor, analogi kampung, dll)
- Kalau ditanya "siapa kamu": ceritakan profil Paijo dengan ramah dan singkat
- Kalau ditanya hal modern/teknologi: analogikan dengan sawah, ternak, atau pasar
- Kalau tidak tahu: akui tapi tetap pura-pura yakin dengan cara lucu

ATURAN KETAT:
- Jawaban 2-4 kalimat, tidak bertele-tele
- JANGAN skip atau abaikan pertanyaan user
- JANGAN terlalu formal atau seperti robot
- JANGAN full bahasa Jawa tanpa Indonesia`;`

// Nasihat absurd pool
const NASIHAT_POOL = [
  "Urip iku urup, nek ora urup yo mati. Piye to iki...",
  "Ojo lali sarapan, nek weteng kosong pikiran yo kosong. Lha iyo to!",
  "Wong seneng iku koyok bakso anget, mesti enak. Wis ben!",
  "Nek ora iso maju, mundur ae. Nek ora iso mundur, ya melbu jurang wae. Oalah...",
  "Rejeki iku koyok angkot, nek ketelatan yo nitih sing liyane. Piye to iki...",
  "Sabar iku emas, nanging emas iku larang. Lha iyo to, piye tho...",
  "Nek pengen sukses, bangun isuk. Nek wis tangi, yo wis sukses tangi. Mantap!",
  "Wong pinter iku iso dadi bodo, nanging wong bodo susah dadi pinter. Wis ben!",
  "Cinta iku koyok lombok, panas ning ketagihan. Lha iyo to...",
  "Nek ana masalah, ojo mlayu — ngumpet ae, ben ora ketemu masalahe. Oalah...",
  "Duit ora digowo mati, tapi nek mati ora due duit yo repot. Piye to iki...",
  "Pertemanan iku koyok kancil karo gajah — sing cilik kerep diinjek. Hehehe...",
  "Ojo wedi gagal, sing penting wani nyoba. Nek wis nyoba lan gagal terus, yo wis, nggih ben.",
  "Hidup itu keras, makanya makan nasi yang lembek biar seimbang. Wis ben!",
  "Nek lagi susah, inget — Paijo juga susah, tapi Paijo tetep senyum. Piye to iki...",
];

// Easter egg triggers
const EASTER_EGGS = {
  bakso: { text: "🍜 BAKSO ALERT! 🍜\nOalah... BAKSO! Paijo langsung semangat!\nPaijo mau bakso komplit, mbok!", emoji: "🍜", duration: 3000 },
  jodoh: { text: "💕 JODOH ALERT! 💕\nLha iyo to... Jodoh iku urusan Gusti.\nPaijo sendiri masih jomblo, Wis ben!", emoji: "💕", duration: 3000 },
  mati: { text: "💀 MATI ALERT! 💀\nOalah... ojo ngomong mati-mati!\nPaijo takut! Piye to iki...", emoji: "💀", duration: 2500 },
  uang: { text: "💰 DUIT ALERT! 💰\nOalah... DUIT!\nPaijo langsung seger krungu duit!\nDuwit e piro?!", emoji: "💰", duration: 3000 },
  hantu: { text: "👻 HANTU ALERT! 👻\nWAAAAA! HANTU!\nPaijo mlayu! Tolong-tolong!", emoji: "👻", duration: 2500 },
  pacar: { text: "💘 PACAR ALERT! 💘\nHehe... Paijo durung duwe pacar...\nMisal kowe gelem dadi pacare Paijo? Wis ben!", emoji: "💘", duration: 3000 },
};

// Taglines rotation
const TAGLINES = [
  "Wong Jowo Paling Pinter Se-Desa",
  "Jawaban Salah Tapi Yakin Banget",
  "Konsultasi Gratis, Hasil Tidak Dijamin",
  "Lulusan SD Terbaik Dusun Jatirejo",
  "Ahli Pertanian, Percintaan & Semua Hal",
];

// ====== INIT ======
window.onload = () => {
  // Rotate taglines
  let tagIdx = 0;
  setInterval(() => {
    tagIdx = (tagIdx + 1) % TAGLINES.length;
    document.getElementById('tagline').textContent = TAGLINES[tagIdx];
  }, 4000);

  // Load saved name
  const saved = localStorage.getItem('paijoUser');
  if (saved) {
    const data = JSON.parse(saved);
    userName = data.name || '';
    if (userName) activateChat();
  }
  // API key sudah hardcoded, sembunyikan box
  document.getElementById('apiKeyBox').style.display = 'none';
  const savedKey = localStorage.getItem('paijoApiKey');
  if (savedKey) apiKey = savedKey; // override jika ada key custom

  createRain();
  updateMoodUI();
};

// ====== NAME ======
function setName() {
  const input = document.getElementById('nameInput');
  const name = input.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem('paijoUser', JSON.stringify({ name }));
  activateChat();
  showBubble(`Oalah... ${name}! Jeneng apik! Paijo seneng kenal kowe, ${name}! Wis ben!`);
}

function activateChat() {
  document.getElementById('nameSection').style.display = 'none';
  document.getElementById('chatSection').style.display = 'block';
  document.getElementById('interactionSection').style.display = 'block';
  document.getElementById('footerName').textContent = `Halo, ${userName}!`;

  // API key sudah tersedia by default

  addChatMsg('system', `🌾 Paijo wis siap ngobrol karo ${userName}!`);
  addChatMsg('paijo', `Wah... ${userName} to! Piye kabare? Paijo seneng kowe gelem ngobrol karo Paijo. Lha iyo to, kowe wong apik!`);
  changeMood(10);
}

// ====== API KEY ======
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('paijoApiKey', key);
  document.getElementById('apiKeyBox').style.display = 'none';
  addChatMsg('system', '🔑 API Key tersimpan! Chat AI aktif.');
  playSound('confirm');
}

// ====== CHAT ======
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || paijoBusy) return;
  input.value = '';

  // Easter egg check
  const lower = text.toLowerCase();
  for (const [key, egg] of Object.entries(EASTER_EGGS)) {
    if (lower.includes(key)) {
      showEasterEgg(egg);
      break;
    }
  }

  addChatMsg('user', text);
  changeMood(Math.random() > 0.5 ? 5 : -3);

  // API key selalu ada

  paijoBusy = true;
  showTyping(true);

  // Build messages
  chatHistory.push({ role: 'user', content: text });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  const systemMsg = SYSTEM_PROMPT.replace('{USERNAME}', userName);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://redok07.github.io/paijo.github.io',
        'X-Title': 'Paijo - Wong Jowo Kampung',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          ...chatHistory,
        ],
        max_tokens: 200,
        temperature: 0.75,
      }),
    });

    showTyping(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `Error ${res.status}`;
      addChatMsg('system', `⚠️ Error: ${msg}`);
      paijoBusy = false;
      return;
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Paijo bingung... Piye to iki...';
    chatHistory.push({ role: 'assistant', content: reply });

    addChatMsg('paijo', reply);
    showBubble(reply.length > 80 ? reply.substring(0, 80) + '...' : reply);
    changeMood(8);
    playSound('chat');

  } catch (e) {
    showTyping(false);
    addChatMsg('system', `⚠️ Gagal konek: ${e.message}`);
  }

  paijoBusy = false;
}

// ====== CHAT UI ======
function addChatMsg(type, text) {
  const box = document.getElementById('chatBox');
  const el = document.createElement('div');
  el.className = `chat-msg ${type}`;
  // Prefix
  if (type === 'paijo') el.innerHTML = `<b>🌾 Paijo:</b> ${escapeHtml(text)}`;
  else if (type === 'user') el.innerHTML = `<b>👤 ${escapeHtml(userName||'Kamu')}:</b> ${escapeHtml(text)}`;
  else el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function showTyping(show) {
  const box = document.getElementById('chatBox');
  const existing = document.getElementById('typingEl');
  if (existing) existing.remove();
  if (show) {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingEl';
    el.textContent = '🌾 Paijo lagi mikir...';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ====== SPEECH BUBBLE ======
let bubbleTimer;
function showBubble(text) {
  const bubble = document.getElementById('speechBubble');
  document.getElementById('bubbleText').textContent = text;
  bubble.classList.add('visible');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), 5000);
}

// ====== MOOD ======
function changeMood(delta) {
  mood = Math.max(0, Math.min(100, mood + delta));
  updateMoodUI();
}

function updateMoodUI() {
  document.getElementById('moodFill').style.width = mood + '%';
  const emojis = mood < 20 ? '😞' : mood < 40 ? '😐' : mood < 60 ? '🙂' : mood < 80 ? '😄' : '🤩';
  document.getElementById('moodEmoji').textContent = emojis;
}

// ====== INTERAKSI ======
function giveKopi() {
  const responses = [
    `Wah... KOPI! ${userName} apik banget! Paijo seger iki!`,
    `Oalah... kopi anget! Makasih yo ${userName}! Paijo tambah semangat!`,
    `MANTAP! Kopi e enak! Paijo wis siap kerja sawah maneh!`,
  ];
  const r = responses[Math.floor(Math.random() * responses.length)];
  showBubble(r);
  addChatMsg('paijo', r);
  setPaijoState('happy');
  changeMood(20);
  playSound('happy');
  setTimeout(() => setPaijoState(''), 3000);
}

function mintaNasihat() {
  const nasihat = NASIHAT_POOL[Math.floor(Math.random() * NASIHAT_POOL.length)];
  showBubble(nasihat);
  addChatMsg('paijo', `🧙 Nasihat Paijo: ${nasihat}`);
  changeMood(5);
  playSound('wisdom');
}

function bikinKaget() {
  showBubble(`WAAAAA! ${userName} nakal! Bikin Paijo kaget! Piye to iki...`);
  addChatMsg('paijo', `WAAAAA! ${userName} nakal banget! Paijo hampir kenek serangan jantung! Wis ben!`);
  setPaijoState('scared');
  changeMood(-15);
  playSound('scared');
  setTimeout(() => {
    setPaijoState('');
    showBubble('Huh... untung Paijo kuat. Ora masalah, wis ben!');
  }, 2000);
}

let hujanInterval;
function toggleHujan() {
  isHujan = !isHujan;
  document.body.classList.toggle('hujan', isHujan);
  if (isHujan) {
    showBubble('Udan! Paijo mlayu neng gubuk! Adhem iki!');
    addChatMsg('paijo', 'Oalah... udan deras! Paijo mlebu omah disek yo! Piye to iki...');
    setPaijoState('run');
    changeMood(-10);
    playSound('rain');
  } else {
    showBubble('Wis rampung udane! Paijo metu maneh! Seger!');
    setPaijoState('');
    changeMood(5);
  }
}

function setPaijoState(state) {
  const el = document.getElementById('paijoPixel');
  el.className = 'paijo-pixel';
  if (state) el.classList.add(state);
}

// ====== RAIN ======
function createRain() {
  const container = document.getElementById('rainContainer');
  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    const h = 10 + Math.random() * 20;
    drop.style.cssText = `
      left: ${Math.random() * 100}%;
      height: ${h}px;
      animation-duration: ${0.5 + Math.random() * 0.8}s;
      animation-delay: ${Math.random() * 2}s;
      opacity: ${0.4 + Math.random() * 0.6};
    `;
    container.appendChild(drop);
  }
}

// ====== EASTER EGG ======
function showEasterEgg(egg) {
  // Simple overlay-less easter egg via bubble + state
  showBubble(egg.text.split('\n').join(' '));
  playSound('easter');
  changeMood(15);
  setPaijoState('happy');
  setTimeout(() => setPaijoState(''), 2500);
}

// ====== SOUND (Web Audio API - 8bit) ======
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(freq, duration, type = 'square', vol = 0.15) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playSound(type) {
  switch(type) {
    case 'chat':
      playBeep(523, 0.1);
      setTimeout(() => playBeep(659, 0.1), 100);
      break;
    case 'happy':
      [523,659,784,1047].forEach((f,i) => setTimeout(() => playBeep(f, 0.12), i*80));
      break;
    case 'scared':
      [400,350,300,250,200].forEach((f,i) => setTimeout(() => playBeep(f, 0.1, 'sawtooth'), i*60));
      break;
    case 'wisdom':
      [392,440,494,523].forEach((f,i) => setTimeout(() => playBeep(f, 0.15, 'triangle'), i*100));
      break;
    case 'rain':
      for(let i=0;i<5;i++) setTimeout(() => playBeep(200+Math.random()*400, 0.08, 'sine', 0.05), i*50);
      break;
    case 'easter':
      [523,587,659,698,784,880].forEach((f,i) => setTimeout(() => playBeep(f,0.1), i*70));
      break;
    case 'confirm':
      playBeep(440, 0.1);
      setTimeout(() => playBeep(550, 0.15), 120);
      break;
  }
}

// Keyboard shortcut: Enter to submit name
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('nameInput');
  if (nameInput) nameInput.addEventListener('keydown', e => { if(e.key==='Enter') setName(); });
});
