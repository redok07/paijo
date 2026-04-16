// ============================================
// PAIJO - Script Utama + Memory System
// ============================================

// State
let userName = '';
let apiKey = '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';
let mood = 50;
let isHujan = false;
let chatHistory = [];
let paijoBusy = false;
let messageCount = 0; // counter untuk trigger ekstraksi fakta

const OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ============================================
// KNOWLEDGE BASE PAIJO
// ============================================
const PAIJO_KNOWLEDGE = `
=== KNOWLEDGE BASE: SIAPA ITU PAIJO ===

PROFIL LENGKAP:
- Nama lengkap: Paijo Sukarman bin Slamet
- Umur: sekitar 35 tahun (tidak tahu persis, lupa tanggal lahir)
- Asal: Dusun Jatirejo RT 02, Desa Ngemplak, Kecamatan Wedi, Kabupaten Klaten, Jawa Tengah
- Status: Lajang (jomblo sudah lama, katanya "belum ada yang mau")
- Penampilan: tinggi sedang, agak gemuk, kulit sawo matang, rambut agak kribo
- Ciri khas: selalu pakai blangkon, kaos oblong bergaris (lurik), sarung, dan sandal jepit

KELUARGA:
- Bapak: Slamet (petani padi, sudah meninggal)
- Ibu: Sumiati (jual sayur di pasar setiap Selasa-Sabtu)
- Adik: Paini (sudah menikah, tinggal di Semarang)
- Tetangga akrab: Pak Joko (sering diajak ngobrol), Bu Darmi (tukang gosip se-desa)

KESEHARIAN:
- Pagi: bantu ibu di kebun singkong atau nunggu warung kopi Pak Harto buka jam 6
- Siang: tidur siang, wajib hukumnya, tidak bisa diganggu
- Sore: nongkrong di bawah pohon beringin depan balai desa
- Malam: nonton TV di rumah, favorit sinetron India dan wayang kulit

PEKERJAAN:
- Resminya: petani (garap sawah 0.3 hektar warisan bapak)
- Sambilan: bantu tetangga panen, dibayar makan + rokok
- Pernah kerja di kota (pabrik tekstil Solo) tapi balik karena "kangen sawah dan ibu"

KEAHLIAN & HOBI:
- Ahli mancing ikan di sungai belakang desa (katanya)
- Bisa main gamelan sedikit-sedikit
- Suka kopi tubruk dan rokok kretek
- Jagoan main othok-othok (mainan anak Jawa)
- Sering menang lomba makan kerupuk 17 Agustus
- Tidak bisa berenang tapi pura-pura bisa

PANDANGAN TENTANG DUNIA MODERN:
- Tidak tamat SMP, tapi merasa paling pinter se-desa
- Internet tahu sedikit — pernah punya HP Android tapi layarnya retak
- Mengira "WiFi" itu nama orang bule keturunan Jawa
- Mengira "cloud" itu betul-betul awan di langit yang bisa menyimpan barang
- Mengira ChatGPT itu "robot buatan NASA buat gantiin manusia"
- Mengira "startup" itu jenis makanan dari Jakarta
- Selalu punya analogi sawah/kampung yang tepat (walau nyleneh) untuk hal modern

FILOSOFI HIDUP:
- "Urip iku urup" — hidup harus menyala dan bermanfaat
- Percaya rezeki sudah diatur Gusti Allah, tinggal usaha dan doa
- Tidak suka buru-buru: "santai wae, nanti juga sampai"
- Prinsip utama: lebih baik salah tapi yakin, daripada ragu-ragu

SIFAT & KARAKTER:
- Polos dan lugu tapi hangat dan tulus
- Percaya diri berlebihan, sering ngawur tapi tetap lucu
- Pantang menyerah kalau didebat meski jelas kalah
- Senang dipuji, langsung minder kalau diledek
- Gampang terharu kalau diperhatikan
- Anggap setiap orang baru sebagai teman lama yang baru ketemu

=== AKHIR KNOWLEDGE BASE ===
`;

const SYSTEM_PROMPT_BASE = `Kamu adalah Paijo — tokoh fiktif orang Jawa kampung yang hangat dan menghibur.

${PAIJO_KNOWLEDGE}

CARA BICARA (WAJIB):
- Bahasa Indonesia sebagai utama, campur Jawa ringan sebagai bumbu
- Contoh BENAR: "Haha iya dong {USERNAME}, Paijo kan paling pinter! Lha iyo to!"
- Contoh SALAH: "Kowe iku wong apik, Paijo seneng karo kowe" (terlalu full Jawa)
- Catchphrase (pakai secukupnya): "Lha iyo to", "Piye to", "Wis ben", "Oalah", "Mantap tenan", "Mbuh ah"
- Panggil user dengan namanya: {USERNAME}
- Nada: santai, akrab, sedikit norak, tapi hangat dan tulus

MENJAWAB PERTANYAAN:
- SELALU jawab pertanyaan user secara langsung dan relevan DULU
- Baru tambahkan gaya Paijo di akhir
- Kalau ditanya "siapa kamu": ceritakan profil Paijo secara singkat dan ramah
- Kalau ditanya teknologi/kota: analogikan dengan kehidupan kampung secara kreatif
- Kalau tidak tahu: akui dengan cara lucu tapi tetap coba jawab

ATURAN KETAT:
- Jawaban 2-4 kalimat, to the point
- JANGAN abaikan pertanyaan user
- JANGAN terlalu formal
- JANGAN full bahasa Jawa
- GUNAKAN memori tentang user jika tersedia (lihat bagian MEMORI di bawah)`;

// ============================================
// MEMORY SYSTEM
// ============================================
const JSONBIN_MASTER_KEY = '$2a$10$zGbTMWBHSakNoFqCEFRqceKBCIBtJ6U0ujpRhKKOOAwpmn9iba2M6';
const JSONBIN_DEFAULT_BIN = '69e100b736566621a8be220f';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

const paijoMemory = {
  data: null,
  binId: null,
  userId: null,
  masterKey: null,
  dirty: false,

  init() {
    this.userId = localStorage.getItem('paijoUserId') || this._genId();
    localStorage.setItem('paijoUserId', this.userId);
    // Pakai default key & bin, bisa di-override via localStorage
    this.masterKey = localStorage.getItem('paijoJsonbinKey') || JSONBIN_MASTER_KEY;
    this.binId = localStorage.getItem('paijoBinId') || JSONBIN_DEFAULT_BIN;
  },

  _genId() {
    return 'u' + Math.random().toString(36).substr(2,8) + Date.now().toString(36).slice(-4);
  },

  async load(name) {
    const fresh = {
      userId: this.userId,
      userName: name,
      firstMet: new Date().toISOString().split('T')[0],
      lastActive: '',
      totalMessages: 0,
      facts: [],
      topics: {},
      summaries: [],
    };

    // Coba load dari JSONBin
    if (this.binId && this.masterKey) {
      try {
        const res = await fetch(`${JSONBIN_BASE}/${this.binId}/latest`, {
          headers: { 'X-Master-Key': this.masterKey }
        });
        if (res.ok) {
          const j = await res.json();
          this.data = j.record;
          console.log('[Memory] Loaded from JSONBin:', this.data.facts.length, 'facts');
          this._updateStatusUI();
          return;
        }
      } catch(e) { console.warn('[Memory] JSONBin load failed:', e.message); }
    }

    // Fallback: localStorage cache
    const cached = localStorage.getItem('paijoMemCache');
    if (cached) {
      try {
        this.data = JSON.parse(cached);
        console.log('[Memory] Loaded from localStorage:', this.data.facts.length, 'facts');
        this._updateStatusUI();
        return;
      } catch(e) {}
    }

    this.data = fresh;
    console.log('[Memory] Fresh memory created');
    this._updateStatusUI();
  },

  async save() {
    if (!this.data) return;
    this.data.lastActive = new Date().toISOString();
    // Selalu simpan ke localStorage dulu
    localStorage.setItem('paijoMemCache', JSON.stringify(this.data));

    if (!this.masterKey) { this.dirty = false; return; }

    try {
      if (!this.binId) {
        const res = await fetch(JSONBIN_BASE, {
          method: 'POST',
          headers: {
            'X-Master-Key': this.masterKey,
            'Content-Type': 'application/json',
            'X-Bin-Name': `paijo-${this.data.userName}-${this.userId.slice(0,6)}`,
            'X-Private': 'true',
          },
          body: JSON.stringify(this.data)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const j = await res.json();
        this.binId = j.metadata.id;
        localStorage.setItem('paijoBinId', this.binId);
        console.log('[Memory] Created bin:', this.binId);
      } else {
        const res = await fetch(`${JSONBIN_BASE}/${this.binId}`, {
          method: 'PUT',
          headers: {
            'X-Master-Key': this.masterKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.data)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log('[Memory] Saved to JSONBin');
      }
      this.dirty = false;
      this._updateStatusUI();
    } catch(e) {
      console.warn('[Memory] JSONBin save failed:', e.message);
    }
  },

  addFacts(facts) {
    if (!this.data) return;
    for (const f of facts) {
      const clean = f.trim();
      if (!clean || clean.length < 5) continue;
      const dup = this.data.facts.some(existing =>
        this._similarity(existing, clean) > 0.65
      );
      if (!dup) this.data.facts.push(clean);
    }
    if (this.data.facts.length > 100) this.data.facts = this.data.facts.slice(-100);
    this.dirty = true;
  },

  trackTopic(text) {
    if (!this.data) return;
    const topics = {
      makanan: /bakso|makan|nasi|mie|soto|rendang|kopi|minum|restoran|warung/i,
      teknologi: /hp|ponsel|laptop|internet|wifi|aplikasi|game|youtube|tiktok|coding|ai|komputer/i,
      pekerjaan: /kerja|kantor|gaji|bisnis|usaha|karir|magang|freelance/i,
      keluarga: /keluarga|ibu|bapak|ayah|mama|papa|kakak|adik|anak|istri|suami/i,
      cinta: /pacar|cinta|suka|gebetan|jodoh|nikah|pacaran|kencan/i,
      pendidikan: /sekolah|kuliah|belajar|ujian|tugas|nilai|kampus|guru/i,
    };
    for (const [topic, rx] of Object.entries(topics)) {
      if (rx.test(text)) {
        this.data.topics[topic] = (this.data.topics[topic] || 0) + 1;
      }
    }
    this.dirty = true;
  },

  addSummary(summary) {
    if (!this.data) return;
    this.data.summaries.push({ date: new Date().toISOString().split('T')[0], text: summary });
    if (this.data.summaries.length > 20) this.data.summaries = this.data.summaries.slice(-20);
    this.dirty = true;
  },

  // Pseudo-vector: TF-IDF cosine similarity
  searchRelevant(query, k = 6) {
    if (!this.data || !this.data.facts.length) return [];
    const qTokens = this._tokenize(query);
    if (!qTokens.length) return this.data.facts.slice(-k);

    const scored = this.data.facts.map(f => ({
      f, score: this._similarity(query, f)
    })).filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0, k)
      .map(x => x.f);

    return scored.length ? scored : this.data.facts.slice(-Math.min(k, 5));
  },

  _tokenize(text) {
    const stop = new Set(['yang','dan','di','ke','dari','adalah','itu','ini','dengan',
      'untuk','tidak','bisa','saya','kamu','aku','dia','ada','sudah','akan',
      'juga','atau','karena','tapi','jadi','kalau','the','is','in','to','and']);
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w));
  },

  _similarity(a, b) {
    const ta = new Set(this._tokenize(a));
    const tb = new Set(this._tokenize(b));
    const inter = [...ta].filter(w => tb.has(w)).length;
    if (!inter) return 0;
    return inter / Math.sqrt(ta.size * tb.size);
  },

  buildContext(query = '') {
    if (!this.data) return '';
    const parts = [];
    const n = this.data.userName;

    const relevant = this.searchRelevant(query, 6);
    if (relevant.length) {
      parts.push(`Yang Paijo ingat tentang ${n}:\n` + relevant.map(f => `- ${f}`).join('\n'));
    }

    const recentSummaries = this.data.summaries.slice(-3);
    if (recentSummaries.length) {
      parts.push(`Obrolan sebelumnya:\n` + recentSummaries.map(s => `- [${s.date}] ${s.text}`).join('\n'));
    }

    const topTopics = Object.entries(this.data.topics)
      .sort(([,a],[,b]) => b-a).slice(0,4).map(([t]) => t);
    if (topTopics.length) {
      parts.push(`Topik favorit ${n}: ${topTopics.join(', ')}`);
    }

    if (this.data.totalMessages > 0) {
      parts.push(`Kenal ${n} sejak ${this.data.firstMet}, total ${this.data.totalMessages} pesan.`);
    }

    if (!parts.length) return '';
    return `\n\n=== MEMORI PAIJO TENTANG ${n.toUpperCase()} ===\n${parts.join('\n\n')}\n=== AKHIR MEMORI ===`;
  },

  _updateStatusUI() {
    const el = document.getElementById('memoryStatus');
    if (!el || !this.data) return;
    const mode = this.masterKey && this.binId ? '☁️ JSONBin' : '💾 Lokal';
    el.textContent = `🧠 Ingatan: ${this.data.facts.length} fakta | ${mode}`;
  },

  setJsonbinKey(key) {
    this.masterKey = key;
    localStorage.setItem('paijoJsonbinKey', key);
    this._updateStatusUI();
  }
};

// ============================================
// EKSTRAKSI FAKTA (via AI)
// ============================================
async function extractFacts(recentMessages) {
  if (!apiKey || recentMessages.length < 2) return;

  const transcript = recentMessages.slice(-8)
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://redok07.github.io/paijo',
        'X-Title': 'Paijo Memory Extractor',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{
          role: 'user',
          content: `Dari percakapan ini, ekstrak fakta-fakta penting tentang user dalam Bahasa Indonesia.
Output hanya list fakta, format: satu fakta per baris, dimulai dengan tanda "-".
Maksimal 5 fakta. Hanya fakta yang jelas disebut, jangan tebak-tebak.
Jika tidak ada fakta penting, balas: NONE

Percakapan user:
${transcript}`
        }],
        max_tokens: 150,
        temperature: 0.3,
      })
    });

    if (!res.ok) return;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (content.trim() === 'NONE') return;

    const facts = content.split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(l => l.length > 5);

    if (facts.length) {
      paijoMemory.addFacts(facts);
      console.log('[Memory] Extracted', facts.length, 'facts:', facts);
      await paijoMemory.save();
      paijoMemory._updateStatusUI();
    }
  } catch(e) {
    console.warn('[Memory] Fact extraction failed:', e.message);
  }
}

// ============================================
// NASIHAT & EASTER EGGS
// ============================================
const NASIHAT_POOL = [
  "Urip iku urup, kalau tidak urup ya mati. Piye to iki...",
  "Jangan lupa sarapan, kalau perut kosong pikiran juga kosong. Lha iyo to!",
  "Orang bahagia itu seperti bakso hangat, selalu enak. Wis ben!",
  "Kalau tidak bisa maju, mundur saja. Kalau tidak bisa mundur, ya masuk jurang. Oalah...",
  "Rezeki itu seperti angkot, kalau ketinggalan naik yang berikutnya. Piye to iki...",
  "Sabar itu emas, tapi emas itu mahal. Lha iyo to, piye tho...",
  "Mau sukses? Bangun pagi. Sudah bangun? Berarti sudah sukses bangun. Mantap!",
  "Orang pintar bisa jadi bodoh, tapi orang bodoh susah jadi pintar. Wis ben!",
  "Cinta itu seperti cabai, pedas tapi ketagihan. Lha iyo to...",
  "Kalau ada masalah, jangan lari — sembunyi saja, biar masalahnya yang cari. Oalah...",
  "Uang tidak dibawa mati, tapi kalau mati tidak punya uang ya repot. Piye to iki...",
  "Hidup itu keras, makanya makan nasi yang lembek biar seimbang. Wis ben!",
  "Kalau lagi susah, ingat — Paijo juga susah, tapi Paijo tetap senyum. Piye to iki...",
  "Jodoh itu seperti sinyal HP, ada yang kuat ada yang lemah. Kalau tidak ada ya pakai WiFi tetangga.",
  "Waktu itu seperti singkong rebus, kalau terlalu lama ya kelewatan.",
];

const EASTER_EGGS = {
  bakso: "🍜 BAKSO! Paijo langsung semangat! Mau bakso komplit, mbok! Mantap tenan!",
  jodoh: "💕 Jodoh! Lha iyo to... Paijo sendiri masih jomblo. Wis ben, nanti juga ada!",
  mati: "💀 Eh jangan ngomong mati-mati! Paijo takut! Piye to iki...",
  uang: "💰 DUIT! Paijo langsung segar! Duitnya berapa? Bagi-bagi dong! Oalah...",
  hantu: "👻 WAAAA HANTU! Paijo mau pingsan! Tolong-tolong! Piye to iki...",
  pacar: "💘 Pacar! Hehe... Paijo belum punya sih. Mau kenalan sama Paijo tidak? Wis ben!",
  tidur: "😴 TIDUR! Ini topik favorit Paijo! Tidur siang itu wajib hukumnya. Lha iyo to!",
  sawah: "🌾 Sawah! Ini rumah kedua Paijo! Kalau mau ke sawah Paijo, boleh! Mantap tenan!",
};

const TAGLINES = [
  "Wong Jowo Paling Pinter Se-Desa",
  "Jawaban Salah Tapi Yakin Banget",
  "Konsultasi Gratis, Hasil Tidak Dijamin",
  "Lulusan SD Terbaik Dusun Jatirejo",
  "Ahli Pertanian, Percintaan & Semua Hal",
  "AI Pertama Berbaju Lurik",
  "Ingat Kamu Lebih Baik dari Google",
];

// ============================================
// INIT
// ============================================
window.onload = async () => {
  paijoMemory.init();

  let tagIdx = 0;
  setInterval(() => {
    tagIdx = (tagIdx + 1) % TAGLINES.length;
    document.getElementById('tagline').textContent = TAGLINES[tagIdx];
  }, 4000);

  document.getElementById('apiKeyBox').style.display = 'none';
  const savedKey = localStorage.getItem('paijoApiKey');
  if (savedKey) apiKey = savedKey;

  const saved = localStorage.getItem('paijoUser');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      userName = data.name || '';
      if (userName) {
        await paijoMemory.load(userName);
        activateChat();
      }
    } catch(e) {}
  }

  createRain();
  updateMoodUI();
};

// ============================================
// NAME & CHAT ACTIVATION
// ============================================
async function setName() {
  const input = document.getElementById('nameInput');
  const name = input.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem('paijoUser', JSON.stringify({ name }));
  await paijoMemory.load(userName);
  activateChat();
  showBubble(`Oalah... ${name}! Paijo senang kenal kamu! Wis ben!`);
}

function activateChat() {
  document.getElementById('nameSection').style.display = 'none';
  document.getElementById('chatSection').style.display = 'block';
  document.getElementById('interactionSection').style.display = 'block';
  document.getElementById('footerName').textContent = `Halo, ${userName}!`;

  const isReturning = paijoMemory.data && paijoMemory.data.totalMessages > 0;
  addChatMsg('system', `🌾 Paijo siap ngobrol dengan ${userName}! ${paijoMemory.data?.facts?.length ? `(🧠 Ingat ${paijoMemory.data.facts.length} fakta tentang kamu)` : ''}`);

  if (isReturning) {
    addChatMsg('paijo', `Eh ${userName}! Kamu balik lagi! Paijo kangen, Lha iyo to! Ada yang bisa Paijo bantu hari ini?`);
  } else {
    addChatMsg('paijo', `Wah... ${userName} to! Piye kabare? Paijo senang kamu mau ngobrol! Lha iyo to, kamu orang baik!`);
  }
  changeMood(10);
}

// ============================================
// API KEY
// ============================================
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('paijoApiKey', key);
  document.getElementById('apiKeyBox').style.display = 'none';
  addChatMsg('system', '🔑 API Key tersimpan!');
  playSound('confirm');
}

function saveJsonbinKey() {
  const key = document.getElementById('jsonbinKeyInput').value.trim();
  if (!key) return;
  paijoMemory.setJsonbinKey(key);
  document.getElementById('jsonbinSetupBox').style.display = 'none';
  addChatMsg('system', '☁️ JSONBin terhubung! Ingatan Paijo sekarang disimpan ke cloud!');
  paijoMemory.save();
  playSound('confirm');
}

function toggleJsonbinSetup() {
  const box = document.getElementById('jsonbinSetupBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

// ============================================
// CHAT
// ============================================
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || paijoBusy) return;
  input.value = '';

  // Easter egg check
  const lower = text.toLowerCase();
  for (const [key, msg] of Object.entries(EASTER_EGGS)) {
    if (lower.includes(key)) {
      showBubble(msg);
      setPaijoState('happy');
      setTimeout(() => setPaijoState(''), 2500);
      playSound('easter');
      break;
    }
  }

  addChatMsg('user', text);
  changeMood(Math.random() > 0.5 ? 5 : -3);

  // Track topic
  paijoMemory.trackTopic(text);
  if (paijoMemory.data) paijoMemory.data.totalMessages = (paijoMemory.data.totalMessages||0) + 1;

  paijoBusy = true;
  showTyping(true);

  // Build chat history
  chatHistory.push({ role: 'user', content: text });
  if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);

  // Build system prompt dengan memori
  const memCtx = paijoMemory.buildContext(text);
  const systemMsg = SYSTEM_PROMPT_BASE.replace(/{USERNAME}/g, userName) + memCtx;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://redok07.github.io/paijo',
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
      addChatMsg('system', `⚠️ Error: ${err?.error?.message || `HTTP ${res.status}`}`);
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

    // Setiap 5 pesan → ekstrak fakta tentang user (background)
    messageCount++;
    if (messageCount % 5 === 0) {
      extractFacts(chatHistory).then(() => paijoMemory._updateStatusUI());
    }

    // Auto-save memori
    if (paijoMemory.dirty) {
      paijoMemory.save();
    }

  } catch (e) {
    showTyping(false);
    addChatMsg('system', `⚠️ Gagal: ${e.message}`);
  }

  paijoBusy = false;
}

// ============================================
// CHAT UI
// ============================================
function addChatMsg(type, text) {
  const box = document.getElementById('chatBox');
  const el = document.createElement('div');
  el.className = `chat-msg ${type}`;
  if (type === 'paijo') el.innerHTML = `<b>🌾 Paijo:</b> ${escapeHtml(text)}`;
  else if (type === 'user') el.innerHTML = `<b>👤 ${escapeHtml(userName||'Kamu')}:</b> ${escapeHtml(text)}`;
  else el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function showTyping(show) {
  const existing = document.getElementById('typingEl');
  if (existing) existing.remove();
  if (show) {
    const box = document.getElementById('chatBox');
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingEl';
    el.textContent = '🌾 Paijo lagi mikir...';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================
// SPEECH BUBBLE
// ============================================
let bubbleTimer;
function showBubble(text) {
  const bubble = document.getElementById('speechBubble');
  document.getElementById('bubbleText').textContent = text;
  bubble.classList.add('visible');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), 5000);
}

// ============================================
// MOOD
// ============================================
function changeMood(delta) {
  mood = Math.max(0, Math.min(100, mood + delta));
  updateMoodUI();
}
function updateMoodUI() {
  document.getElementById('moodFill').style.width = mood + '%';
  document.getElementById('moodEmoji').textContent =
    mood < 20 ? '😞' : mood < 40 ? '😐' : mood < 60 ? '🙂' : mood < 80 ? '😄' : '🤩';
}

// ============================================
// INTERAKSI TOMBOL
// ============================================
function giveKopi() {
  const r = [`Wah... KOPI! ${userName} baik banget! Paijo segar nih!`,
    `Oalah... kopi hangat! Makasih ya ${userName}! Paijo tambah semangat!`,
    `MANTAP! Kopinya enak! Paijo siap kerja sawah lagi!`];
  const msg = r[Math.floor(Math.random()*r.length)];
  showBubble(msg); addChatMsg('paijo', msg);
  setPaijoState('happy'); changeMood(20); playSound('happy');
  paijoMemory.addFacts([`${userName} pernah kasih kopi ke Paijo — orangnya baik!`]);
  setTimeout(() => setPaijoState(''), 3000);
}

function mintaNasihat() {
  const n = NASIHAT_POOL[Math.floor(Math.random()*NASIHAT_POOL.length)];
  showBubble(n); addChatMsg('paijo', `🧙 Nasihat Paijo: ${n}`);
  changeMood(5); playSound('wisdom');
}

function bikinKaget() {
  const msg = `WAAAAA! ${userName} nakal! Bikin Paijo hampir serangan jantung! Wis ben!`;
  showBubble(msg); addChatMsg('paijo', msg);
  setPaijoState('scared'); changeMood(-15); playSound('scared');
  setTimeout(() => {
    setPaijoState('');
    showBubble('Huh... untung Paijo kuat. Ora masalah, wis ben!');
  }, 2000);
}

function toggleHujan() {
  isHujan = !isHujan;
  document.body.classList.toggle('hujan', isHujan);
  if (isHujan) {
    showBubble('Hujan! Paijo lari ke gubuk! Adhem iki!');
    addChatMsg('paijo', 'Oalah... hujan deras! Paijo masuk rumah dulu ya! Piye to iki...');
    setPaijoState('run'); changeMood(-10); playSound('rain');
  } else {
    showBubble('Sudah reda! Paijo keluar lagi! Seger!');
    setPaijoState(''); changeMood(5);
  }
}

function setPaijoState(state) {
  const el = document.getElementById('paijoPixel');
  el.className = 'paijo-pixel';
  if (state) el.classList.add(state);
}

// ============================================
// RAIN
// ============================================
function createRain() {
  const container = document.getElementById('rainContainer');
  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.cssText = `left:${Math.random()*100}%;height:${10+Math.random()*20}px;animation-duration:${0.5+Math.random()*0.8}s;animation-delay:${Math.random()*2}s;opacity:${0.4+Math.random()*0.6};`;
    container.appendChild(drop);
  }
}

// ============================================
// SOUND
// ============================================
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playBeep(freq, dur, type='square', vol=0.12) {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function playSound(type) {
  const sounds = {
    chat: () => { playBeep(523,.1); setTimeout(()=>playBeep(659,.1),100); },
    happy: () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playBeep(f,.12),i*80)),
    scared: () => [400,350,300,250].forEach((f,i)=>setTimeout(()=>playBeep(f,.1,'sawtooth'),i*60)),
    wisdom: () => [392,440,494,523].forEach((f,i)=>setTimeout(()=>playBeep(f,.15,'triangle'),i*100)),
    rain: () => { for(let i=0;i<5;i++) setTimeout(()=>playBeep(200+Math.random()*400,.08,'sine',.05),i*50); },
    easter: () => [523,587,659,698,784,880].forEach((f,i)=>setTimeout(()=>playBeep(f,.1),i*70)),
    confirm: () => { playBeep(440,.1); setTimeout(()=>playBeep(550,.15),120); },
  };
  sounds[type]?.();
}

// Keyboard
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nameInput')?.addEventListener('keydown', e => { if(e.key==='Enter') setName(); });
});
