/* Owner-only UI. The link enables editing; GitHub separately authorizes publishing. */
(async()=>{
  'use strict';
  if(!window.ACHIEVEMENT_EDITOR_MODE)return;
  const api=window.achievementArchive;
  const IMAGE_TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'};
  const IMAGE_EXTENSIONS=/\.(png|jpe?g|webp|avif)$/i;
  const imagePaths=collection=>new Set(collection.achievements.flatMap(a=>[a.image,a.detailImage]).filter(Boolean));
  const DB_NAME='party-achievements-editor-v1';
  const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;};
  const uuid=()=>crypto.randomUUID();
  let state={collection:api.getCollection(),baselineCollection:api.getCollection(),images:[],baseSha:null,dirty:false};
  let publishedSeed=api.getCollection(),publishedSha=null;
  let busy=false;
  const overrides=new Map();window.ACHIEVEMENT_IMAGE_OVERRIDES=overrides;
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}).catch(()=>null);
  async function readDraft(){if(!db)return null;return new Promise(resolve=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);});}
  async function saveDraft(){
    if(!db){setStatus('Черновик хранится только до закрытия страницы. Скачай резервную копию.',true);return;}
    await new Promise((resolve,reject)=>{const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(structuredClone(state),'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  }
  const strip=el('div',{class:'editor-strip'}),info=el('div');info.append(el('strong',{},'Редактор'),el('p',{id:'editor-save-status'},'Загружаем последнюю публикацию…'));
  const actions=el('div',{class:'editor-strip-actions'}),publishButton=el('button',{type:'button',class:'primary-button'},'Опубликовать'),backupButton=el('button',{type:'button',class:'secondary-button'},'Скачать черновик');
  const resetButton=el('button',{type:'button',class:'secondary-button'},'Отменить черновик');
  actions.append(backupButton,resetButton,publishButton);strip.append(info,actions);document.querySelector('main').prepend(strip);
  document.querySelector('#open-data').hidden=true;
  function setStatus(text,error=false){const label=document.querySelector('#editor-save-status');label.textContent=text;label.style.color=error?'#efb2aa':'';}
  function updatePreview(){const used=imagePaths(state.collection);for(const path of overrides.keys())if(!used.has(path))overrides.delete(path);state.images.forEach(image=>overrides.set(image.path,`data:${image.mime};base64,${image.base64}`));api.setCollection(state.collection);}
  async function change(collection){state.collection=api.validate(collection);state.dirty=true;updatePreview();try{await saveDraft();setStatus('Черновик сохранён в этом браузере');}catch{setStatus('Не удалось сохранить черновик. Скачай копию перед закрытием страницы.',true);}}
  function dialog(title){const node=el('dialog',{class:'editor-dialog'}),heading=el('h2',{},title),form=el('form',{class:'editor-form'}),close=el('button',{class:'close-button',type:'button','aria-label':'Закрыть'},'×');close.addEventListener('click',()=>node.close());node.append(close,heading,form);document.body.append(node);node.addEventListener('close',()=>node.remove());return {node,form};}
  function field(form,labelText,node){const label=el('label',{},labelText);label.append(node);form.append(label);return node;}
  function formFooter(form,node){const buttons=el('div',{class:'editor-form-actions'}),cancel=el('button',{type:'button',class:'secondary-button'},'Отмена'),save=el('button',{type:'submit',class:'primary-button'},'Сохранить в черновик');cancel.onclick=()=>node.close();buttons.append(cancel,save);form.append(buttons);return save;}
  function status(form){const label=el('p',{class:'editor-status',role:'status','aria-live':'polite'});form.append(label);return label;}
  function error(label,err){label.classList.add('error');label.textContent=err.message||'Не удалось сохранить изменение.';}
  function chooseImages(files) {
    const images=files.filter(file=>IMAGE_EXTENSIONS.test(file.name));
    if(!images.length)throw new Error('Выбери PNG, JPG, WebP или AVIF.');
    if(images.length===1)return {icon:images[0]};
    const stem=file=>file.name.replace(IMAGE_EXTENSIONS,'').toLowerCase();
    const pairs=[];
    for(const icon of images.filter(file=>stem(file).endsWith('-256'))){
      for(const detail of images.filter(file=>stem(file)===stem(icon).slice(0,-4))){
        pairs.push({icon,detail});
      }
    }
    if(pairs.length===1)return pairs[0];
    throw new Error(pairs.length
      ? 'В папке несколько пар. Выбери два файла одной ачивки.'
      : 'Не нашлась пара. У иконки должно быть то же имя, что у большой картинки, с добавлением «-256» перед расширением.');
  }
  async function filesFromEntry(entry) {
    if(entry.isFile)return [await new Promise((resolve,reject)=>entry.file(resolve,reject))];
    const reader=entry.createReader();
    const files=[];
    while(true){
      const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));
      if(!batch.length)return files;
      for(const child of batch)files.push(...await filesFromEntry(child));
    }
  }
  async function storeImage(file) {
    const extension=IMAGE_TYPES[file.type];
    if(!extension)throw new Error('Выбери PNG, JPG, WebP или AVIF.');
    if(file.size>10*1024*1024)throw new Error('Каждая картинка должна быть не больше 10 МБ.');
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('Не удалось прочитать картинку.'));
      reader.readAsDataURL(file);
    });
    return {path:`assets/achievements/user-${uuid()}.${extension}`,mime:file.type,base64:encoded.split(',')[1]};
  }
  const selectedStyle=()=>document.querySelector('[data-style][aria-selected="true"]')?.dataset.style||'all';
  function partyForm({afterId=null,afterPartyId=null,renameId=null}={}){
    const {node,form}=dialog(renameId?'Название партии':'Новая партия');
    const title=field(form,'Название',el('input',{required:'',maxlength:'200',autocomplete:'off'}));
    if(renameId)title.value=state.collection.parties.find(p=>p.id===renameId)?.title||'';
    if(afterId)form.append(el('p',{class:'editor-note'},'Если после этой ачивки в партии есть другие записи, они перейдут в новый раздел. Пустая новая партия появится в конце общего списка.'));
    const label=status(form);formFooter(form,node);
    form.addEventListener('submit',async event=>{event.preventDefault();if(!title.value.trim())return;try{const data=renameId?PartyCollection.renameParty(state.collection,renameId,title.value.trim()):PartyCollection.insertParty(state.collection,{id:'party-'+uuid(),title:title.value.trim(),afterId,afterPartyId,artStyle:selectedStyle()==='all'?null:selectedStyle()});await change(data);node.close();}catch(err){error(label,err);}});
    node.showModal();title.focus();
  }
  function achievementForm({afterId=null,partyId=null,editId=null}={}){
    const existing=state.collection.achievements.find(a=>a.id===editId);
    const anchor=state.collection.achievements.find(a=>a.id===afterId);
    const {node,form}=dialog(existing?'Изменить ачивку':'Новая ачивка');
    const title=field(form,'Название',el('input',{required:'',maxlength:'500',autocomplete:'off'}));title.value=existing?.title||'';
    const description=field(form,'Описание',el('textarea',{rows:'4',maxlength:'15000'}));description.value=existing?.description||'';
    const party=field(form,'Партия',el('select',{}));
    const artStyle=field(form,'Стиль ачивки',el('select',{}));artStyle.append(el('option',{value:'old'},'Старый стиль'),el('option',{value:'new'},'Новый стиль'));artStyle.value=existing?.artStyle||(selectedStyle()==='old'?'old':'new');
    const newPartyTitle=field(form,'Название новой партии',el('input',{maxlength:'200',autocomplete:'off'}));
    function fillParties(){party.replaceChildren();for(const item of state.collection.parties.filter(p=>p.artStyle===artStyle.value))party.append(el('option',{value:item.id},item.title||'Партия без названия'));party.append(el('option',{value:'__new__'},'+ Новая партия'));const preferred=existing?.partyId||partyId||anchor?.partyId;if([...party.options].some(o=>o.value===preferred))party.value=preferred;newPartyTitle.parentElement.hidden=party.value!=='__new__';newPartyTitle.required=party.value==='__new__';}
    party.onchange=()=>{newPartyTitle.parentElement.hidden=party.value!=='__new__';newPartyTitle.required=party.value==='__new__';};artStyle.onchange=fillParties;fillParties();
    const upload=el('div',{class:'editor-upload'});
    upload.append(el('p',{},'Перетащи сюда папку или файлы'));
    const file=field(upload,'Выбрать файлы',el('input',{type:'file',multiple:'',accept:'.png,.jpg,.jpeg,.webp,.avif'}));
    const folder=field(upload,'Выбрать папку',el('input',{type:'file',webkitdirectory:''}));
    const previews=el('div',{class:'editor-image-previews'}),uploadStatus=status(upload);
    form.append(upload,previews);
    let selectedImages=null,previewUrls=[],selectionVersion=0,readingFiles=false,selectionError=null;
    function showPreviews(){
      previewUrls.forEach(url=>URL.revokeObjectURL(url));
      previewUrls=[];
      previews.replaceChildren();
      const display=(caption,file,path)=>{
        if(!file&&!path)return;
        let src=overrides.get(path)||path;
        if(file){src=URL.createObjectURL(file);previewUrls.push(src);}
        const item=el('div');
        item.append(el('img',{class:'editor-preview',src,alt:caption}),el('span',{},caption));
        if(file)item.append(el('small',{},file.name));
        previews.append(item);
      };
      if(selectedImages){
        display(selectedImages.detail?'Иконка':'Иконка и просмотр',selectedImages.icon);
        display('При открытии',selectedImages.detail);
      }else{
        display(existing?.detailImage?'Иконка':'Иконка и просмотр',null,existing?.image);
        display('При открытии',null,existing?.detailImage);
      }
    }
    async function selectImages(getFiles){
      const version=++selectionVersion;
      readingFiles=true;
      selectionError=null;
      uploadStatus.classList.remove('error');
      uploadStatus.textContent='Читаем файлы…';
      try{
        const files=await getFiles();
        if(version!==selectionVersion)return;
        selectedImages=chooseImages(files);
        uploadStatus.textContent=selectedImages.detail?'Пара изображений готова':'Изображение готово';
        showPreviews();
      }catch(err){
        if(version!==selectionVersion)return;
        selectionError=err;
        error(uploadStatus,err);
      }finally{if(version===selectionVersion)readingFiles=false;}
    }
    for(const input of [file,folder])input.onchange=()=>{
      const files=Array.from(input.files);
      if(files.length)selectImages(()=>files);
      input.value='';
    };
    form.ondragover=event=>{
      if(!event.dataTransfer.types.includes('Files'))return;
      event.preventDefault();
      event.dataTransfer.dropEffect='copy';
      upload.classList.add('dragging');
    };
    form.ondragleave=event=>{if(!form.contains(event.relatedTarget))upload.classList.remove('dragging');};
    form.ondrop=event=>{
      if(!event.dataTransfer.types.includes('Files'))return;
      event.preventDefault();
      upload.classList.remove('dragging');
      const transfer=event.dataTransfer;
      const entries=Array.from(transfer.items).map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
      const files=Array.from(transfer.files);
      selectImages(async()=>entries.length?(await Promise.all(entries.map(filesFromEntry))).flat():files);
    };
    showPreviews();
    const pixel=field(form,'Показ изображения',el('select',{}));pixel.append(el('option',{value:'auto'},'Обычная иллюстрация'),el('option',{value:'pixelated'},'Пиксельный рисунок'));pixel.value=existing?.imageRendering||'auto';
    form.append(el('p',{class:'editor-note'},'PNG, JPG, WebP или AVIF, до 10 МБ на файл. Файл с «-256» в конце имени станет иконкой. Большая версия с тем же именем откроется по нажатию.'));
    const label=status(form),save=formFooter(form,node);
    node.addEventListener('close',()=>{selectionVersion++;previewUrls.forEach(url=>URL.revokeObjectURL(url));});
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
      if(readingFiles)throw new Error('Дождись загрузки списка файлов.');
      if(selectionError)throw selectionError;
      let image=existing?.image||'',detailImage=existing?.detailImage||'';
      const pending=[];
      const images=selectedImages;
      if(images){
        const icon=await storeImage(images.icon);
        pending.push(icon);
        image=icon.path;
        detailImage='';
        if(images.detail){
          const detail=await storeImage(images.detail);
          pending.push(detail);
          detailImage=detail.path;
        }
      }
      if(!node.open)return;
      let collection=state.collection,chosenParty=party.value;
      if(chosenParty==='__new__'){chosenParty='party-'+uuid();collection=PartyCollection.insertParty(collection,{id:chosenParty,title:newPartyTitle.value.trim(),afterPartyId:collection.parties.at(-1)?.id,artStyle:artStyle.value});}
      const record={...(existing||{}),id:existing?.id||'achievement-'+uuid(),title:title.value.trim(),description:description.value.trim(),artStyle:artStyle.value,image,partyId:chosenParty,imageRendering:pixel.value};
      if(detailImage)record.detailImage=detailImage;
      else if(existing?.detailImage)record.detailImage='';
      const next=PartyCollection.saveAchievement(collection,record,existing||anchor?.partyId!==chosenParty?null:afterId);
      const used=imagePaths(next);
      state.images=[...state.images,...pending].filter(item=>used.has(item.path));
      await change(next);node.close();
    }catch(err){error(label,err);}finally{save.disabled=false;}});
    node.showModal();title.focus();
  }
  function removeDraft(kind,id){
    const {node,form}=dialog(kind==='achievement'?'Удалить ачивку?':'Удалить разделитель партии?');
    form.append(el('p',{class:'editor-note'},kind==='achievement'?'Ачивка будет удалена из черновика. Общий сайт изменится после публикации.':'Ачивки сохранятся и перейдут в предыдущую партию. У первой партии будет убрано название.'));
    const save=formFooter(form,node);save.textContent='Удалить из черновика';
    form.onsubmit=async event=>{event.preventDefault();const next=structuredClone(state.collection);
      if(kind==='achievement')next.achievements=next.achievements.filter(a=>a.id!==id);
      else{const index=next.parties.findIndex(p=>p.id===id),previous=next.parties.slice(0,index).findLast(p=>p.artStyle===next.parties[index].artStyle);if(!previous){await change(PartyCollection.renameParty(next,id,''));node.close();return;}
        const old=next.parties[index];next.achievements.filter(a=>a.partyId===id).forEach(a=>{a.partyId=previous.id;a.tags=(a.tags||[]).filter(t=>t!==old.title);});next.parties.splice(index,1);}
      await change(next);node.close();};node.showModal();
  }
  function decorate(){
    if(!document.querySelector('.party-section')){const add=el('button',{class:'secondary-button',type:'button'},'+ Новая партия');add.onclick=()=>partyForm({afterPartyId:state.collection.parties.at(-1)?.id});document.querySelector('#achievement-list').append(add);}

    for(const section of document.querySelectorAll('.party-section')){
      const partyId=section.dataset.partyId;
      const tools=el('div',{class:'editor-party-tools'}),rename=el('button',{type:'button'},'Изменить название партии');rename.onclick=()=>partyForm({renameId:partyId});tools.append(rename);const remove=el('button',{type:'button'},'Удалить разделитель');remove.onclick=()=>removeDraft('party',partyId);tools.append(remove);
      const reversed=document.querySelector('#sort').value==='reverse';
      const ordered=PartyCollection.groups(state.collection,reversed),position=ordered.findIndex(p=>p.id===partyId);
      for(const [text,step,disabled]of [['↑ Выше',-1,position===0],['↓ Ниже',1,position===ordered.length-1]]){
        const move=el('button',{type:'button','aria-label':text.slice(2)+' партию '+(ordered[position]?.title||'без названия')},text);
        move.disabled=disabled;move.onclick=async()=>{await change(PartyCollection.moveParty(state.collection,partyId,reversed?-step:step));document.querySelector(`[data-party-id="${CSS.escape(partyId)}"] .editor-party-tools`)?.scrollIntoView({block:'nearest'});};tools.append(move);
      }

      const heading=section.querySelector('.campaign-heading');if(heading)heading.after(tools);else section.prepend(tools);
      const rows=Array.from(section.querySelectorAll('.achievement-row'));
      for(const row of rows){const id=row.dataset.achievementId,controls=el('div',{class:'editor-actions'});
        for(const [text,callback]of [['+ Ачивка',()=>achievementForm({afterId:id})],['+ Название партии',()=>partyForm({afterId:id})],['Изменить',()=>achievementForm({editId:id})],['Удалить',()=>removeDraft('achievement',id)]]){const button=el('button',{type:'button'},text);button.onclick=callback;controls.append(button);}row.after(controls);
      }
      if(!rows.length){const controls=el('div',{class:'editor-actions'}),add=el('button',{type:'button'},'+ Ачивка'),next=el('button',{type:'button'},'+ Следующая партия');add.onclick=()=>achievementForm({partyId});next.onclick=()=>partyForm({afterPartyId:partyId});controls.append(add,next);section.append(controls);}
    }
    if(!state.collection.parties.length){const button=el('button',{class:'secondary-button',type:'button'},'+ Первая партия');button.onclick=()=>partyForm();document.querySelector('#achievement-list').append(button);}
  }
  document.addEventListener('achievements:rendered',decorate);
  backupButton.onclick=()=>{const blob=new Blob([JSON.stringify({format:'party-achievements-draft-v1',...state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:'achievements-draft.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);};
  resetButton.onclick=()=>{
    const {node,form}=dialog('Отменить черновик?');
    form.append(el('p',{class:'editor-note'},'Вернём последнюю загруженную версию. Если правки могут пригодиться, сначала скачай копию черновика.'));
    const buttons=el('div',{class:'editor-form-actions'}),cancel=el('button',{type:'button',class:'secondary-button'},'Оставить'),reset=el('button',{type:'submit',class:'primary-button'},'Вернуть опубликованную версию');cancel.onclick=()=>node.close();buttons.append(cancel,reset);form.append(buttons);
    form.addEventListener('submit',async event=>{event.preventDefault();state={collection:structuredClone(publishedSeed),baselineCollection:structuredClone(publishedSeed),baseSha:publishedSha,images:[],dirty:false};updatePreview();await saveDraft();setStatus('Открыта последняя загруженная версия');node.close();});node.showModal();
  };
  function publishForm(){
    const {node,form}=dialog('Опубликовать для друзей');
    form.append(el('p',{class:'editor-note'},'Ачивки, названия партий и новые картинки будут сохранены на GitHub одной версией. Сайт обновится после публикации GitHub Pages.'));
    const token=field(form,'Ключ GitHub с правом записи в этот репозиторий',el('input',{type:'password',required:'',autocomplete:'off',spellcheck:'false',placeholder:'github_pat_…'}));
    const tokenStore='achievement-github-token';
    try{token.value=localStorage.getItem(tokenStore)||'';}catch{}
    const remember=field(form,'Запомнить ключ в этом браузере',el('input',{type:'checkbox'}));remember.checked=!!token.value;
    form.append(el('p',{class:'editor-note'},'Сохранённый ключ доступен этому браузеру и скриптам сайта. На общем компьютере не включай сохранение. В репозиторий и черновик ключ не попадает.'));
    const forget=el('button',{type:'button',class:'secondary-button'},'Забыть сохранённый ключ');forget.onclick=()=>{localStorage.removeItem(tokenStore);token.value='';remember.checked=false;};form.append(forget);
    const help=el('details',{class:'editor-help'});help.append(el('summary',{},'Как подключить GitHub в первый раз'));
    const list=el('ol');
    const first=el('li');first.append(el('a',{href:'https://github.com/settings/personal-access-tokens/new',target:'_blank',rel:'noopener noreferrer'},'Открой создание fine-grained access token в своём GitHub.'));list.append(first);
    for(const text of ['Resource owner: Hell-2U.','Repository access: Only select repositories → archive-7f3a9c2d.','Repository permissions → Contents → Read and write.','Выбери срок действия, создай ключ и вставь его в поле выше.'])list.append(el('li',{},text));help.append(list);form.append(help);
    const label=status(form),buttons=el('div',{class:'editor-form-actions'}),cancel=el('button',{type:'button',class:'secondary-button'},'Отмена'),send=el('button',{type:'submit',class:'primary-button'},'Опубликовать');cancel.onclick=()=>node.close();buttons.append(cancel,send);form.append(buttons);
    form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;send.disabled=true;cancel.disabled=true;label.classList.remove('error');try{
      const collection=api.validate(state.collection),used=imagePaths(collection);
      try{if(remember.checked)localStorage.setItem(tokenStore,token.value);else localStorage.removeItem(tokenStore);}catch{}
      {
        label.textContent='Проверяем исходную версию на GitHub…';
        const latest=await AchievementPublisher.snapshot({token:token.value});
        const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
        if(canonical(api.validate(latest.collection))!==canonical(api.validate(state.baselineCollection||api.getCollection())))throw new Error('Данные на GitHub изменились. Черновик сохранён; скачай копию и сверь её с последней публикацией.');
        state.baseSha=latest.sha;
      }
      const result=await AchievementPublisher.publish({collection,images:state.images.filter(image=>used.has(image.path)),token:token.value,expectedSha:state.baseSha,onProgress:text=>{label.textContent=text;}});
      token.value='';state.baseSha=result.sha;state.baselineCollection=structuredClone(collection);publishedSeed=structuredClone(collection);publishedSha=result.sha;state.images=[];state.dirty=false;await saveDraft();
      setStatus('Отправлено на публикацию. Друзья увидят правки через несколько минут.');label.textContent='Сохранено на GitHub. Публикация сайта обычно занимает несколько минут.';
      const link=el('a',{href:result.url,target:'_blank',rel:'noopener noreferrer'},'Посмотреть сохранённую версию');label.append(document.createElement('br'),link);send.hidden=true;cancel.textContent='Готово';
    }catch(err){error(label,err);}finally{busy=false;send.disabled=false;cancel.disabled=false;token.value='';}});
    node.showModal();token.focus();
  }
  publishButton.onclick=publishForm;
  const draft=await readDraft();
  let repairedDraft=false;
  if(draft?.collection){
    const raw=draft.collection;
    const mixed=raw.parties?.filter(p=>raw.achievements.some(a=>a.partyId===p.id&&a.artStyle==='new')&&raw.achievements.some(a=>a.partyId===p.id&&a.artStyle!=='new'))||[];
    if(mixed.length){
      if(db)await new Promise(resolve=>{const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(structuredClone(draft),'before-style-repair');tx.oncomplete=resolve;tx.onerror=resolve;});
      const fixed=api.validate(raw);
      for(const party of mixed){const previous=draft.baselineCollection?.parties?.find(p=>p.id===party.id);if(previous){fixed.parties.find(p=>p.id===party.id).title=previous.title;fixed.achievements.filter(a=>a.partyId===party.id).forEach(a=>{a.tags=(a.tags||[]).filter(t=>t!==party.title);if(previous.title&&!a.tags.includes(previous.title))a.tags.push(previous.title);});}}
      draft.collection=api.validate(fixed);draft.dirty=true;repairedDraft=true;
    }
  }
  try{
    const latest=await AchievementPublisher.snapshot();
    publishedSeed=api.validate(latest.collection);publishedSha=latest.sha;
    if(draft?.dirty){state=draft;state.collection=api.validate(state.collection);setStatus(state.baseSha===latest.sha?'Восстановлен твой черновик':'Черновик сохранён, но на GitHub есть другая версия. Перед публикацией нужно сверить изменения.',state.baseSha!==latest.sha);}
    else{const collection=api.validate(latest.collection);state={collection,baselineCollection:structuredClone(collection),images:[],baseSha:latest.sha,dirty:false};setStatus('Открыта последняя опубликованная версия');}
  }catch{if(draft){state=draft;state.collection=api.validate(state.collection);}setStatus('Можно редактировать. Подключи GitHub при публикации — он проверит исходную версию.');}
  updatePreview();
  if(repairedDraft){await saveDraft();setStatus('Стили разделены. Старые названия восстановлены, новые ачивки сохранены в отдельных партиях.');}
  addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
})();
