/* All rendering uses textContent: imported records are data, never HTML. */
const STORAGE_KEY = 'party-achievements:collection:v1';
const MAX_RECORDS = 20000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const $ = (selector) => document.querySelector(selector);
const originalData = validateCollection(window.ACHIEVEMENT_DATA);
let collection = originalData;
let visibleRecords = [];
let selectedId = null;
let toastTimer;

function validateCollection(value) {
  if (!value || !Array.isArray(value.achievements)) throw new Error('В файле нужен список achievements.');
  if (value.achievements.length > MAX_RECORDS) throw new Error('В одном наборе может быть до 20 000 достижений.');
  if (value.version !== undefined && value.version !== 1) throw new Error('Эта версия формата пока не поддерживается.');
  const ids = new Set();
  const achievements = value.achievements.map((record, index) => {
    if (!record || typeof record.title !== 'string' || !record.title.trim()) throw new Error(`У записи № ${index + 1} нет названия.`);
    if (record.description !== undefined && typeof record.description !== 'string') throw new Error(`Описание записи № ${index + 1} должно быть текстом.`);
    if (record.tags !== undefined && (!Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string'))) throw new Error(`Теги записи № ${index + 1} должны быть списком строк.`);
    if (record.campaign !== undefined && typeof record.campaign !== 'string') throw new Error(`Название приключения записи № ${index + 1} должно быть текстом.`);
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `achievement-${index + 1}`;
    if (ids.has(id)) throw new Error(`Повторяется идентификатор «${id}».`);
    ids.add(id);
    if (record.image && !safeImage(record.image)) throw new Error(`Проверь ссылку на картинку у записи № ${index + 1}. Нужна HTTPS-ссылка или путь внутри сайта.`);
    return {...record, id, title: record.title.trim(), description: record.description || '', image: record.image || '', imageRendering: record.imageRendering === 'pixelated' ? 'pixelated' : 'auto'};
  });
  return PartyCollection.normalize({...value, version: 1, title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Наши ачивки', description: typeof value.description === 'string' ? value.description : 'Приколбасные моменты с партий', source: typeof value.source === 'string' ? value.source : '', achievements});
}

function safeImage(path) {
  if (typeof path !== 'string' || !path.trim() || /[\u0000-\u0020\\]/u.test(path)) return false;
  if (/^https:\/\//i.test(path)) {
    try { const url = new URL(path); return Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
  }
  return !/^[a-z][a-z\d+.-]*:/i.test(path) && !path.startsWith('//');
}

function plural(number) {
  const last = number % 10, lastTwo = number % 100;
  return last === 1 && lastTwo !== 11 ? 'достижение' : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'достижения' : 'достижений';
}
function normalize(text) { return text.toLocaleLowerCase('ru').replaceAll('ё', 'е'); }
function svgIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`); svg.append(use); return svg;
}
function fallbackImage() { const el = document.createElement('span'); el.className = 'image-fallback'; el.title = 'Иллюстрация пока не добавлена'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Иллюстрация пока не добавлена'); el.append(svgIcon('image')); return el; }
function imageFor(record, {large = false, eager = false} = {}) {
  if (!record.image) return fallbackImage();
  const img = document.createElement('img');
  img.src = window.ACHIEVEMENT_IMAGE_OVERRIDES?.get(record.image) || record.image; img.alt = large ? record.title : '';
  img.loading = eager || large ? 'eager' : 'lazy'; img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  if (record.imageRendering === 'pixelated') img.className = 'pixelated';
  img.addEventListener('error', () => img.replaceWith(fallbackImage()), {once: true});
  return img;
}
function restoreCollection() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { collection = validateCollection(JSON.parse(saved)); $('#reset-data').hidden = false; }
  } catch { collection = originalData; }
}
function setCollection(next) {
  collection = next; $('#search').value = ''; $('#sort').value = 'original';
  render();
}
function render() {
  document.title = collection.title;
  $('#page-title').textContent = collection.title;
  $('#page-description').textContent = collection.description;
  const total = collection.achievements.length;
  $('#total-count').textContent = total;
  $('#total-label').textContent = `${plural(total)} в коллекции`;
  $('#tab-count').textContent = total;
  const query = normalize($('#search').value.trim());
  const terms = query.split(/\s+/).filter(Boolean);
  const sort = $('#sort').value;
  const groups = PartyCollection.groups(collection,sort === 'reverse').map(group=>({...group,records:group.records.filter(record=>{
    const haystack=normalize(`${record.title} ${record.description} ${group.title} ${(record.tags||[]).join(' ')}`);
    return terms.every(term=>haystack.includes(term));
  })})).filter(group=>!query||group.records.length);
  visibleRecords = groups.flatMap(group=>group.records);
  $('#result-count').textContent = query ? `Найдено ${visibleRecords.length} из ${total}` : `${total} ${plural(total)}`;
  $('#empty-state').hidden = visibleRecords.length > 0;
  $('#empty-state h2').textContent = total === 0 ? 'Коллекция пока пуста' : 'Ничего не нашлось';
  $('#empty-state p').textContent = total === 0 ? 'Загрузи достижения через меню «Данные».' : 'Попробуй другое название или слово из описания.';
  $('#clear-search').hidden = total === 0;
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const group of groups) {
    const section = document.createElement('section'); section.className='party-section'; section.dataset.partyId=group.id;
    if (group.title || window.ACHIEVEMENT_EDITOR_MODE) {
      const heading = document.createElement('h2'); heading.className = 'campaign-heading'; heading.textContent = group.title || 'Партия без названия'; section.append(heading);
    }
    for (const record of group.records) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'achievement-row';
    button.setAttribute('aria-haspopup', 'dialog');
    button.dataset.achievementId = record.id;
    const thumb = document.createElement('span'); thumb.className = 'achievement-thumb'; thumb.append(imageFor(record, {eager: index < 7}));
    const content = document.createElement('span'); content.className = 'achievement-content';
    const title = document.createElement('span'); title.className = 'achievement-title'; title.setAttribute('role', 'heading'); title.setAttribute('aria-level', '2'); title.textContent = record.title;
    const description = document.createElement('span'); description.className = 'achievement-description'; description.textContent = record.description;
    content.append(title, description);
    const end = document.createElement('span'); end.className = 'row-end'; end.append(svgIcon('arrow'));
    button.append(thumb, content, end); button.addEventListener('click', () => openDetail(record.id)); section.append(button); index++;
    }
    fragment.append(section);
  }
  $('#achievement-list').replaceChildren(fragment);
  document.dispatchEvent(new CustomEvent('achievements:rendered'));
}
function openDetail(id) {
  const record = visibleRecords.find(item => item.id === id);
  if (!record) return;
  selectedId = id;
  const index = visibleRecords.indexOf(record);
  $('#detail-title').textContent = record.title;
  $('#detail-dialog .eyebrow').textContent = record.campaign || 'ДОСТИЖЕНИЕ ГРУППЫ';
  $('#detail-description').textContent = record.description;
  $('#detail-art').replaceChildren(imageFor(record, {large: true}));
  $('#detail-position').textContent = `${index + 1} из ${visibleRecords.length}`;
  $('#previous').disabled = index === 0;
  $('#next').disabled = index === visibleRecords.length - 1;
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function moveDetail(step) {
  const index = visibleRecords.findIndex(record => record.id === selectedId);
  if (visibleRecords[index + step]) openDetail(visibleRecords[index + step].id);
}
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
$('#search').addEventListener('input', render);
$('#sort').addEventListener('change', render);
$('#clear-search').addEventListener('click', () => { $('#search').value = ''; render(); $('#search').focus(); });
$('#open-data').addEventListener('click', () => $('#data-dialog').showModal());
$('#previous').addEventListener('click', () => moveDetail(-1));
$('#next').addEventListener('click', () => moveDetail(1));
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}
document.addEventListener('keydown', event => {
  const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (event.key === '/' && !editing && !document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); }
  if ($('#detail-dialog').open && !editing) {
    if (event.key === 'ArrowRight') { event.preventDefault(); moveDetail(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveDetail(-1); }
  }
});
$('#export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(collection, null, 2) + '\n'], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'achievements.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500); toast('Коллекция сохранена в JSON');
});
$('#import-data').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const status = $('#import-status'); status.classList.remove('error');
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Выбери JSON размером до 10 МБ.');
    const next = validateCollection(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
    let saved = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { saved = false; }
    setCollection(next); $('#reset-data').hidden = false;
    status.textContent = `Загружено: ${next.achievements.length}. ${saved ? 'Коллекция сохранена в этом браузере.' : 'Коллекция доступна до перезагрузки: браузер не смог сохранить данные.'}`;
  } catch (error) {
    status.classList.add('error'); status.textContent = error instanceof SyntaxError ? 'Не удалось прочитать JSON. Проверь формат файла.' : error.message;
  }
  event.target.value = '';
});
$('#reset-data').addEventListener('click', () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  setCollection(originalData); $('#reset-data').hidden = true;
  $('#import-status').classList.remove('error'); $('#import-status').textContent = 'Восстановлена исходная коллекция.';
});
window.achievementArchive = {
  getCollection:()=>structuredClone(collection),
  setCollection:(next)=>{collection=validateCollection(next);render();},
  validate:validateCollection,
  redraw:render,
};
if (!window.ACHIEVEMENT_EDITOR_MODE) restoreCollection();
render();
