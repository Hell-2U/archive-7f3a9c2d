/* All rendering uses textContent: imported records are data, never HTML. */
const STORAGE_KEY = 'party-achievements:collection:v1';
const MAX_RECORDS = 20000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const $ = (selector) => document.querySelector(selector);
const SITE_TEXT_FIELDS = [
  {section:'Шапка',key:'brandFirst',label:'Название — серая часть',value:'Геройство',selector:'.brand-muted'},
  {section:'Шапка',key:'brandSecond',label:'Название — выделенная часть',value:', как оно есть',selector:'.brand strong'},
  {section:'Шапка',key:'headerLabel',label:'Подпись справа в шапке',value:'НАШИ ПРИКЛЮЧЕНИЯ В D&D',selector:'.header-label',optional:true},
  {section:'Вступление',key:'eyebrow',label:'Надпись над главным заголовком',value:'КОЛЛЕКЦИЯ ВОСПОМИНАНИЙ',selector:'.intro-copy .eyebrow',optional:true},
  {section:'Вступление',key:'pageTitle',label:'Главный заголовок и название вкладки браузера',value:'Достижения группы',selector:'#page-title'},
  {section:'Вступление',key:'description',label:'Описание под заголовком',value:'Памятные моменты наших приключений.',selector:'#page-description',optional:true,multiline:true},
  {section:'Вкладки',key:'tabAll',label:'Вкладка всех ачивок',value:'Все ачивки',selector:'[data-style="all"] .tab-label'},
  {section:'Вкладки',key:'tabOld',label:'Вкладка старого стиля',value:'Старый стиль',selector:'[data-style="old"] .tab-label'},
  {section:'Вкладки',key:'tabNew',label:'Вкладка нового стиля',value:'Новый стиль',selector:'[data-style="new"] .tab-label'},
  {section:'Список и поиск',key:'search',label:'Подсказка в поиске',value:'Найти достижение…',selector:'#search',attribute:'placeholder'},
  {section:'Список и поиск',key:'sortLabel',label:'Название сортировки',value:'Сортировка',selector:'.sort-wrap .sr-only'},
  {section:'Список и поиск',key:'sortFirst',label:'Сортировка от первых партий',value:'С первых партий',selector:'#sort option[value="original"]'},
  {section:'Список и поиск',key:'sortLast',label:'Сортировка от последних партий',value:'С последних партий',selector:'#sort option[value="reverse"]'},
  {section:'Список и поиск',key:'collectionLabel',label:'Подпись над списком справа',value:'Коллекция группы',selector:'#source-label',optional:true},
  {section:'Список и поиск',key:'unnamedParty',label:'Партия без названия',value:'Партия без названия'},
  {section:'Счётчики',key:'one',label:'Название для одной ачивки',value:'достижение'},
  {section:'Счётчики',key:'few',label:'Название для двух–четырёх ачивок',value:'достижения'},
  {section:'Счётчики',key:'many',label:'Название для пяти и более ачивок',value:'достижений'},
  {section:'Счётчики',key:'totalSuffix',label:'После счётчика в верхнем блоке',value:'в коллекции',optional:true},
  {section:'Счётчики',key:'found',label:'Перед числом результатов поиска',value:'Найдено'},
  {section:'Счётчики',key:'of',label:'Между числами «1 из 10»',value:'из'},
  {section:'Окно ачивки',key:'detailLabel',label:'Подпись для ачивки без названия партии',value:'ДОСТИЖЕНИЕ ГРУППЫ'},
  {section:'Окно ачивки',key:'previous',label:'Кнопка предыдущей ачивки',value:'← Предыдущее',selector:'#previous'},
  {section:'Окно ачивки',key:'next',label:'Кнопка следующей ачивки',value:'Следующее →',selector:'#next'},
  {section:'Окно ачивки',key:'close',label:'Подсказка закрытия окна',value:'Закрыть',selector:'[data-close]',attribute:'aria-label'},
  {section:'Окно ачивки',key:'gifHint',label:'Подсказка значка молнии',value:'При открытии проигрывается GIF'},
  {section:'Окно ачивки',key:'missingImage',label:'Подпись отсутствующей картинки',value:'Иллюстрация пока не добавлена'},
  {section:'Пустые разделы',key:'emptyCollection',label:'Заголовок пустой коллекции',value:'Коллекция пока пуста'},
  {section:'Пустые разделы',key:'emptyCollectionHint',label:'Описание пустой коллекции',value:'Загрузи достижения через меню «Данные».',multiline:true},
  {section:'Пустые разделы',key:'noResults',label:'Заголовок при пустом поиске',value:'Ничего не нашлось'},
  {section:'Пустые разделы',key:'noResultsHint',label:'Подсказка при пустом поиске',value:'Попробуй другое название или слово из описания.',multiline:true},
  {section:'Пустые разделы',key:'emptyNew',label:'Заголовок пустого нового стиля',value:'Ачивки нового стиля скоро появятся'},
  {section:'Пустые разделы',key:'emptyOld',label:'Заголовок пустого старого стиля',value:'В этом разделе пока нет ачивок'},
  {section:'Пустые разделы',key:'emptyStyleHint',label:'Описание пустого раздела стиля',value:'Здесь будут достижения выбранного стиля.',multiline:true},
  {section:'Пустые разделы',key:'clearSearch',label:'Кнопка очистки поиска',value:'Сбросить поиск',selector:'#clear-search'},
  {section:'Подвал',key:'footerFirst',label:'Левая подпись внизу страницы',value:'Истории, которые стоит помнить.',selector:'.site-footer span:first-child',optional:true},
  {section:'Подвал',key:'footerSecond',label:'Правая подпись внизу страницы',value:'DUNGEONS & DRAGONS',selector:'.site-footer span:last-child',optional:true},
  {section:'Меню данных',key:'dataButton',label:'Кнопка открытия меню',value:'Данные',selector:'#open-data span'},
  {section:'Меню данных',key:'dataEyebrow',label:'Надпись над заголовком меню',value:'ТВОЯ КОЛЛЕКЦИЯ',selector:'#data-dialog .eyebrow',optional:true},
  {section:'Меню данных',key:'dataTitle',label:'Заголовок меню данных',value:'Данные достижений',selector:'#data-title'},
  {section:'Меню данных',key:'dataDescription',label:'Описание меню данных',value:'Можно сохранить коллекцию или загрузить другой набор, чтобы попробовать его с этим оформлением.',selector:'#data-intro',optional:true,multiline:true},
  {section:'Меню данных',key:'exportData',label:'Кнопка скачивания данных',value:'Скачать JSON',selector:'#export-data'},
  {section:'Меню данных',key:'importData',label:'Кнопка загрузки данных',value:'Загрузить JSON',selector:'.import-label .import-text'},
  {section:'Меню данных',key:'resetData',label:'Кнопка возврата к исходным данным',value:'Вернуться к исходной коллекции',selector:'#reset-data'},
  {section:'Меню данных',key:'dataNote',label:'Подсказка об импорте',value:'Загрузка меняет коллекцию только в этом браузере. Для общего сайта изменения нужно опубликовать отдельно.',selector:'#data-import-note',optional:true,multiline:true},
  {section:'Меню данных',key:'imageNote',label:'Подсказка об изображениях',value:'Картинки указываются ссылками или путями внутри сайта. Сам JSON не содержит файлы изображений.',selector:'#data-image-note',optional:true,multiline:true},
  {section:'Меню данных',key:'exported',label:'Сообщение после скачивания данных',value:'Коллекция сохранена в JSON'},
];
function validateSiteText(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Проверь тексты сайта.');
  const result = {};
  for (const field of SITE_TEXT_FIELDS) {
    if (value[field.key] === undefined) continue;
    const text = value[field.key];
    if (typeof text !== 'string' || text.length > 5000 || (!field.optional && !text.trim())) {
      throw new Error(`Проверь поле «${field.label}» в текстах сайта.`);
    }
    result[field.key] = text;
  }
  return result;
}
function siteTexts() {
  return {...Object.fromEntries(SITE_TEXT_FIELDS.map(field => [field.key, field.value])), ...collection.siteText};
}
function applySiteTexts(texts) {
  for (const field of SITE_TEXT_FIELDS) {
    if (!field.selector) continue;
    for (const node of document.querySelectorAll(field.selector)) {
      if (field.attribute) node.setAttribute(field.attribute, texts[field.key]);
      else node.textContent = texts[field.key];
      if (field.optional) node.hidden = !texts[field.key].trim();
    }
  }
  $('.brand').setAttribute('aria-label', texts.brandFirst + texts.brandSecond);
  $('#search').setAttribute('aria-label', texts.search);
}
const originalData = validateCollection(window.ACHIEVEMENT_DATA);
let publishedData = originalData;
let collection = originalData;
let localImportActive = false;
let refreshInProgress = false;
let visibleRecords = [];
let selectedId = null;
let toastTimer;
let activeStyle = 'all';

function validateCollection(value) {
  const siteText = validateSiteText(value?.siteText);
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
    if (record.detailImage && !safeImage(record.detailImage)) throw new Error(`Проверь ссылку на полноразмерную картинку у записи № ${index + 1}.`);
    if (record.detailKind === 'gif' && (!record.image || !record.detailImage || /\.gif(?:[?#]|$)/i.test(record.image))) {
      throw new Error(`Для GIF-ачивки № ${index + 1} нужны статичная иконка и GIF-анимация.`);
    }
    return {...record, artStyle: record.artStyle === 'new' ? 'new' : 'old', id, title: record.title.trim(), description: record.description || '', image: record.image || '', imageRendering: record.imageRendering === 'pixelated' ? 'pixelated' : 'auto'};
  });
  return PartyCollection.normalize({...value, ...(siteText ? {siteText} : {}), version: 1, title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Наши ачивки', description: typeof value.description === 'string' ? value.description : 'Приколбасные моменты с партий', source: typeof value.source === 'string' ? value.source : '', achievements});
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
  const texts = siteTexts();
  return last === 1 && lastTwo !== 11 ? texts.one : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? texts.few : texts.many;
}
function normalize(text) { return text.toLocaleLowerCase('ru').replaceAll('ё', 'е'); }
function svgIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`); svg.append(use); return svg;
}
function fallbackImage() { const el = document.createElement('span'); el.className = 'image-fallback'; el.title = siteTexts().missingImage; el.setAttribute('role', 'img'); el.setAttribute('aria-label', siteTexts().missingImage); el.append(svgIcon('image')); return el; }
function imageFor(record, {large = false, eager = false} = {}) {
  const path = large ? record.detailImage || record.image : record.image || record.detailImage;
  if (!path) return fallbackImage();
  const img = document.createElement('img');
  img.src = window.ACHIEVEMENT_IMAGE_OVERRIDES?.get(path) || path; img.alt = large ? record.title : '';
  img.loading = eager || large ? 'eager' : 'lazy'; img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  if (record.imageRendering === 'pixelated') img.className = 'pixelated';
  img.addEventListener('error', () => img.replaceWith(fallbackImage()), {once: true});
  return img;
}
function restoreCollection() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { collection = validateCollection(JSON.parse(saved)); localImportActive = true; $('#reset-data').hidden = false; }
  } catch { collection = originalData; }
}
async function refreshPublishedCollection() {
  if (window.ACHIEVEMENT_EDITOR_MODE || localImportActive || refreshInProgress || location.protocol === 'file:') return;
  refreshInProgress = true;
  try {
    const response = await fetch('data/achievements.json?v=' + Date.now(), {cache:'no-store'});
    if (!response.ok) return;
    const latest = validateCollection(await response.json());
    if (localImportActive || JSON.stringify(latest) === JSON.stringify(publishedData)) return;
    publishedData = latest;
    collection = latest;
    render();
    if ($('#detail-dialog').open) {
      if (visibleRecords.some(record => record.id === selectedId)) openDetail(selectedId);
      else $('#detail-dialog').close();
    }
  } catch {
    // Keep the loaded collection when offline. The next focus retries the request.
  } finally {
    refreshInProgress = false;
  }
}
function setCollection(next) {
  collection = next; if(!window.ACHIEVEMENT_EDITOR_MODE){$('#search').value = ''; $('#sort').value = 'original';}
  render();
}
function render() {
  const texts = siteTexts();
  applySiteTexts(texts);
  document.title = texts.pageTitle;
  const availableGroups = PartyCollection.groups(collection, $('#sort').value === 'reverse')
    .filter(group => window.ACHIEVEMENT_EDITOR_MODE || group.hidden !== true);
  const availableRecords = availableGroups.flatMap(group => group.records);
  const total = availableRecords.length;
  $('#total-count').textContent = total;
  $('#total-label').textContent = [plural(total), texts.totalSuffix].filter(Boolean).join(' ');
  $('#tab-count').textContent = total;
  $('#old-style-count').textContent = availableRecords.filter(a=>a.artStyle!=='new').length;
  $('#new-style-count').textContent = availableRecords.filter(a=>a.artStyle==='new').length;
  const styleTotal=availableRecords.filter(a=>activeStyle==='all'||a.artStyle===activeStyle).length;
  const query = normalize($('#search').value.trim());
  const terms = query.split(/\s+/).filter(Boolean);
  const groups = availableGroups.map(group=>({...group,records:group.records.filter(record=>{
    const haystack=normalize(`${record.title} ${record.description} ${group.title} ${(record.tags||[]).join(' ')}`);
    return (activeStyle==='all'||record.artStyle===activeStyle)&&terms.every(term=>haystack.includes(term));
  })})).filter(group=>(!query&&(activeStyle==='all'||group.artStyle===activeStyle))||group.records.length);
  visibleRecords = groups.flatMap(group=>group.records);
  $('#result-count').textContent = query ? `${texts.found} ${visibleRecords.length} ${texts.of} ${styleTotal}` : `${styleTotal} ${plural(styleTotal)}`;
  $('#empty-state').hidden = visibleRecords.length > 0;
  $('#empty-state h2').textContent = total === 0 ? texts.emptyCollection : texts.noResults;
  $('#empty-state p').textContent = total === 0 ? texts.emptyCollectionHint : texts.noResultsHint;
  $('#clear-search').hidden = total === 0;
  if(styleTotal===0&&activeStyle!=='all'){
    $('#empty-state h2').textContent=activeStyle==='new'?texts.emptyNew:texts.emptyOld;
    $('#empty-state p').textContent=texts.emptyStyleHint;
    $('#clear-search').hidden=true;
  }
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const group of groups) {
    const section = document.createElement('section'); section.className='party-section'; section.dataset.partyId=group.id;
    if (group.hidden === true) section.classList.add('party-hidden');
    if (group.title || window.ACHIEVEMENT_EDITOR_MODE) {
      const heading = document.createElement('h2'); heading.className = 'campaign-heading'; heading.textContent = group.title || texts.unnamedParty; section.append(heading);
    }
    for (const record of group.records) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'achievement-row';
    button.setAttribute('aria-haspopup', 'dialog');
    button.dataset.achievementId = record.id;
    const thumb = document.createElement('span'); thumb.className = 'achievement-thumb'; thumb.append(imageFor(record, {eager: index < 7}));
    if (record.detailKind === 'gif') {
      const badge = document.createElement('span');
      badge.className = 'achievement-gif-badge';
      badge.setAttribute('role', 'img');
      badge.setAttribute('aria-label', texts.gifHint);
      badge.title = texts.gifHint;
      badge.append(svgIcon('bolt'));
      thumb.append(badge);
    }
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
  $('#detail-dialog .eyebrow').textContent = record.campaign || siteTexts().detailLabel;
  $('#detail-description').textContent = record.description;
  $('#detail-art').replaceChildren(imageFor(record, {large: true}));
  $('#detail-position').textContent = `${index + 1} ${siteTexts().of} ${visibleRecords.length}`;
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
document.querySelectorAll('[data-style]').forEach(tab=>tab.addEventListener('click',()=>{
  activeStyle=tab.dataset.style;
  document.querySelectorAll('[data-style]').forEach(item=>{item.setAttribute('aria-selected',String(item===tab));item.classList.toggle('current-section',item===tab);});
  render();
}));
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
  setTimeout(() => URL.revokeObjectURL(url), 1500); toast(siteTexts().exported);
});
$('#import-data').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const status = $('#import-status'); status.classList.remove('error');
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Выбери JSON размером до 10 МБ.');
    const next = validateCollection(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
    localImportActive = true;
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
  localImportActive = false;
  setCollection(publishedData); $('#reset-data').hidden = true;
  $('#import-status').classList.remove('error'); $('#import-status').textContent = 'Восстановлена исходная коллекция.';
});
addEventListener('focus', refreshPublishedCollection);
addEventListener('pageshow', event => { if (event.persisted) refreshPublishedCollection(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPublishedCollection();
});
window.achievementArchive = {
  getCollection:()=>structuredClone(collection),
  setCollection:(next)=>{collection=validateCollection(next);render();},
  validate:validateCollection,
  redraw:render,
  textFields:SITE_TEXT_FIELDS,
  getTexts:siteTexts,
};
if (!window.ACHIEVEMENT_EDITOR_MODE) restoreCollection();
render();
