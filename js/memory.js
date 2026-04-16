// ============================================
// memory.js — Storage & Pseudo-Vector Memory
// Depends on: config.js
// ============================================

class PaijoMemory {
  constructor() {
    this.data     = null;
    this.binId    = null;
    this.userId   = null;
    this.masterKey = null;
    this.dirty    = false;
  }

  // ── BOOT ─────────────────────────────────
  init() {
    this.userId    = localStorage.getItem('paijoUserId') || this._genId();
    this.masterKey = localStorage.getItem('paijoJsonbinKey') || CONFIG.jsonbin.masterKey;
    this.binId     = localStorage.getItem('paijoBinId')     || CONFIG.jsonbin.defaultBinId;
    localStorage.setItem('paijoUserId', this.userId);
  }

  _genId() {
    return 'u' + Math.random().toString(36).substr(2, 8) + Date.now().toString(36).slice(-4);
  }

  _freshData(userName) {
    return {
      userId:        this.userId,
      userName,
      firstMet:      new Date().toISOString().split('T')[0],
      lastActive:    '',
      totalMessages: 0,
      facts:         [],
      topics:        {},
      summaries:     [],
    };
  }

  // ── LOAD ─────────────────────────────────
  async load(userName) {
    // 1. Coba JSONBin
    if (this.binId && this.masterKey) {
      try {
        const res = await fetch(`${CONFIG.jsonbin.baseUrl}/${this.binId}/latest`, {
          headers: { 'X-Master-Key': this.masterKey },
        });
        if (res.ok) {
          this.data = (await res.json()).record;
          console.log(`[Memory] Loaded from JSONBin: ${this.data.facts.length} facts`);
          this._updateUI();
          return;
        }
      } catch (e) {
        console.warn('[Memory] JSONBin load failed:', e.message);
      }
    }

    // 2. Fallback localStorage cache
    try {
      const cached = localStorage.getItem('paijoMemCache');
      if (cached) {
        this.data = JSON.parse(cached);
        console.log(`[Memory] Loaded from cache: ${this.data.facts.length} facts`);
        this._updateUI();
        return;
      }
    } catch (e) {}

    // 3. Fresh start
    this.data = this._freshData(userName);
    console.log('[Memory] Fresh start');
    this._updateUI();
  }

  // ── SAVE ─────────────────────────────────
  async save() {
    if (!this.data) return;
    this.data.lastActive = new Date().toISOString();

    // Selalu simpan ke localStorage
    localStorage.setItem('paijoMemCache', JSON.stringify(this.data));

    // Sync ke JSONBin jika tersedia
    if (!this.masterKey) { this.dirty = false; return; }

    try {
      if (!this.binId) {
        await this._createBin();
      } else {
        await this._updateBin();
      }
      this.dirty = false;
      this._updateUI();
    } catch (e) {
      console.warn('[Memory] JSONBin save failed:', e.message);
    }
  }

  async _createBin() {
    const res = await fetch(CONFIG.jsonbin.baseUrl, {
      method: 'POST',
      headers: {
        'X-Master-Key':  this.masterKey,
        'Content-Type':  'application/json',
        'X-Bin-Name':    `paijo-${this.data.userName}-${this.userId.slice(0, 6)}`,
        'X-Private':     'true',
      },
      body: JSON.stringify(this.data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    this.binId = json.metadata.id;
    localStorage.setItem('paijoBinId', this.binId);
    console.log('[Memory] Created bin:', this.binId);
  }

  async _updateBin() {
    const res = await fetch(`${CONFIG.jsonbin.baseUrl}/${this.binId}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': this.masterKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('[Memory] Synced to JSONBin');
  }

  // ── WRITE ─────────────────────────────────
  addFacts(facts) {
    if (!this.data) return;
    for (const raw of facts) {
      const fact = raw.trim();
      if (fact.length < 5) continue;
      const isDuplicate = this.data.facts.some(
        existing => this._similarity(existing, fact) > 0.65
      );
      if (!isDuplicate) this.data.facts.push(fact);
    }
    // Batas maksimum
    if (this.data.facts.length > CONFIG.maxFacts) {
      this.data.facts = this.data.facts.slice(-CONFIG.maxFacts);
    }
    this.dirty = true;
  }

  trackTopic(text) {
    if (!this.data) return;
    const TOPIC_PATTERNS = {
      makanan:    /bakso|makan|nasi|mie|soto|rendang|kopi|minum|restoran|warung|lapar/i,
      teknologi:  /hp|ponsel|laptop|internet|wifi|aplikasi|game|youtube|tiktok|coding|ai|komputer|programming/i,
      pekerjaan:  /kerja|kantor|gaji|bisnis|usaha|karir|magang|freelance|proyek/i,
      keluarga:   /keluarga|ibu|bapak|ayah|mama|papa|kakak|adik|anak|istri|suami/i,
      cinta:      /pacar|cinta|suka|gebetan|jodoh|nikah|pacaran|kencan/i,
      pendidikan: /sekolah|kuliah|belajar|ujian|tugas|nilai|kampus|guru|mahasiswa/i,
    };
    for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
      if (pattern.test(text)) {
        this.data.topics[topic] = (this.data.topics[topic] || 0) + 1;
      }
    }
    this.dirty = true;
  }

  addSummary(text) {
    if (!this.data) return;
    this.data.summaries.push({ date: new Date().toISOString().split('T')[0], text });
    if (this.data.summaries.length > CONFIG.maxSummaries) {
      this.data.summaries = this.data.summaries.slice(-CONFIG.maxSummaries);
    }
    this.dirty = true;
  }

  incrementMessages() {
    if (!this.data) return;
    this.data.totalMessages = (this.data.totalMessages || 0) + 1;
    this.dirty = true;
  }

  // ── PSEUDO-VECTOR SEARCH ──────────────────
  // TF-IDF cosine similarity: cari fakta paling relevan dengan query
  searchRelevant(query, topK = 6) {
    if (!this.data?.facts?.length) return [];
    const qTokens = new Set(this._tokenize(query));
    if (!qTokens.size) return this.data.facts.slice(-topK);

    const scored = this.data.facts
      .map(fact => ({ fact, score: this._similarity(query, fact) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(x => x.fact);

    return scored.length ? scored : this.data.facts.slice(-Math.min(topK, 5));
  }

  _tokenize(text) {
    const STOP_WORDS = new Set([
      'yang','dan','di','ke','dari','adalah','itu','ini','dengan','untuk',
      'tidak','bisa','saya','kamu','aku','dia','ada','sudah','akan','juga',
      'atau','karena','tapi','jadi','kalau','the','is','in','to','and','a',
    ]);
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  _similarity(a, b) {
    const ta = new Set(this._tokenize(a));
    const tb = new Set(this._tokenize(b));
    const intersection = [...ta].filter(w => tb.has(w)).length;
    if (!intersection) return 0;
    return intersection / Math.sqrt(ta.size * tb.size);
  }

  // ── CONTEXT BUILDER ───────────────────────
  // Hasilkan blok teks memori untuk diinjeksikan ke system prompt
  buildContext(currentQuery = '') {
    if (!this.data) return '';
    const { userName, facts, summaries, topics, totalMessages, firstMet } = this.data;
    const parts = [];

    const relevant = this.searchRelevant(currentQuery, 6);
    if (relevant.length) {
      parts.push(`Yang Paijo ingat tentang ${userName}:\n` + relevant.map(f => `- ${f}`).join('\n'));
    }

    const recentSummaries = summaries.slice(-3);
    if (recentSummaries.length) {
      parts.push(`Obrolan sebelumnya:\n` + recentSummaries.map(s => `- [${s.date}] ${s.text}`).join('\n'));
    }

    const topTopics = Object.entries(topics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([t]) => t);
    if (topTopics.length) {
      parts.push(`Topik favorit ${userName}: ${topTopics.join(', ')}`);
    }

    if (totalMessages > 0) {
      parts.push(`Kenal ${userName} sejak ${firstMet}, total ${totalMessages} pesan.`);
    }

    if (!parts.length) return '';
    return `\n\n=== MEMORI PAIJO TENTANG ${userName.toUpperCase()} ===\n${parts.join('\n\n')}\n=== AKHIR MEMORI ===`;
  }

  // ── UI ────────────────────────────────────
  _updateUI() {
    const el = document.getElementById('memoryStatus');
    if (!el || !this.data) return;
    const mode = this.masterKey && this.binId ? '☁️ JSONBin' : '💾 Lokal';
    el.textContent = `🧠 ${this.data.facts.length} fakta | ${mode}`;
  }
}

// Singleton
const memory = new PaijoMemory();
