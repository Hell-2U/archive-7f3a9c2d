/* The party order is chronological; achievements retain their order inside a party. */
(() => {
  const copy = value => structuredClone(value);
  function normalize(input) {
    const data = copy(input);
    if (!Array.isArray(data.parties)) {
      data.parties = [];
      let previous, party;
      for (const record of data.achievements) {
        const name = record.campaign || '';
        if (!party || name !== previous) {
          party = {id:`party-${String(data.parties.length + 1).padStart(3,'0')}`,title:name};
          data.parties.push(party); previous = name;
        }
        record.partyId = party.id;
      }
    }
    const ids = new Set();
    for (const party of data.parties) {
      if (!party || typeof party.id !== 'string' || !party.id || ids.has(party.id) || typeof party.title !== 'string') throw new Error('Проверь названия и идентификаторы партий.');
      ids.add(party.id);
    }
    for (const record of data.achievements) {
      if (!ids.has(record.partyId)) throw new Error(`У ачивки «${record.title}» не указана существующая партия.`);
      const party = data.parties.find(item=>item.id === record.partyId);
      record.campaign = party.title;
    }
    return data;
  }
  function groups(data, reverse=false) {
    const result = data.parties.map(party=>({...party,records:data.achievements.filter(item=>item.partyId === party.id)}));
    return reverse ? result.reverse() : result;
  }
  function insertParty(data, {id,title,afterId=null,afterPartyId=null}) {
    const next = copy(data), anchor = next.achievements.find(item=>item.id === afterId);
    const oldId = anchor?.partyId || afterPartyId;
    const oldIndex = next.parties.findIndex(item=>item.id === oldId);
    next.parties.splice(oldIndex + 1,0,{id,title});
    if (anchor) {
      const index = next.achievements.indexOf(anchor);
      for (const record of next.achievements.slice(index + 1)) {
        if (record.partyId !== oldId) continue;
        record.partyId = id; record.campaign = title;
      }
    }
    return normalize(next);
  }
  function renameParty(data,id,title) {
    const next = copy(data), party = next.parties.find(item=>item.id === id);
    if (!party) throw new Error('Партия не найдена.');
    const oldTitle = party.title; party.title = title;
    next.achievements.filter(item=>item.partyId===id).forEach(item=>{item.campaign=title;item.tags=(item.tags||[]).filter(tag=>tag!==oldTitle);if(title)item.tags.push(title);});
    return normalize(next);
  }
  function saveAchievement(data,record,afterId=null) {
    const next=copy(data), existing=next.achievements.findIndex(item=>item.id===record.id);
    if(existing>=0) next.achievements[existing]={...next.achievements[existing],...record};
    else if(afterId) {const index=next.achievements.findIndex(item=>item.id===afterId);if(index<0)throw new Error('Место вставки не найдено.');next.achievements.splice(index+1,0,record);}
    else {const last=next.achievements.findLastIndex(item=>item.partyId===record.partyId);next.achievements.splice(last<0?next.achievements.length:last+1,0,record);}
    return normalize(next);
  }
  function moveParty(data,id,step) {
    const next=copy(data),index=next.parties.findIndex(p=>p.id===id),target=index+step;
    if(index<0||![-1,1].includes(step)||target<0||target>=next.parties.length)return next;
    [next.parties[index],next.parties[target]]=[next.parties[target],next.parties[index]];
    // Keep the exported array in the same party order, preserving order inside each party.
    next.achievements=groups(next).flatMap(p=>p.records);
    return normalize(next);
  }
  globalThis.PartyCollection = {normalize,groups,insertParty,renameParty,saveAchievement,moveParty};
})();
