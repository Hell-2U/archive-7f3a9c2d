/* Invitation-link gate for casual discovery. Published assets are not encrypted. */
(() => {
  'use strict';
  const EXPECTED_KEY_HASH = '74805910aee5f12aa61e49b50806cf6b50c939c33f6216963b3f6ac206e24199';
  const screen = document.querySelector('#access-screen');
  const header = document.querySelector('.site-header');
  const page = document.querySelector('main.page');
  let bootPromise;
  let generation = 0;

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('load-failed')); };
      document.head.append(script);
    });
  }
  function boot() {
    if (!bootPromise) {
      bootPromise = loadScript('data/achievements-data.js').then(() => loadScript('app.js'));
      bootPromise.catch(() => { bootPromise = null; });
    }
    return bootPromise;
  }
  async function openInvitation() {
    const current = ++generation;
    page.hidden = true;
    header.hidden = true;
    document.body.classList.add('access-locked');
    document.title = 'ошибка: 0012';
    screen.hidden = false;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    const key = new URLSearchParams(location.hash.slice(1)).get('key');
    if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return;
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (current !== generation) return;
      if (hash !== EXPECTED_KEY_HASH) {
        return;
      }
      await boot();
      if (current !== generation) return;
      document.querySelector('.brand').href = location.pathname + location.search + location.hash;
      screen.hidden = true;
      header.hidden = false;
      document.body.classList.remove('access-locked');
      document.title = document.querySelector('#page-title').textContent;
      page.hidden = false;
    } catch {
      if (current !== generation) return;
    }
  }
  addEventListener('hashchange', openInvitation);
  openInvitation();
})();
