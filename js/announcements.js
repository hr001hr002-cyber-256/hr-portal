document.addEventListener('DOMContentLoaded', async () => {
  const els={q:document.querySelector('#announcementQuery'),category:document.querySelector('#categoryFilter'),status:document.querySelector('#statusFilter'),results:document.querySelector('#announcementResults'),count:document.querySelector('#resultCount'),title:document.querySelector('#resultsTitle')};
  let items=[]; const params=new URLSearchParams(location.search);
  els.q.value=params.get('q')||'';
  try { items=DATA.newest(await DATA.load('data/announcements.json')); } catch { els.results.innerHTML='<p class="empty">無法讀取公告資料。</p>'; return; }
  [...new Set(items.map(x=>x.category))].sort().forEach(c=>els.category.add(new Option(c,c)));
  els.category.value=params.get('category')||'';
  function render(){
    const q=DATA.normalize(els.q.value), cat=els.category.value, status=els.status.value;
    const filtered=items.filter(a=>{const hay=DATA.normalize([a.id,a.title,a.category,a.summary,...(a.keywords||[])].join(' '));return(!q||hay.includes(q))&&(!cat||a.category===cat)&&(!status||a.status===status)});
    els.title.textContent=q?`「${els.q.value.trim()}」的搜尋結果`:cat?cat:'所有公告'; els.count.textContent=`${filtered.length} 件`;
    els.results.innerHTML=filtered.map(a=>`<article class="document-card"><div><span class="doc-id">${DATA.escape(a.id.toUpperCase())}</span><span class="doc-date">${DATA.formatDate(a.date)}</span></div><div class="doc-main"><h3>${DATA.escape(a.title)}</h3><p>${DATA.escape(a.summary||'')}</p><div class="tags"><span class="tag">${DATA.escape(a.category)}</span><span class="tag ${a.status==='有效'?'':'inactive'}">${DATA.escape(a.status)}</span></div></div><div class="file-links">${DATA.fileLinks(a.files)}</div></article>`).join('')||'<p class="empty">找不到符合條件的公告。</p>';
  }
  [els.q,els.category,els.status].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',render));
  document.querySelector('#clearSearch').addEventListener('click',()=>{els.q.value='';els.category.value='';els.status.value='有效';render();els.q.focus()});render();
});
