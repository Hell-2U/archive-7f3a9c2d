/* Owner-only UI. The link enables editing; GitHub separately authorizes publishing. */
(async()=>{
  'use strict';
  if(!window.ACHIEVEMENT_EDITOR_MODE)return;
  const api=window.achievementArchive;
  const IMAGE_TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'};
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
  function updatePreview(){const used=new Set(state.collection.achievements.map(item=>item.image));for(const path of overrides.keys())if(!used.has(path))overrides.delete(path);state.images.forEach(image=>overrides.set(image.path,`data:${image.mime};base64,${image.base64}`));api.setCollection(state.collection);}
  async function change(collection){state.collection=api.validate(collection);state.dirty=true;updatePreview();try{await saveDraft();setStatus('Черновик сохранён в этом браузере');}catch{setStatus('Не удалось сохранить черновик. Скачай копию перед закрытием страницы.',true);}}
  function dialog(title){const node=el('dialog',{class:'editor-dialog'}),heading=el('h2',{},title),form=el('form',{class:'editor-form'}),close=el('button',{class:'close-button',type:'button','aria-label':'Закрыть'},'×');close.addEventListener('click',()=>node.close());node.append(close,heading,form);document.body.append(node);node.addEventListener('close',()=>node.remove());return {node,form};}
  function field(form,labelText,node){const label=el('label',{},labelText);label.append(node);form.append(label);return node;}
  function formFooter(form,node){const buttons=el('div',{class:'editor-form-actions'}),cancel=el('button',{type:'button',class:'secondary-button'},'Отмена'),save=el('button',{type:'submit',class:'primary-button'},'Сохранить в черновик');cancel.onclick=()=>node.close();buttons.append(cancel,save);form.append(buttons);return save;}
  function status(form){const label=el('p',{class:'editor-status',role:'status','aria-live':'polite'});form.append(label);return label;}
  function error(label,err){label.classList.add('error');label.textContent=err.message||'Не удалось сохранить изменение.';}
  function partyForm({afterId=null,afterPartyId=null,renameId=null}={}){
    const {node,form}=dialog(renameId?'Название партии':'Новая партия');
    const title=field(form,'Название',el('input',{required:'',maxlength:'200',autocomplete:'off'}));
    if(renameId)title.value=state.collection.parties.find(p=>p.id===renameId)?.title||'';
    if(afterId)form.append(el('p',{class:'editor-note'},'Новый раздел начнётся после выбранной ачивки. Остальные ачивки текущей партии после неё перейдут в этот раздел.'));
    const label=status(form);formFooter(form,node);
    form.addEventListener('submit',async event=>{event.preventDefault();if(!title.value.trim())return;try{const data=renameId?PartyCollection.renameParty(state.collection,renameId,title.value.trim()):PartyCollection.insertParty(state.collection,{id:'party-'+uuid(),title:title.value.trim(),afterId,afterPartyId});await change(data);node.close();}catch(err){error(label,err);}});
    node.showModal();title.focus();
  }
  function achievementForm({afterId=null,partyId=null,editId=null}={}){
    const existing=state.collection.achievements.find(a=>a.id===editId);
    const anchor=state.collection.achievements.find(a=>a.id===afterId);
    const {node,form}=dialog(existing?'Изменить ачивку':'Новая ачивка');
    const title=field(form,'Название',el('input',{required:'',maxlength:'500',autocomplete:'off'}));title.value=existing?.title||'';
    const description=field(form,'Описание',el('textarea',{rows:'4',maxlength:'15000'}));description.value=existing?.description||'';
    const party=field(form,'Партия',el('select',{}));
    for(const item of state.collection.parties)party.append(el('option',{value:item.id},item.title||'Партия без названия'));
    party.value=existing?.partyId||partyId||anchor?.partyId||state.collection.parties[0]?.id||'';
    const file=field(form,existing?'Заменить картинку':'Картинка',el('input',{type:'file',accept:'.png,.jpg,.jpeg,.webp,.avif'}));
    const preview=el('img',{class:'editor-preview',alt:'Предпросмотр картинки',hidden:''});
    const currentImage=existing?.image;if(currentImage){preview.src=overrides.get(currentImage)||currentImage;preview.hidden=false;}form.append(preview);
    let previewUrl;file.onchange=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);if(file.files[0]){previewUrl=URL.createObjectURL(file.files[0]);preview.src=previewUrl;preview.hidden=false;}};
    const pixel=field(form,'Показ изображения',el('select',{}));pixel.append(el('option',{value:'auto'},'Обычная иллюстрация'),el('option',{value:'pixelated'},'Пиксельный рисунок'));pixel.value=existing?.imageRendering||'auto';
    form.append(el('p',{class:'editor-note'},'PNG, JPG, WebP или AVIF, до 10 МБ. Можно сохранить ачивку без картинки и добавить её позже.'));
    const label=status(form),save=formFooter(form,node);
    node.addEventListener('close',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
      let image=existing?.image||'',pending;
      if(file.files[0]){const selected=file.files[0],extension=IMAGE_TYPES[selected.type];if(!extension)throw new Error('Выбери PNG, JPG, WebP или AVIF.');if(selected.size>10*1024*1024)throw new Error('Картинка должна быть не больше 10 МБ.');
        const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать картинку.'));reader.readAsDataURL(selected);});
        image=`assets/achievements/user-${uuid()}.${extension}`;pending={path:image,mime:selected.type,base64:encoded.split(',')[1]};
      }
      const record={...(existing||{}),id:existing?.id||'achievement-'+uuid(),title:title.value.trim(),description:description.value.trim(),image,partyId:party.value,imageRendering:pixel.value};
      const next=PartyCollection.saveAchievement(state.collection,record,existing||anchor?.partyId!==party.value?null:afterId);
      if(pending)state.images.push(pending);
      await change(next);node.close();
    }catch(err){error(label,err);}finally{save.disabled=false;}});
    node.showModal();title.focus();
  }
  function decorate(){
    for(const section of document.querySelectorAll('.party-section')){
      const partyId=section.dataset.partyId;
      const tools=el('div',{class:'editor-party-tools'}),rename=el('button',{type:'button'},'Изменить название партии');rename.onclick=()=>partyForm({renameId:partyId});tools.append(rename);
      const heading=section.querySelector('.campaign-heading');if(heading)heading.after(tools);else section.prepend(tools);
      const rows=Array.from(section.querySelectorAll('.achievement-row'));
      for(const row of rows){const id=row.dataset.achievementId,controls=el('div',{class:'editor-actions'});
        for(const [text,callback]of [['+ Ачивка',()=>achievementForm({afterId:id})],['+ Название партии',()=>partyForm({afterId:id})],['Изменить',()=>achievementForm({editId:id})]]){const button=el('button',{type:'button'},text);button.onclick=callback;controls.append(button);}row.after(controls);
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
    form.append(el('p',{class:'editor-note'},'Ключ используется только для этой публикации. Он не сохраняется в файлах сайта или черновике.'));
    const help=el('details',{class:'editor-help'});help.append(el('summary',{},'Как подключить GitHub в первый раз'));
    const list=el('ol');
    const first=el('li');first.append(el('a',{href:'https://github.com/settings/personal-access-tokens/new',target:'_blank',rel:'noopener noreferrer'},'Открой создание fine-grained access token в своём GitHub.'));list.append(first);
    for(const text of ['Resource owner: Hell-2U.','Repository access: Only select repositories → archive-7f3a9c2d.','Repository permissions → Contents → Read and write.','Выбери срок действия, создай ключ и вставь его в поле выше.'])list.append(el('li',{},text));help.append(list);form.append(help);
    const label=status(form),buttons=el('div',{class:'editor-form-actions'}),cancel=el('button',{type:'button',class:'secondary-button'},'Отмена'),send=el('button',{type:'submit',class:'primary-button'},'Опубликовать');cancel.onclick=()=>node.close();buttons.append(cancel,send);form.append(buttons);
    form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;send.disabled=true;cancel.disabled=true;label.classList.remove('error');try{
      const collection=api.validate(state.collection),used=new Set(collection.achievements.map(a=>a.image));
      if(!state.baseSha){
        label.textContent='Проверяем исходную версию на GitHub…';
        const latest=await AchievementPublisher.snapshot({token:token.value});
        const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
        if(canonical(api.validate(latest.collection))!==canonical(state.baselineCollection||api.getCollection()))throw new Error('Исходная версия изменилась. Черновик сохранён; скачай копию и сверь её с последней публикацией.');
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
  try{
    const latest=await AchievementPublisher.snapshot();
    publishedSeed=api.validate(latest.collection);publishedSha=latest.sha;
    if(draft?.dirty){state=draft;state.collection=api.validate(state.collection);setStatus(state.baseSha===latest.sha?'Восстановлен твой черновик':'Черновик сохранён, но на GitHub есть другая версия. Перед публикацией нужно сверить изменения.',state.baseSha!==latest.sha);}
    else{const collection=api.validate(latest.collection);state={collection,baselineCollection:structuredClone(collection),images:[],baseSha:latest.sha,dirty:false};setStatus('Открыта последняя опубликованная версия');}
  }catch{if(draft){state=draft;state.collection=api.validate(state.collection);}setStatus('Можно редактировать. Подключи GitHub при публикации — он проверит исходную версию.');}
  updatePreview();
  addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
})();
