document.addEventListener('DOMContentLoaded', async () => {
  const now = new Date();
  document.querySelector('#today').textContent = new Intl.DateTimeFormat('zh-TW',{dateStyle:'full'}).format(now);
  document.querySelector('#homeSearch').addEventListener('submit', e => {
    e.preventDefault(); const q = document.querySelector('#homeQuery').value.trim();
    location.href = `announcements.html${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  });
  try {
    const [announcements, salary] = await Promise.all([DATA.load('data/announcements.json'), DATA.load('data/salary-files.json')]);
    const active = announcements.filter(x => x.status === '有效');
    const annMonth = active.filter(x => DATA.isCurrentMonth(x.date));
    const salMonth = salary.filter(x => x.status === '有效' && DATA.isCurrentMonth(x.date));
    const newestAnn = DATA.newest(active), newestSal = DATA.newest(salary.filter(x => x.status === '有效'));
    document.querySelector('#announcementMonth').textContent = annMonth.length ? `本月新增 ${annMonth.length} 件` : '無新增';
    document.querySelector('#salaryMonth').textContent = salMonth.length ? `本月新增 ${salMonth.length} 件` : '無新增';
    document.querySelector('#announcementTotal').textContent = `${active.length} 件`;
    document.querySelector('#announcementUpdated').textContent = `最後更新：${DATA.formatDate(newestAnn[0]?.date)}`;
    document.querySelector('#salaryUpdated').textContent = `最後更新：${DATA.formatDate(newestSal[0]?.date)}`;
    document.querySelector('#dataStatus').textContent = `資料更新至 ${DATA.formatDate(newestAnn[0]?.date)}`;
    document.querySelector('#recentAnnouncements').innerHTML = newestAnn.slice(0,4).map(a => `<a class="recent-item" href="announcements.html?q=${encodeURIComponent(a.id)}"><span class="recent-date">${DATA.formatDate(a.date)}</span><span class="recent-title"><strong>${DATA.escape(a.title)}</strong><small>${DATA.escape(a.id.toUpperCase())} · ${DATA.escape(a.category)}</small></span><span class="recent-arrow">→</span></a>`).join('') || '<p class="empty">目前沒有公告</p>';
    const categoryCounts = active.reduce((acc,a)=>(acc[a.category]=(acc[a.category]||0)+1,acc),{});
    document.querySelector('#categoryLinks').innerHTML = Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<a href="announcements.html?category=${encodeURIComponent(name)}"><span>${DATA.escape(name)}</span><span>${count} →</span></a>`).join('');
  } catch(err) {
    document.querySelector('#dataStatus').textContent = '資料載入失敗';
    document.querySelector('#recentAnnouncements').innerHTML = '<p class="empty">無法讀取資料，請確認網站由伺服器開啟。</p>';
  }
});
