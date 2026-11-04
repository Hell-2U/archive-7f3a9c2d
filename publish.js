/* Browser publisher: credentials are supplied by the owner, never bundled. */
(() => {
  const ROOT='https://api.github.com/repos/Hell-2U/archive-7f3a9c2d';
  const decode=base64=>new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  async function request(path,{token='',method='GET',body,fetcher=fetch}={}) {
    const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(body)headers['Content-Type']='application/json';
    const response=await fetcher(ROOT+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){
      if(response.status===401)throw new Error('GitHub не принял ключ. Проверь его или создай новый.');
      if(response.status===403)throw new Error('Нет права записи или достигнут лимит GitHub. Нужен ключ с Contents: Read and write для этого репозитория.');
      if(response.status===409||response.status===422)throw new Error('В репозитории появилась другая версия. Черновик сохранён; сначала нужно сверить изменения.');
      throw new Error(`GitHub не выполнил запрос (${response.status}). Черновик сохранён.`);
    }
    return response.json();
  }
  async function snapshot(options={}) {
    const ref=await request('/git/ref/heads/main',options);
    const file=await request('/contents/data/achievements.json?ref='+encodeURIComponent(ref.object.sha),options);
    return {sha:ref.object.sha,collection:JSON.parse(decode(file.content))};
  }
  async function publish({collection,images,token,expectedSha,onProgress=()=>{},fetcher=fetch}) {
    if(!token?.trim())throw new Error('Вставь ключ GitHub для публикации.');
    if(!expectedSha)throw new Error('Сначала нужно загрузить исходную версию с GitHub. Обнови редактор; черновик сохранится.');
    const options={token:token.trim(),fetcher};
    const ref=await request('/git/ref/heads/main',options);
    if(ref.object.sha!==expectedSha)throw new Error('На сайте уже есть более новая версия. Черновик сохранён; его нужно сверить с последней публикацией.');
    const commit=await request('/git/commits/'+ref.object.sha,options);
    const tree=[];
    for(const [index,image] of images.entries()) {
      if(!/^assets\/achievements\/user-[a-z\d-]+\.(png|jpg|webp|avif)$/.test(image.path))throw new Error('Некорректный путь изображения.');
      onProgress(`Загружаем изображения: ${index+1} из ${images.length}`);
      const blob=await request('/git/blobs',{...options,method:'POST',body:{content:image.base64,encoding:'base64'}});
      tree.push({path:image.path,mode:'100644',type:'blob',sha:blob.sha});
    }
    const json=JSON.stringify(collection,null,2)+'\n';
    for(const [path,content] of [
      ['data/achievements.json',json],
      ['data/achievements-data.js','window.ACHIEVEMENT_DATA = '+json.trim().replaceAll('<','\\u003c')+';\n'],
    ]) tree.push({path,mode:'100644',type:'blob',content});
    onProgress('Сохраняем новую версию…');
    const nextTree=await request('/git/trees',{...options,method:'POST',body:{base_tree:commit.tree.sha,tree}});
    const nextCommit=await request('/git/commits',{...options,method:'POST',body:{message:'Update party achievements from editor',tree:nextTree.sha,parents:[ref.object.sha]}});
    await request('/git/refs/heads/main',{...options,method:'PATCH',body:{sha:nextCommit.sha,force:false}});
    return {sha:nextCommit.sha,url:`https://github.com/Hell-2U/archive-7f3a9c2d/commit/${nextCommit.sha}`};
  }
  globalThis.AchievementPublisher={snapshot,publish};
})();
