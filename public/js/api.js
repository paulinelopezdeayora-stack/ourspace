// ===== OURSPACE API CLIENT =====
// Toutes les fonctions retournent { data, error }

const api = (() => {
  async function req(method, url, body) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      const json = await r.json();
      if (!r.ok) return { error: json.error || 'Erreur inconnue' };
      return { data: json };
    } catch (e) {
      return { error: 'Impossible de contacter le serveur' };
    }
  }

  return {
    // Auth
    register:   (body) => req('POST', '/api/auth/register', body),
    login:      (body) => req('POST', '/api/auth/login', body),
    logout:     ()     => req('POST', '/api/auth/logout'),
    me:         ()     => req('GET',  '/api/auth/me'),

    // Profils
    getProfile:    (username) => req('GET',    `/api/profiles/${username}`),
    updateProfile: (body)     => req('PUT',    '/api/profiles/me', body),
    deleteAudio:   ()         => req('DELETE', '/api/profiles/me/audio'),

    // Commentaires
    getComments:   (username) => req('GET',    `/api/comments/${username}`),
    postComment:   (username, content) => req('POST', `/api/comments/${username}`, { content }),
    deleteComment: (id)       => req('DELETE', `/api/comments/${id}`),

    // Amis
    getMyFriends:  ()         => req('GET',  '/api/friends/me'),
    getRequests:   ()         => req('GET',  '/api/friends/requests'),
    sendRequest:   (username) => req('POST', `/api/friends/request/${username}`),
    acceptFriend:  (username) => req('POST', `/api/friends/accept/${username}`),
    removeFriend:  (username) => req('DELETE', `/api/friends/${username}`),
    updateTop8:    (order)    => req('PUT',  '/api/friends/top8', { order }),

    // Découvrir
    discover: (q, page) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (page) params.set('page', page);
      return req('GET', `/api/discover?${params}`);
    },
  };
})();

// Redirige vers login si non connecté (à appeler sur les pages protégées)
async function requireLogin() {
  const { data, error } = await api.me();
  if (error) {
    window.location.href = '/login.html';
    return null;
  }
  return data;
}

// Formate une date relative ("il y a 3 min", "14 mars 2026")
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)   return 'à l\'instant';
  if (min < 60)  return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7)  return `il y a ${days}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Affiche un toast (message temporaire en bas de page)
function toast(msg, type = 'info') {
  const colors = { info: '#6600cc', success: '#00aa44', error: '#cc2200' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
    background:${colors[type] || colors.info}; color:#fff;
    padding:10px 22px; border-radius:4px; font-family:'Comic Sans MS',cursive;
    font-size:13px; z-index:99999; box-shadow:0 0 16px ${colors[type]};
    animation:toastIn .3s ease; pointer-events:none;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
