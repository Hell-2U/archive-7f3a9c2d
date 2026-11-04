/* Invitation-link gate for casual discovery. Published assets are not encrypted. */
(() => {
  'use strict';
  const EXPECTED_KEY_HASH = '74805910aee5f12aa61e49b50806cf6b50c939c33f6216963b3f6ac206e24199';
  const screen = document.querySelector('#access-screen');
  const message = document.querySelector('#access-message');
  const title = document.querySelector('#access-title');
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
    screen.hidden = false;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    const key = new URLSearchParams(location.hash.slice(1)).get('key');
    title.textContent = 'Коллекция по приглашению';
    message.textContent = 'Открой полную ссылку, которой поделились с тобой.';
    if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return;
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (current !== generation) return;
      if (hash !== EXPECTED_KEY_HASH) {
        title.textContent = 'Ссылка не подошла';
        message.textContent = 'Проверь, что ссылка скопирована целиком, или попроси новое приглашение.';
        return;
      }
      message.textContent = 'Открываем коллекцию…';
      await boot();
      if (current !== generation) return;
      document.querySelector('.brand').href = location.pathname + location.search + location.hash;
      screen.hidden = true;
      page.hidden = false;
    } catch {
      if (current !== generation) return;
      title.textContent = 'Не удалось открыть коллекцию';
      message.textContent = 'Обнови страницу и попробуй ещё раз. Если это локальная копия, открой её через локальный сервер.';
    }
  }
  addEventListener('hashchange', openInvitation);
  openInvitation();
})();
