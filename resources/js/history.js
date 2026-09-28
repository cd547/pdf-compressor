// history.js —— localStorage 历史记录
window.History = (function () {
  const KEY = 'pdfc_history';
  const MAX = 20;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  }

  function add(entry) {
    const list = load();
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    entry.time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    list.push(entry);
    save(list);
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  async function backup() {
    try {
      const list = load();
      await Neutralino.storage.setData('history_backup', JSON.stringify(list));
    } catch (e) {}
  }

  return { load, save, add, clear, backup };
})();
