// ============================================
// app.js — Entry point & orchestrator
// Depends on: config.js, memory.js, ai.js, ui.js
// ============================================

// ── STATE ─────────────────────────────────────
const state = {
  userName:     '',
  isBusy:       false,
  messageCount: 0,
};

// ── BOOT ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Bersihkan semua localStorage — JSONBin adalah satu-satunya storage
  localStorage.clear();

  startTaglineRotation();
  createRain();

  // Load data dari JSONBin
  addChatMsg('system', '☁️ Memuat ingatan Paijo dari cloud...');
  await memory.load();

  // Cek apakah sudah ada userName tersimpan di JSONBin
  if (memory.data?.userName) {
    state.userName = memory.data.userName;
    _showChat();
    _greetUser();
  } else {
    // Belum kenal — tampilkan form kenalan
    document.getElementById('nameSection').style.display = 'block';
  }

  // Enter key handlers
  document.getElementById('nameInput')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') onSetName(); });
  document.getElementById('chatInput')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') onSendMessage(); });
});

// ── ONBOARDING ────────────────────────────────
async function onSetName() {
  const input = document.getElementById('nameInput');
  const name  = input.value.trim();
  if (!name) return;

  state.userName = name;
  memory.setUserName(name);
  await memory.save();   // simpan userName ke JSONBin segera

  _showChat();
  showBubble(`Oalah... ${name}! Paijo senang kenal kamu! Wis ben!`);
  _greetUser();
}

function _showChat() {
  document.getElementById('nameSection').style.display        = 'none';
  document.getElementById('chatSection').style.display        = 'block';
  document.getElementById('interactionSection').style.display = 'block';
  document.getElementById('footerName').textContent           = `Halo, ${state.userName}!`;
}

function _greetUser() {
  const isReturning = (memory.data?.totalMessages || 0) > 0;
  const factsCount  = memory.data?.facts?.length || 0;

  // Hapus pesan "memuat..." sebelumnya
  const chatBox = document.getElementById('chatBox');
  const systemMsgs = chatBox.querySelectorAll('.chat-msg.system');
  systemMsgs.forEach(el => el.remove());

  if (factsCount > 0) {
    addChatMsg('system', `🧠 Paijo ingat ${factsCount} fakta tentang kamu!`);
  }

  addChatMsg('paijo',
    isReturning
      ? `Eh ${state.userName}! Kamu balik lagi! Paijo kangen, lha iyo to! Ada yang bisa Paijo bantu?`
      : `Wah... ${state.userName} to! Piye kabare? Paijo senang kamu mau ngobrol! Lha iyo to!`,
    state.userName
  );

  changeMood(10);
}

// ── CHAT ──────────────────────────────────────
async function onSendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || state.isBusy) return;
  input.value = '';

  // Easter egg check
  const lower = text.toLowerCase();
  for (const [keyword, msg] of Object.entries(EASTER_EGGS)) {
    if (lower.includes(keyword)) {
      showBubble(msg);
      setPaijoState('happy');
      playSound('easter');
      setTimeout(() => setPaijoState(''), 2500);
      break;
    }
  }

  addChatMsg('user', text, state.userName);
  memory.trackTopic(text);
  memory.incrementMessages();
  changeMood(Math.random() > 0.5 ? 5 : -3);

  state.isBusy = true;
  showTyping(true);

  try {
    const reply = await ai.chat(text, state.userName);
    showTyping(false);
    addChatMsg('paijo', reply, state.userName);
    showBubble(reply.length > 80 ? reply.slice(0, 80) + '…' : reply);
    changeMood(8);
    playSound('chat');

    // Setiap N pesan → ekstrak fakta (background, non-blocking)
    state.messageCount++;
    if (state.messageCount % CONFIG.factExtractionInterval === 0) {
      ai.extractFacts(state.userName);
    }

    // Auto-save ke JSONBin
    if (memory.dirty) memory.save();

  } catch (err) {
    showTyping(false);
    addChatMsg('system', `⚠️ Error: ${err.message}`);
  }

  state.isBusy = false;
}

// ── TOMBOL INTERAKSI ──────────────────────────
function onGiveKopi() {
  const lines = [
    `Wah... KOPI! ${state.userName} baik banget! Paijo segar nih!`,
    `Oalah... kopi hangat! Makasih ya ${state.userName}! Paijo tambah semangat!`,
    `MANTAP! Kopinya enak! Paijo siap kerja sawah lagi!`,
  ];
  const msg = lines[Math.floor(Math.random() * lines.length)];
  showBubble(msg);
  addChatMsg('paijo', msg, state.userName);
  setPaijoState('happy');
  changeMood(20);
  playSound('happy');
  memory.addFacts([`${state.userName} pernah kasih kopi ke Paijo — orangnya baik!`]);
  if (memory.dirty) memory.save();
  setTimeout(() => setPaijoState(''), 3000);
}

function onMintaNasihat() {
  const msg = NASIHAT_POOL[Math.floor(Math.random() * NASIHAT_POOL.length)];
  showBubble(msg);
  addChatMsg('paijo', `🧙 Nasihat Paijo: ${msg}`, state.userName);
  changeMood(5);
  playSound('wisdom');
}

function onBikinKaget() {
  const msg = `WAAAAA! ${state.userName} nakal! Bikin Paijo hampir serangan jantung! Wis ben!`;
  showBubble(msg);
  addChatMsg('paijo', msg, state.userName);
  setPaijoState('scared');
  changeMood(-15);
  playSound('scared');
  setTimeout(() => {
    setPaijoState('');
    showBubble('Huh... untung Paijo kuat. Ora masalah, wis ben!');
  }, 2000);
}

function onToggleHujan() {
  const hujanOn = toggleHujan();
  if (hujanOn) {
    showBubble('Hujan! Paijo lari ke gubuk! Adhem iki!');
    addChatMsg('paijo', 'Oalah... hujan deras! Paijo masuk rumah dulu ya! Piye to iki...');
    setPaijoState('run');
    changeMood(-10);
    playSound('rain');
  } else {
    showBubble('Sudah reda! Paijo keluar lagi! Seger!');
    setPaijoState('');
    changeMood(5);
  }
}
