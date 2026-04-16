// ============================================
// ui.js — Semua manipulasi UI
// Depends on: config.js
// ============================================

// ── TAGLINE ROTATOR ──────────────────────────
function startTaglineRotation() {
  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % TAGLINES.length;
    document.getElementById('tagline').textContent = TAGLINES[idx];
  }, 4000);
}

// ── CHAT MESSAGES ────────────────────────────
function addChatMsg(type, text, userName = '') {
  const box = document.getElementById('chatBox');
  const el  = document.createElement('div');
  el.className = `chat-msg ${type}`;

  if (type === 'paijo') {
    el.innerHTML = `<b>🌾 Paijo:</b> ${escapeHtml(text)}`;
  } else if (type === 'user') {
    el.innerHTML = `<b>👤 ${escapeHtml(userName || 'Kamu')}:</b> ${escapeHtml(text)}`;
  } else {
    el.textContent = text;
  }

  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function showTyping(show) {
  document.getElementById('typingEl')?.remove();
  if (!show) return;

  const box = document.getElementById('chatBox');
  const el  = document.createElement('div');
  el.id        = 'typingEl';
  el.className = 'typing-indicator';
  el.textContent = '🌾 Paijo lagi mikir...';
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── SPEECH BUBBLE ────────────────────────────
let _bubbleTimer;
function showBubble(text) {
  const bubble = document.getElementById('speechBubble');
  document.getElementById('bubbleText').textContent = text;
  bubble.classList.add('visible');
  clearTimeout(_bubbleTimer);
  _bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), 5000);
}

// ── SPRITE STATE ─────────────────────────────
function setPaijoState(state) {
  const el    = document.getElementById('paijoPixel');
  el.className = 'paijo-pixel';
  if (state) el.classList.add(state);
}

// ── MOOD METER ───────────────────────────────
let _mood = 50;

function changeMood(delta) {
  _mood = Math.max(0, Math.min(100, _mood + delta));
  _renderMood();
}

function _renderMood() {
  document.getElementById('moodFill').style.width = _mood + '%';
  document.getElementById('moodEmoji').textContent =
    _mood < 20 ? '😞' : _mood < 40 ? '😐' : _mood < 60 ? '🙂' : _mood < 80 ? '😄' : '🤩';
}

// ── RAIN ─────────────────────────────────────
let _isHujan = false;

function createRain() {
  const container = document.getElementById('rainContainer');
  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.cssText = [
      `left:${Math.random() * 100}%`,
      `height:${10 + Math.random() * 20}px`,
      `animation-duration:${0.5 + Math.random() * 0.8}s`,
      `animation-delay:${Math.random() * 2}s`,
      `opacity:${0.4 + Math.random() * 0.6}`,
    ].join(';');
    container.appendChild(drop);
  }
}

function toggleHujan() {
  _isHujan = !_isHujan;
  document.body.classList.toggle('hujan', _isHujan);
  return _isHujan;
}

// ── SOUND (Web Audio API - 8-bit) ─────────────
let _audioCtx;

function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function _beep(freq, dur, type = 'square', vol = 0.12) {
  try {
    const ctx  = _getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (e) { /* audio blocked — silent fail */ }
}

const SOUNDS = {
  chat:    () => { _beep(523, .1); setTimeout(() => _beep(659, .1), 100); },
  happy:   () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => _beep(f, .12), i * 80)),
  scared:  () => [400, 350, 300, 250].forEach((f, i) => setTimeout(() => _beep(f, .1, 'sawtooth'), i * 60)),
  wisdom:  () => [392, 440, 494, 523].forEach((f, i) => setTimeout(() => _beep(f, .15, 'triangle'), i * 100)),
  rain:    () => { for (let i = 0; i < 5; i++) setTimeout(() => _beep(200 + Math.random() * 400, .08, 'sine', .05), i * 50); },
  easter:  () => [523, 587, 659, 698, 784, 880].forEach((f, i) => setTimeout(() => _beep(f, .1), i * 70)),
  confirm: () => { _beep(440, .1); setTimeout(() => _beep(550, .15), 120); },
};

function playSound(name) {
  SOUNDS[name]?.();
}
