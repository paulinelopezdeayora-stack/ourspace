// ===== OURSPACE SHARED JS =====

// ---- THEMES (CSS var overrides applied to :root) ----
const OS_THEMES = {
  'emo-dark':  { label:'🖤 Emo Dark',   hue: 280 },
  'bubblegum': { label:'🌸 Bubblegum',  hue: 330 },
  'matrix':    { label:'💾 Matrix',     hue: 130 },
  'midnight':  { label:'🌙 Midnight',   hue: 215 },
};

function applyTheme(name) {
  if (!OS_THEMES[name]) name = 'emo-dark';
  document.documentElement.dataset.theme = name;
  localStorage.setItem('os-theme', name);
  document.querySelectorAll('.skin-btn').forEach(b => {
    b.classList.toggle('skin-active', b.dataset.theme === name);
  });
  const hue = OS_THEMES[name].hue;
  ['bear-logo','bear-logo2'].forEach(id => drawBear(id, hue));
}

function loadTheme() {
  applyTheme(localStorage.getItem('os-theme') || 'emo-dark');
}

// ---- STARS ----
function initStars(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  for (let i = 0; i < 110; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2.4 + 0.4;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}vw;top:${Math.random()*100}vh;animation-duration:${(Math.random()*3+1.5).toFixed(1)}s;animation-delay:${(Math.random()*4).toFixed(1)}s`;
    c.appendChild(s);
  }
}

// ---- CURSOR + SPARKLES ----
function initCursor() {
  const cur = document.getElementById('cursor');
  if (!cur) return;
  document.addEventListener('mousemove', e => {
    cur.style.left = e.clientX + 'px';
    cur.style.top  = e.clientY + 'px';
  });
  document.addEventListener('mousemove', e => {
    if (Math.random() > 0.4) return;
    const s  = document.createElement('div');
    s.className = 'sparkle';
    const sz = Math.random() * 6 + 3;
    const cs = getComputedStyle(document.documentElement);
    const c  = Math.random() > 0.5
      ? cs.getPropertyValue('--accent').trim()
      : cs.getPropertyValue('--accent2').trim();
    s.style.cssText = `width:${sz}px;height:${sz}px;background:${c}99;box-shadow:0 0 4px ${c}66;left:${e.clientX-sz/2}px;top:${e.clientY-sz/2}px;--tx:${((Math.random()-.5)*55).toFixed(0)}px;--ty:${((Math.random()-.5)*55).toFixed(0)}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 700);
  });
}

// ---- PIXEL BEAR (8×8 @ S=6 → 48×48) ----
function drawBear(id, hue) {
  const c = document.getElementById(id);
  if (!c) return;
  const ctx = c.getContext('2d');
  const h = hue ?? 280, S = 6;
  const B = `hsl(${h},55%,38%)`, D = `hsl(${h},55%,24%)`, L = `hsl(${h},35%,60%)`;
  const map = [
    [0,0,B,B,0,B,B,0],
    [0,B,D,B,B,D,B,0],
    [0,B,B,B,B,B,B,0],
    [B,B,'#111',B,B,'#111',B,B],
    [B,B,B,'#b05030','#b05030',B,B,B],
    [B,B,B,L,L,B,B,B],
    [0,B,B,B,B,B,B,0],
    [0,0,B,0,0,B,0,0],
  ];
  ctx.clearRect(0,0,48,48);
  map.forEach((row,y) => row.forEach((col,x) => {
    if (!col) return;
    ctx.fillStyle = col; ctx.fillRect(x*S, y*S, S, S);
  }));
}

// ---- TAB EASTER EGG ----
function initTabTitle(normal) {
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? '🐻 reviens... on s\'ennuie' : normal;
  });
}

// ---- SKINZ PANEL ----
function initSkinz() {
  const panel = document.getElementById('skinz-panel');
  const toggle = document.getElementById('skinz-toggle');
  if (!panel || !toggle) return;
  toggle.addEventListener('click', () => panel.classList.toggle('open'));
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      panel.classList.remove('open');
    });
  });
}

// ---- AUTO-INIT on DOMContentLoaded ----
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initStars('stars');
  initCursor();
  initSkinz();
  const titleEl = document.querySelector('title');
  if (titleEl) initTabTitle(titleEl.textContent);
});
