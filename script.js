const units = {
  nm: { name: 'Nanometer', symbol: 'nm', factor: 1e-9, category: 'Metric' }, um: { name: 'Micrometer', symbol: 'µm', factor: 1e-6, category: 'Metric' }, mm: { name: 'Millimeter', symbol: 'mm', factor: 1e-3, category: 'Metric' }, cm: { name: 'Centimeter', symbol: 'cm', factor: 1e-2, category: 'Metric' }, m: { name: 'Meter', symbol: 'm', factor: 1, category: 'Metric' }, km: { name: 'Kilometer', symbol: 'km', factor: 1e3, category: 'Metric' },
  in: { name: 'Inch', symbol: 'in', factor: 0.0254, category: 'Imperial / US' }, ft: { name: 'Foot', symbol: 'ft', factor: 0.3048, category: 'Imperial / US' }, yd: { name: 'Yard', symbol: 'yd', factor: 0.9144, category: 'Imperial / US' }, mi: { name: 'Mile', symbol: 'mi', factor: 1609.344, category: 'Imperial / US' }, nmi: { name: 'Nautical mile', symbol: 'nmi', factor: 1852, category: 'Marine' }
};

const storageKeys = { history: 'precision-length-history', favorites: 'precision-length-favorites', theme: 'precision-length-theme', precision: 'precision-length-precision' };
const elements = {
  form: document.querySelector('#converterForm'), value: document.querySelector('#valueInput'), from: document.querySelector('#fromUnit'), to: document.querySelector('#toUnit'), inputError: document.querySelector('#inputError'),
  result: document.querySelector('#resultDisplay'), sentence: document.querySelector('#resultSentence'), factor: document.querySelector('#factorDisplay'), timestamp: document.querySelector('#resultTimestamp'), copy: document.querySelector('#copyButton'), copyStatus: document.querySelector('#copyStatus'), favorite: document.querySelector('#favoriteButton'), allUnits: document.querySelector('#allUnitsGrid'), allSummary: document.querySelector('#allUnitsSummary'), history: document.querySelector('#historyList'), favorites: document.querySelector('#favoritesList'), toast: document.querySelector('#toast'), themeToggle: document.querySelector('#themeToggle'), precision: document.querySelector('#precisionSelect'), fromCategory: document.querySelector('#fromCategory'), toCategory: document.querySelector('#toCategory')
};
let latestConversion = null;
let toastTimer;

function populateUnits() {
  Object.entries(units).forEach(([key, unit]) => {
    const label = `${unit.name} (${unit.symbol})`;
    elements.from.add(new Option(label, key));
    elements.to.add(new Option(label, key));
  });
  elements.from.value = 'mm';
  elements.to.value = 'm';
}

function formatNumber(number) {
  if (!Number.isFinite(number)) return '—';
  const precision = elements.precision?.value || 'auto';
  if (precision !== 'auto') return Number(number).toFixed(Number(precision)).replace(/\.0+$|(?<=\.[0-9]*?)0+$/, '').replace(/\.$/, '');
  const absolute = Math.abs(number);
  if (absolute !== 0 && (absolute >= 1e9 || absolute < 1e-6)) return number.toExponential(8).replace(/\.?(?:0+)(e|$)/, '$1').replace('e+', 'e');
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 12, useGrouping: false }).format(number);
}

function parseValue() {
  const raw = elements.value.value.trim().replace(/,/g, '');
  if (!raw) return { value: null, error: 'Enter a value to convert.' };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { value: null, error: 'Use a valid number, such as 12.5 or 3e-4.' };
  return { value, error: '' };
}

function convert(value, fromKey, toKey) {
  return (value * units[fromKey].factor) / units[toKey].factor;
}

function getDateLabel(date = new Date()) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function pairLabel(fromKey, toKey) { return `${units[fromKey].symbol} → ${units[toKey].symbol}`; }
function setError(message) { elements.inputError.textContent = message; elements.value.setAttribute('aria-invalid', message ? 'true' : 'false'); }

function renderAllUnits(meters, activeKey) {
  elements.allUnits.innerHTML = Object.entries(units).map(([key, unit]) => `<div class="unit-card ${key === activeKey ? 'active' : ''}"><span>${unit.name}</span><small class="card-symbol">${unit.symbol} · ${unit.category}</small><strong>${formatNumber(meters / unit.factor)} ${unit.symbol}</strong><button class="card-copy" type="button" data-copy-value="${formatNumber(meters / unit.factor)} ${unit.symbol}" aria-label="Copy ${unit.name} result">▣</button>${key === activeKey ? '<small class="target-tag">Selected target</small>' : ''}</div>`).join('');
  elements.allUnits.querySelectorAll('.card-copy').forEach(button => button.addEventListener('click', () => copyText(button.dataset.copyValue)));
}

function updateFavoriteState() {
  const favorites = readStorage(storageKeys.favorites, []);
  const saved = favorites.some(item => item.from === elements.from.value && item.to === elements.to.value);
  elements.favorite.classList.toggle('is-saved', saved);
  elements.favorite.textContent = saved ? '★' : '☆';
  elements.favorite.setAttribute('aria-label', saved ? 'Remove current unit pair from favorites' : 'Save current unit pair as favorite');
}

function performConversion(save = true) {
  const parsed = parseValue();
  if (parsed.error) {
    setError(parsed.error);
    latestConversion = null;
    elements.result.textContent = '—';
    elements.sentence.textContent = 'Enter a valid value to see a result.';
    elements.factor.textContent = '1 unit → 1 unit';
    elements.timestamp.textContent = 'Waiting for valid input';
    elements.allSummary.textContent = 'Waiting for valid input';
    elements.allUnits.innerHTML = '';
    elements.copy.disabled = true;
    updateFavoriteState();
    if (elements.value.value.trim()) showToast(parsed.error);
    return false;
  }
  setError('');
  const fromKey = elements.from.value;
  const toKey = elements.to.value;
  elements.fromCategory.textContent = units[fromKey].category;
  elements.toCategory.textContent = units[toKey].category;
  const result = convert(parsed.value, fromKey, toKey);
  const meters = parsed.value * units[fromKey].factor;
  if (!Number.isFinite(result) || !Number.isFinite(meters)) { setError('That value is outside the safe conversion range.'); return false; }
  const formattedInput = formatNumber(parsed.value);
  const formattedResult = formatNumber(result);
  latestConversion = { value: parsed.value, from: fromKey, to: toKey, result, meters, time: new Date().toISOString() };
  elements.result.textContent = `${formattedResult} ${units[toKey].symbol}`;
  elements.result.classList.remove('result-pop');
  requestAnimationFrame(() => elements.result.classList.add('result-pop'));
  elements.sentence.textContent = `${formattedInput} ${units[fromKey].symbol} = ${formattedResult} ${units[toKey].symbol}`;
  elements.factor.textContent = `1 ${units[fromKey].symbol} = ${formatNumber(units[fromKey].factor / units[toKey].factor)} ${units[toKey].symbol}`;
  elements.timestamp.textContent = `Updated ${getDateLabel()}`;
  elements.allSummary.textContent = `${formattedInput} ${units[fromKey].symbol} across all supported units`;
  elements.copy.disabled = false;
  renderAllUnits(meters, toKey);
  updateFavoriteState();
  if (save) saveHistory(latestConversion);
  return true;
}

function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function writeStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function saveHistory(conversion) {
  const history = readStorage(storageKeys.history, []);
  const entry = { ...conversion, time: new Date().toISOString() };
  const deduped = history.filter(item => !(item.value === entry.value && item.from === entry.from && item.to === entry.to));
  writeStorage(storageKeys.history, [entry, ...deduped].slice(0, 10));
  renderHistory();
}

function renderHistory() {
  const history = readStorage(storageKeys.history, []);
  if (!history.length) { elements.history.innerHTML = '<div class="empty-state">Your ten most recent conversions will appear here.</div>'; return; }
  elements.history.innerHTML = history.map((item, index) => `<div class="history-item" data-history-index="${index}"><button class="history-main" type="button"><span><strong class="history-value">${formatNumber(item.value)} ${units[item.from].symbol} → ${formatNumber(item.result)} ${units[item.to].symbol}</strong><span class="history-meta">${units[item.from].name} → ${units[item.to].name} · ${getDateLabel(new Date(item.time))}</span></span></button><button class="history-delete" type="button" data-delete-history="${index}" aria-label="Delete history item">×</button></div>`).join('');
  elements.history.querySelectorAll('.history-main').forEach(button => button.addEventListener('click', event => {
    const item = history[Number(event.currentTarget.closest('[data-history-index]').dataset.historyIndex)]; elements.value.value = item.value; elements.from.value = item.from; elements.to.value = item.to; performConversion(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  elements.history.querySelectorAll('[data-delete-history]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); history.splice(Number(button.dataset.deleteHistory), 1); writeStorage(storageKeys.history, history); renderHistory(); showToast('History item removed.'); }));
}

function renderFavorites() {
  const favorites = readStorage(storageKeys.favorites, []);
  if (!favorites.length) { elements.favorites.innerHTML = '<div class="empty-state">Save a unit pair with the ☆ button.</div>'; return; }
  elements.favorites.innerHTML = favorites.map((item, index) => `<button class="favorite-item" type="button" data-favorite-index="${index}"><span><strong>${units[item.from].name} → ${units[item.to].name}</strong><span>${pairLabel(item.from, item.to)}</span></span><span aria-hidden="true">→</span></button>`).join('');
  elements.favorites.querySelectorAll('[data-favorite-index]').forEach(button => button.addEventListener('click', () => {
    const item = favorites[Number(button.dataset.favoriteIndex)]; elements.from.value = item.from; elements.to.value = item.to; if (elements.value.value.trim()) performConversion(); else updateFavoriteState();
  }));
}

function toggleFavorite() {
  if (!latestConversion) return showToast('Convert a value before saving a pair.');
  const favorites = readStorage(storageKeys.favorites, []);
  const existing = favorites.findIndex(item => item.from === latestConversion.from && item.to === latestConversion.to);
  if (existing >= 0) { favorites.splice(existing, 1); elements.favorite.classList.add('favorite-bounce'); showToast('Favorite removed.'); } else { favorites.unshift({ from: latestConversion.from, to: latestConversion.to }); elements.favorite.classList.add('favorite-bounce'); showToast('Favorite pair saved.'); }
  writeStorage(storageKeys.favorites, favorites.slice(0, 12)); renderFavorites(); updateFavoriteState();
}

function reset() { elements.value.value = ''; setError(''); latestConversion = null; elements.result.textContent = '—'; elements.sentence.textContent = 'Enter a value to begin a precise conversion.'; elements.factor.textContent = '1 unit → 1 unit'; elements.timestamp.textContent = 'Ready when you are'; elements.allSummary.textContent = 'Waiting for input'; elements.allUnits.innerHTML = ''; elements.copy.disabled = true; elements.copyStatus.textContent = ''; updateFavoriteState(); elements.value.focus(); }
function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add('show'); toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2300); }
async function copyText(text) { try { await navigator.clipboard.writeText(text); showToast('Result copied.'); } catch { showToast('Copy unavailable.'); } }

function applyTheme(theme) { document.documentElement.dataset.theme = theme; elements.themeToggle.textContent = theme === 'dark' ? '☀' : '☾'; elements.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`); }

populateUnits(); renderHistory(); renderFavorites(); applyTheme(localStorage.getItem(storageKeys.theme) || 'light'); elements.precision.value = localStorage.getItem(storageKeys.precision) || 'auto'; updateFavoriteState();
elements.form.addEventListener('submit', event => { event.preventDefault(); performConversion(); });
elements.value.addEventListener('input', () => { if (elements.value.value.trim()) performConversion(false); else reset(); });
elements.from.addEventListener('change', () => { if (elements.value.value.trim()) performConversion(false); else updateFavoriteState(); });
elements.to.addEventListener('change', () => { if (elements.value.value.trim()) performConversion(false); else updateFavoriteState(); });
document.querySelector('#swapButton').addEventListener('click', () => { const previous = elements.from.value; elements.from.value = elements.to.value; elements.to.value = previous; if (elements.value.value.trim()) performConversion(); else updateFavoriteState(); });
document.querySelector('#resetButton').addEventListener('click', reset);
document.querySelector('#clearHistoryButton').addEventListener('click', () => { writeStorage(storageKeys.history, []); renderHistory(); showToast('Conversion history cleared.'); });
elements.favorite.addEventListener('click', toggleFavorite);
elements.copy.addEventListener('click', async () => { if (!latestConversion) return; await copyText(elements.sentence.textContent); elements.copyStatus.textContent = 'Copied to clipboard'; });
elements.precision.addEventListener('change', () => { localStorage.setItem(storageKeys.precision, elements.precision.value); if (elements.value.value.trim()) performConversion(false); });
document.querySelector('#settingsButton').addEventListener('click', () => showToast('Precision settings are ready above.'));
elements.themeToggle.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(next); localStorage.setItem(storageKeys.theme, next); });
document.querySelectorAll('.quick-chip').forEach(button => button.addEventListener('click', () => { elements.value.value = button.dataset.value; elements.from.value = button.dataset.unit; if (button.dataset.unit === 'in') elements.to.value = 'mm'; else if (button.dataset.unit === 'ft') elements.to.value = 'm'; else if (button.dataset.unit === 'mm') elements.to.value = 'm'; else elements.to.value = 'mm'; performConversion(); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.activeElement === elements.value) { elements.value.value = ''; reset(); } if (document.activeElement === elements.value || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; if (event.key.toLowerCase() === 'r') reset(); if (event.key.toLowerCase() === 's') document.querySelector('#swapButton').click(); });
