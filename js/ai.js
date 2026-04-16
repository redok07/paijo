// ============================================
// ai.js — Semua komunikasi ke OpenRouter API
// Depends on: config.js, memory.js
// ============================================

const MIN_RETRY_TEMPERATURE = 0.2;
const TEMPERATURE_REDUCTION = 0.2;
const MAX_RETRY_ATTEMPTS = 1;

class PaijoAI {
  constructor() {
    this.chatHistory = [];
    // Selalu pakai key dari config.js (hardcoded)
    // localStorage override hanya jika user eksplisit set via UI
    this.apiKey = CONFIG.openrouter.apiKey;
  }

  // ── CHAT UTAMA ────────────────────────────
  async chat(userMessage, userName) {
    // Tambah ke history
    this.chatHistory.push({ role: 'user', content: userMessage });
    if (this.chatHistory.length > CONFIG.maxChatHistory) {
      this.chatHistory = this.chatHistory.slice(-CONFIG.maxChatHistory);
    }

    // Bangun system prompt dengan injeksi memori
    const memoryContext = memory.buildContext(userMessage);
    const systemPrompt = SYSTEM_PROMPT_BASE
      .replace(/{USERNAME}/g, userName)
      + memoryContext;

    const rawReply = await this._call(systemPrompt, this.chatHistory);
    const reply = await this._ensureFinalReply(rawReply, systemPrompt);
    this.chatHistory.push({ role: 'assistant', content: reply });
    return reply;
  }

  // ── EKSTRAKSI FAKTA (background) ──────────
  async extractFacts(userName) {
    const userMessages = this.chatHistory
      .filter(m => m.role === 'user')
      .slice(-8)
      .map(m => m.content)
      .join('\n');

    if (!userMessages.trim()) return;

    const prompt = FACT_EXTRACT_PROMPT.replace('{TRANSCRIPT}', userMessages);
    try {
      const content = await this._call(null, [{ role: 'user', content: prompt }], {
        temperature: 0.3,
        maxTokens: 150,
      });

      if (content.trim() === 'NONE') return;

      const facts = content
        .split('\n')
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 5);

      if (facts.length) {
        memory.addFacts(facts);
        console.log(`[AI] Extracted ${facts.length} facts:`, facts);
        await memory.save();
        memory._updateUI();
      }
    } catch (e) {
      console.warn('[AI] Fact extraction failed:', e.message);
    }
  }

  // ── INTERNAL FETCH ────────────────────────
  async _call(systemPrompt, messages, opts = {}) {
    const { temperature, maxTokens } = {
      temperature: CONFIG.openrouter.temperature,
      maxTokens:   CONFIG.openrouter.maxTokens,
      ...opts,
    };

    const body = {
      model:      CONFIG.openrouter.model,
      messages:   systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      max_tokens: maxTokens,
      temperature,
    };

    const res = await fetch(CONFIG.openrouter.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  CONFIG.openrouter.referer,
        'X-Title':       CONFIG.openrouter.title,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Paijo bingung... Piye to iki...';
  }

  _normalizeReply(text) {
    return String(text || '').trim().replace(/\n{3,}/g, '\n\n');
  }

  _getRetryTemperature() {
    return Math.max(MIN_RETRY_TEMPERATURE, CONFIG.openrouter.temperature - TEMPERATURE_REDUCTION);
  }

  _looksLikeMetaReply(text) {
    const t = this._normalizeReply(text).toLowerCase();
    if (!t) return false;
    const patterns = [
      /\bokay,\s*the user is asking\b/,
      /\bthe user is asking\b/,
      /\bi need to (respond|answer|recall)\b/,
      /\bfirst,\s*recall\b/,
      /\bmust answer\b/,
      /\bper rules\b/,
      /\bas paijo,\s*i\b/,
      /\bthe question:\b/,
      /\buser menanyakan\b/,
      /\bsaya perlu (menjawab|ingat|merespons)\b/,
    ];
    return patterns.some(p => p.test(t));
  }

  async _ensureFinalReply(reply, systemPrompt) {
    let normalized = this._normalizeReply(reply);
    if (!this._looksLikeMetaReply(normalized)) return normalized;

    const repairInstruction = `Ulangi jawaban untuk pesan user terakhir.
Balas HANYA jawaban final untuk user.
Jangan tampilkan analisis internal, langkah berpikir, atau kalimat meta.`;

    for (let retryAttempt = 0; retryAttempt < MAX_RETRY_ATTEMPTS; retryAttempt++) {
      const repaired = await this._call(
        systemPrompt,
        [...this.chatHistory, { role: 'user', content: repairInstruction }],
        { temperature: this._getRetryTemperature() }
      );
      normalized = this._normalizeReply(repaired);
      if (!this._looksLikeMetaReply(normalized)) return normalized;
    }

    return 'Maaf, Paijo tadi sempat ngelantur. Coba tanya lagi ya, lha iyo to!';
  }
}

// Singleton
const ai = new PaijoAI();
