// ============================================
// memory.js — Pure JSONBin Storage
// Depends on: config.js
// ============================================

class PaijoMemory {
  constructor() {
    this.data      = null;   // in-memory cache untuk sesi ini
    this.dirty     = false;
    this.masterKey = CONFIG.jsonbin.masterKey;
    this.binId     = CONFIG.jsonbin.defaultBinId;
  }

  // ── SCHEMA ───────────────────────────────
  _fresh(userName = '') {
    return {
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
  async load() {
    try {
      const res = await fetch(`${CONFIG.jsonbin.baseUrl}/${this.binId}/latest`, {
        headers: { 'X-Master-Key': this.masterKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.data = (await res.json()).record;
      console.log(`[Memory] Loaded: ${this.data.facts.length} facts, user="${this.data.userName}"`);
    } catch (e) {
      console.warn('[Memory] Load failed:', e.message);
      // Mulai fresh jika bin kosong / belum ada data
      this.data = this._fresh();
    }
    this._updateUI();
  }

  // ── SAVE ─────────────────────────────────
  async save() {
    if (!this.data) return;
    this.data.lastActive = new Date().toISOString();
    try {
      const res = await fetch(`${CONFIG.jsonbin.baseUrl}/${this.binId}`, {
        method:  'PUT',
        headers: {
          'X-Master-Key': this.masterKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.dirty = false;
      console.log('[Memory] Saved to JSONBin');
    } catch (e) {
      console.warn('[Memory] Save failed:', e.message);
    }
    this._updateUI();
  }

  // ── WRITE ────────────────────────────────
  setUserName(name) {
    if (!this.data) this.data = this._fresh(name);
    this.data.userName = name;
    this.dirty = true;
  }

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
    if (this.data.facts.length > CONFIG.maxFacts) {
      this.data.facts = this.data.facts.slice(-CONFIG.maxFacts);
    }
    this.dirty = true;
  }

  trackTopic(text) {
    if (!this.data) return;
    const PATTERNS = {
      makanan:    /bakso|makan|nasi|mie|soto|rendang|kopi|minum|restoran|warung|lapar/i,
      teknologi:  /hp|ponsel|laptop|internet|wifi|aplikasi|game|youtube|tiktok|coding|ai|komputer/i,
      pekerjaan:  /kerja|kantor|gaji|bisnis|usaha|karir|magang|freelance|proyek/i,
      keluarga:   /keluarga|ibu|bapak|ayah|mama|papa|kakak|adik|anak|istri|suami/i,
      cinta:      /pacar|cinta|suka|gebetan|jodoh|nikah|pacaran|kencan/i,
      pendidikan: /sekolah|kuliah|belajar|ujian|tugas|nilai|kampus|guru|mahasiswa/i,
    };
    for (const [topic, pattern] of Object.entries(PATTERNS)) {
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

  // ── PSEUDO-VECTOR SEARCH ─────────────────
  searchRelevant(query, topK = 6) {
    if (!this.data?.facts?.length) return [];
    if (!this._tokenize(query).length) return this.data.facts.slice(-topK);

    const scored = this.data.facts
      .map(fact => ({ fact, score: this._similarity(query, fact) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(x => x.fact);

    return scored.length ? scored : this.data.facts.slice(-Math.min(topK, 5));
  }

  _tokenize(text) {
    const STOP = new Set([
      'yang','dan','di','ke','dari','adalah','itu','ini','dengan','untuk',
      'tidak','bisa','saya','kamu','aku','dia','ada','sudah','akan','juga',
      'atau','karena','tapi','jadi','kalau','the','is','in','to','and','a',
    ]);
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w));
  }

  _similarity(a, b) {
    const ta = new Set(this._tokenize(a));
    const tb = new Set(this._tokenize(b));
    const intersection = [...ta].filter(w => tb.has(w)).length;
    if (!intersection) return 0;
    return intersection / Math.sqrt(ta.size * tb.size);
  }

  // ── CONTEXT BUILDER ──────────────────────
  buildContext(currentQuery = '') {
    if (!this.data) return '';
    const { userName, facts, summaries, topics, totalMessages, firstMet } = this.data;
    const parts = [];

    const relevant = this.searchRelevant(currentQuery, 6);
    if (relevant.length) {
      parts.push(`Yang Paijo ingat tentang ${userName}:\n` + relevant.map(f => `- ${f}`).join('\n'));
    }

    const recent = summaries.slice(-3);
    if (recent.length) {
      parts.push(`Obrolan sebelumnya:\n` + recent.map(s => `- [${s.date}] ${s.text}`).join('\n'));
    }

    const topTopics = Object.entries(topics)
      .sort(([, a], [, b]) => b - a).slice(0, 4).map(([t]) => t);
    if (topTopics.length) {
      parts.push(`Topik favorit ${userName}: ${topTopics.join(', ')}`);
    }

    if (totalMessages > 0) {
      parts.push(`Kenal ${userName} sejak ${firstMet}, total ${totalMessages} pesan.`);
    }

    if (!parts.length) return '';
    return `\n\n=== MEMORI PAIJO TENTANG ${userName.toUpperCase()} ===\n${parts.join('\n\n')}\n=== AKHIR MEMORI ===`;
  }

  // ── UI ───────────────────────────────────
  _updateUI() {
    const el = document.getElementById('memoryStatus');
    if (!el || !this.data) return;
    el.textContent = `🧠 ${this.data.facts.length} fakta | ☁️ JSONBin`;
  }
}

// Singleton
const memory = new PaijoMemory();
