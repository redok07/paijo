// ============================================
// PAIJO MEMORY SYSTEM
// JSONBin.io storage + Pseudo-Vector Search
// ============================================

const JSONBIN_KEY = '__JSONBIN_KEY__'; // diganti saat deploy
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

const DEFAULT_MEMORY = {
  userId: '',
  userName: '',
  firstMet: '',
  lastActive: '',
  totalMessages: 0,
  facts: [],          // ["Suka bakso", "Tinggal di Jakarta", ...]
  topics: {},         // { "makanan": 3, "teknologi": 1 }
  chatSummaries: [],  // ringkasan obrolan lalu
  mood_avg: 50,
};

class PaijoMemorySystem {
  constructor() {
    this.key = JSONBIN_KEY;
    this.memory = null;
    this.binId = localStorage.getItem('paijoBinId') || null;
    this.userId = localStorage.getItem('paijoUserId') || this._genId();
    localStorage.setItem('paijoUserId', this.userId);
    this.dirty = false; // ada perubahan yang belum disimpan
  }

  _genId() {
    return 'u_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // ── LOAD ──────────────────────────────────────────
  async load(userName) {
    if (this.binId && this.key !== '__JSONBIN_KEY__') {
      try {
        const res = await fetch(`${JSONBIN_BASE}/${this.binId}/latest`, {
          headers: { 'X-Master-Key': this.key }
        });
        if (res.ok) {
          const data = await res.json();
          this.memory = data.record;
          console.log('[Paijo Memory] Loaded from JSONBin:', this.memory.facts.length, 'facts');
          return this.memory;
        }
      } catch (e) {
        console.warn('[Paijo Memory] Load failed, using fresh memory:', e.message);
      }
    }

    // Fallback: cek localStorage cache
    const cached = localStorage.getItem('paijoMemoryCache');
    if (cached) {
      try {
        this.memory = JSON.parse(cached);
        console.log('[Paijo Memory] Loaded from localStorage cache');
        return this.memory;
      } catch(e) {}
    }

    // Fresh memory
    this.memory = {
      ...DEFAULT_MEMORY,
      userId: this.userId,
      userName,
      firstMet: new Date().toISOString().split('T')[0],
    };
    return this.memory;
  }

  // ── SAVE ──────────────────────────────────────────
  async save() {
    if (!this.memory) return;
    this.memory.lastActive = new Date().toISOString();

    // Selalu cache ke localStorage sebagai backup
    localStorage.setItem('paijoMemoryCache', JSON.stringify(this.memory));

    if (this.key === '__JSONBIN_KEY__') {
      console.log('[Paijo Memory] No JSONBin key, saved to localStorage only');
      return;
    }

    try {
      if (!this.binId) {
        // Buat bin baru
        const res = await fetch(JSONBIN_BASE, {
          method: 'POST',
          headers: {
            'X-Master-Key': this.key,
            'Content-Type': 'application/json',
            'X-Bin-Name': `paijo-${this.memory.userName}-${this.userId.slice(0,8)}`,
            'X-Private': 'true',
          },
          body: JSON.stringify(this.memory)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.binId = data.metadata.id;
        localStorage.setItem('paijoBinId', this.binId);
        console.log('[Paijo Memory] Created new bin:', this.binId);
      } else {
        // Update bin existing
        const res = await fetch(`${JSONBIN_BASE}/${this.binId}`, {
          method: 'PUT',
          headers: {
            'X-Master-Key': this.key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.memory)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log('[Paijo Memory] Saved to JSONBin');
      }
      this.dirty = false;
    } catch (e) {
      console.warn('[Paijo Memory] Save to JSONBin failed:', e.message);
    }
  }

  // ── WRITE FACTS ───────────────────────────────────
  addFacts(factsArray) {
    if (!this.memory) return;
    for (const fact of factsArray) {
      const clean = fact.trim();
      if (!clean) continue;
      // Hindari duplikat (fuzzy)
      const exists = this.memory.facts.some(f =>
        this.cosineSimilarity(this.tokenize(f), this.tokenize(clean)) > 0.7
      );
      if (!exists) {
        this.memory.facts.push(clean);
      }
    }
    // Max 80 facts, hapus yang paling lama
    if (this.memory.facts.length > 80) {
      this.memory.facts = this.memory.facts.slice(-80);
    }
    this.dirty = true;
  }

  addTopic(topic) {
    if (!this.memory) return;
    const t = topic.toLowerCase().trim();
    this.memory.topics[t] = (this.memory.topics[t] || 0) + 1;
    this.dirty = true;
  }

  addSummary(summary) {
    if (!this.memory) return;
    this.memory.chatSummaries.push({
      date: new Date().toISOString().split('T')[0],
      summary
    });
    if (this.memory.chatSummaries.length > 15) {
      this.memory.chatSummaries = this.memory.chatSummaries.slice(-15);
    }
    this.dirty = true;
  }

  incrementMessages() {
    if (!this.memory) return;
    this.memory.totalMessages = (this.memory.totalMessages || 0) + 1;
    this.dirty = true;
  }

  // ── PSEUDO-VECTOR SEARCH ──────────────────────────
  // TF-IDF cosine similarity untuk recall memori relevan
  searchRelevant(query, topK = 6) {
    if (!this.memory || !this.memory.facts.length) return [];
    const queryVec = this.tokenize(query);
    if (!queryVec.length) return this.memory.facts.slice(-topK);

    const scored = this.memory.facts.map(fact => ({
      fact,
      score: this.cosineSimilarity(queryVec, this.tokenize(fact))
    }));

    const relevant = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.fact);

    // Jika tidak ada yang relevan, ambil yang terbaru
    if (!relevant.length) return this.memory.facts.slice(-Math.min(topK, 5));
    return relevant;
  }

  tokenize(text) {
    const stopWords = new Set([
      'yang','dan','di','ke','dari','adalah','itu','ini','dengan','untuk',
      'tidak','bisa','saya','kamu','aku','dia','mereka','kami','kita','ada',
      'sudah','sedang','akan','juga','atau','karena','tapi','jadi','kalau',
      'the','a','is','in','of','to','and','i','you','he','she','we',
    ]);
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  cosineSimilarity(vecA, vecB) {
    const setA = new Set(vecA);
    const setB = new Set(vecB);
    const intersection = [...setA].filter(w => setB.has(w));
    if (!intersection.length) return 0;
    return intersection.length / Math.sqrt(setA.size * setB.size);
  }

  // ── CONTEXT BUILDER ───────────────────────────────
  // Bangun konteks memori untuk diinjek ke system prompt
  buildContext(currentQuery = '') {
    if (!this.memory) return '';
    const parts = [];
    const name = this.memory.userName;

    // Relevant facts berdasarkan query saat ini
    if (this.memory.facts.length > 0) {
      const relevant = this.searchRelevant(currentQuery, 6);
      parts.push(
        `Yang Paijo ingat tentang ${name}:\n` +
        relevant.map(f => `- ${f}`).join('\n')
      );
    }

    // Ringkasan obrolan sebelumnya (max 3 terakhir)
    if (this.memory.chatSummaries.length > 0) {
      const recent = this.memory.chatSummaries.slice(-3);
      parts.push(
        `Obrolan sebelumnya dengan ${name}:\n` +
        recent.map(s => `- [${s.date}] ${s.summary}`).join('\n')
      );
    }

    // Topik favorit
    const topTopics = Object.entries(this.memory.topics)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 5)
      .map(([t]) => t);
    if (topTopics.length > 0) {
      parts.push(`Topik yang sering dibahas ${name}: ${topTopics.join(', ')}`);
    }

    if (this.memory.totalMessages > 0) {
      const since = this.memory.firstMet;
      parts.push(`Paijo kenal ${name} sejak ${since}, sudah ${this.memory.totalMessages} pesan.`);
    }

    if (!parts.length) return '';
    return `\n\n=== MEMORI PAIJO TENTANG ${name.toUpperCase()} ===\n${parts.join('\n\n')}\n=== AKHIR MEMORI ===`;
  }

  // ── STATUS ────────────────────────────────────────
  getStatus() {
    if (!this.memory) return { loaded: false };
    return {
      loaded: true,
      userName: this.memory.userName,
      facts: this.memory.facts.length,
      topics: Object.keys(this.memory.topics).length,
      summaries: this.memory.chatSummaries.length,
      totalMessages: this.memory.totalMessages,
      binId: this.binId,
      storageMode: this.key !== '__JSONBIN_KEY__' && this.binId ? 'JSONBin ☁️' : 'localStorage 💾',
    };
  }
}

const paijoMemory = new PaijoMemorySystem();
