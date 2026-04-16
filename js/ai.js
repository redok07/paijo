// ============================================
// ai.js — Semua komunikasi ke OpenRouter API
// Depends on: config.js, memory.js
// ============================================

class PaijoAI {
  constructor() {
    this.chatHistory = [];
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

    const reply = await this._call(systemPrompt, this.chatHistory);
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
}

// Singleton
const ai = new PaijoAI();
