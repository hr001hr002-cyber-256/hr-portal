const DATA = {
  async load(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`無法讀取 ${path}`);
    return response.json();
  },
  normalize(value) { return String(value || '').trim().toLowerCase(); },
  parseDate(value) { return new Date(`${value}T00:00:00`); },
  formatDate(value) {
    if (!value) return '—';
    const d = this.parseDate(value);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  },
  isCurrentMonth(value) {
    const d = this.parseDate(value), now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  },
  newest(items) { return [...items].sort((a,b) => this.parseDate(b.date)-this.parseDate(a.date)); },
  fileLinks(files=[]) {
    if (!files.length) return '<span class="tag inactive">尚無附件</span>';
    return files.map(f => `<a class="file-link" href="${encodeURI(f.path)}" target="_blank" rel="noopener">${f.type || '文件'}</a>`).join('');
  },
  escape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
};
