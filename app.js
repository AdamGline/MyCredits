// ========== FIREBASE ==========
let auth, db;
let authResolveTimer = null;
function _initFirebase() {
if (window._fbAppInited) return;
window._fbAppInited = true;
if (typeof firebase === 'undefined') { authResolved = true; authUser = null; splashTimerDone = true; evaluateLaunch(); return; }
const firebaseConfig = {
apiKey: "AIzaSyB15_LES6x8ZO6FvfkZ-uLdn6ytKO6ZTaM",
authDomain: "my-credits-804ab.firebaseapp.com",
projectId: "my-credits-804ab",
storageBucket: "my-credits-804ab.firebasestorage.app",
messagingSenderId: "602702013620",
appId: "1:602702013620:web:1babc849f5ed8bcdaee3e1"
};
try {
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
auth = firebase.auth(); db = firebase.firestore();
db.enablePersistence({synchronizeTabs:true}).catch(function(err) { console.log('Offline mode error:', err); });
} catch(e) { authResolved = true; authUser = null; splashTimerDone = true; evaluateLaunch(); return; }
authResolveTimer = setTimeout(() => { if (!authResolved) { authResolved = true; authUser = null; splashTimerDone = true; evaluateLaunch(); } }, 5000);
auth.onAuthStateChanged(user => {
clearTimeout(authResolveTimer);
authUser = user || null; authResolved = true; splashTimerDone = true;
if (!user && creditsUnsubscribe) { creditsUnsubscribe(); creditsUnsubscribe = null; }
evaluateLaunch();
if (user) { user.reload().catch(() => {}); db.collection('users').doc(user.uid).set({ email: user.email, displayName: user.displayName, emailVerified: user.emailVerified }, { merge: true }).catch(() => {}); }
});
}
// ========== КОНСТАНТЫ ==========
const MONTH_K='crt_month_v4', THEME_K='crt_theme_v4', AMT_K='crt_amounts_v4', FONT_K='crt_font_v4';
const PIN_K='crt_pin_v5', PIN_LEN_K='crt_pin_len_v4', PIN_SALT='mycredits_salt_2025';
const COLLAPSE_K='crt_collapse_v1', HAPTIC_K='crt_haptic_v1', NOTIF_K='crt_notif_v1', NOTIF_DAYS_K='crt_notif_days_v1', OVERDUE_K='crt_overdue_v1', BIO_K='crt_biometric_v1';
const CATS = { mortgage:{emoji:'🏠',label:'Ипотека'}, auto:{emoji:'🚗',label:'Автокредит'}, consumer:{emoji:'💰',label:'Потребительский'}, card:{emoji:'💳',label:'Карта'}, other:{emoji:'📄',label:'Прочее'} };
let credits = [], cards = [];
let editMode = false, editId = null;
let selectedCreditId = null, selectedCat = 'mortgage', dateMode = 'cal';
let theme = 'light', amountsVisible = true, fontSize = 'm';
let hapticEnabled = true, notifEnabled = false, notifDays = 1, overdueEnabled = true, biometricEnabled = false;
let searchQuery = '', sortBy = 'day';
let allPaidShown = sessionStorage.getItem('all_paid_shown') === '1';
let lockPanelOpen = false, backPressedOnce = false, _isSaving = false;
let pinSetBuf = '', pinSetStep = 0, pinSetFirst = '', pinSetLen = 4, pinSetVerifyMode = null;
let pinLockBuf = '', pinLockLen = 4;
let isLoginMode = true, authResolved = false;
window.authUser = null;
let splashTimerDone = false, creditsUnsubscribe = null, historyUnsubscribe = null;
let paymentHistory = [], monthResetDone = false, settingsSnapshot = null, _bioAutoTried = false;
let pendingAction = null;
const ls = { get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}}, set:(k,v)=>{try{localStorage.setItem(k,v);return true;}catch(e){return false;}}, rm:k=>{try{localStorage.removeItem(k);}catch(e){}} };
// ========== ВИБРАЦИЯ ==========
let _userTapped = false, _vibeWarned = false;
document.addEventListener('touchstart', function(){ _userTapped = true; }, { once: true, passive: true });
document.addEventListener('pointerdown', function(){ _userTapped = true; }, { passive: true, capture: true });
function haptic(pattern) {
if (!hapticEnabled || !_userTapped) return;
if (!('vibrate' in navigator)) { if (!_vibeWarned) { _vibeWarned = true; showToast('Вибрация не поддерживается этим браузером'); } return; }
try { navigator.vibrate(pattern || 20); } catch(e) {}
}
function testVibro() {
_userTapped = true;
if (!hapticEnabled) { showToast('Сначала включите виброотклик'); return; }
if (!('vibrate' in navigator)) { showToast('Вибрация не поддерживается этим браузером'); return; }
try { navigator.vibrate([80,40,80,40,120]); showToast('📳 Вибрация работает'); } catch(e) { showToast('Не удалось вызвать вибрацию'); }
}
// ========== ТАЙМАУТЫ / АНТИ-ОФЛАЙН ==========
function withTimeout(p, ms, code) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => { const e = new Error('timeout'); e.code = code || 'timeout'; rej(e); }, ms))]); }
let _netDisabled = false;
function guardNetwork(err) {
if (err && err.code === 'unavailable' && db && !_netDisabled) {
_netDisabled = true; try { db.disableNetwork().catch(()=>{}); } catch(e) {}
showToast('📴 Нет связи — офлайн-режим');
setTimeout(() => { _netDisabled = false; try { if (db) db.enableNetwork().catch(()=>{}); } catch(e) {} }, 60000);
}
}
window.addEventListener('offline', () => { if (db && !_netDisabled) { _netDisabled = true; try { db.disableNetwork().catch(()=>{}); } catch(e) {} showToast('📴 Офлайн-режим'); } });
window.addEventListener('online', () => { if (db) { _netDisabled = false; try { db.enableNetwork().catch(()=>{}); } catch(e) {} showToast('🟢 Снова в сети'); } });
// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function formatPaymentDate(d){ const m=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']; return `до ${d} ${m[new Date().getMonth()]}`; }
function fmt(n){ return Math.round(n).toLocaleString('ru-RU'); }
function esc(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function showToast(msg){ document.querySelectorAll('.toast').forEach(t=>t.remove()); const d=document.createElement('div'); d.className='toast'; d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2200); }
function showGlobalLoader(show) { document.getElementById('globalLoader').style.display = show ? 'flex' : 'none'; }
function getPeriodKeyForToday(resetDay) {
const n = new Date(); const today = n.getDate(); const month = n.getMonth(); const year = n.getFullYear();
const rd = resetDay || 1;
if (today >= rd) return `${month}-${year}`;
const pm = month === 0 ? 11 : month - 1; const py = month === 0 ? year - 1 : year;
return `${pm}-${py}`;
}
function getCardPaymentDate(c) {
if (!c.day) return '';
const rd = c.resetDay || c.day || 1; const now = new Date();
const pm = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= rd ? 1 : 0), 1);
const m = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
return `до ${c.day} ${m[pm.getMonth()]}`;
}
function getOverdueDays(c) {
if (c.paid || c.completed) return 0;
const today = new Date().getDate(); const d = c.day || 1;
return today > d ? today - d : 0;
}
// ========== ИСТОРИЯ (одна запись на кредит в месяц) ==========
function _mk(){ const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function _histId(creditId){ return `${authUser.uid}_${creditId}_${_mk()}`; }
async function histUpsert(creditId, name, type, amount) {
if (!db || !authUser) return;
try { await db.collection('paymentHistory').doc(_histId(creditId)).set({ userId: authUser.uid, creditId, creditName: name, type, amount: amount||0, month: _mk(), createdAt: new Date().toISOString() }, { merge: true }); } catch(e) {}
}
async function histRemoveIf(creditId, types) {
if (!db || !authUser) return;
try { const ref = db.collection('paymentHistory').doc(_histId(creditId)); const doc = await ref.get(); if (doc.exists && types.includes(doc.data().type)) await ref.delete(); } catch(e) {}
}
async function logEvent(creditId, name, type, amount) {
if (!db || !authUser) return;
try { await db.collection('paymentHistory').add({ userId: authUser.uid, creditId: creditId||null, creditName: name||'', type, amount: amount||0, month: _mk(), createdAt: new Date().toISOString() }); } catch(e) {}
}
function loadHistory() {
if (!authUser || !db) return;
if (historyUnsubscribe) { historyUnsubscribe(); historyUnsubscribe = null; }
historyUnsubscribe = db.collection('paymentHistory').where('userId', '==', authUser.uid)
.onSnapshot(snap => {
paymentHistory = [];
snap.forEach(doc => paymentHistory.push({ id: doc.id, ...doc.data() }));
paymentHistory.sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
if (document.getElementById('historyOverlay').classList.contains('active')) renderHistory();
}, err => guardNetwork(err));
}
function openHistory() { renderHistory(); document.getElementById('historyOverlay').classList.add('active'); }
function closeHistory() { document.getElementById('historyOverlay').classList.remove('active'); }
function renderHistory() {
const list = document.getElementById('historyList'); const clearBtn = document.getElementById('historyClearBtn');
list.innerHTML = '';
if (!paymentHistory.length) { list.innerHTML = '<div class="history-empty">📜 История пуста<br>Платежи появятся здесь автоматически</div>'; clearBtn.style.display = 'none'; return; }
clearBtn.style.display = '';
const groups = {};
paymentHistory.forEach(item => {
let key = item.month; if (!key) { const d = new Date(item.createdAt); key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
if (!groups[key]) groups[key] = [];
groups[key].push(item);
});
const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
const [y, m] = key.split('-').map(Number);
const label = document.createElement('div'); label.className = 'history-group-label'; label.textContent = `${monthNames[m-1]} ${y}`;
list.appendChild(label);
groups[key].forEach(item => {
const d = new Date(item.createdAt); const el = document.createElement('div'); el.className = 'history-item';
let icon = '💳', sub = '', amountClass = '', amountText = '';
switch(item.type) {
case 'paid_full': icon = '✅'; sub = 'Оплачено (последняя отметка)'; amountClass = 'minus'; amountText = '-' + fmt(item.amount) + ' ₽'; break;
case 'partial': icon = '💰'; sub = 'Частичный взнос'; amountClass = 'minus'; amountText = '-' + fmt(item.amount) + ' ₽'; break;
case 'card_payment': icon = '💳'; sub = 'Платёж по карте'; amountText = item.amount ? fmt(item.amount) + ' ₽' : ''; break;
case 'created': icon = '➕'; sub = 'Создан'; amountText = item.amount ? fmt(item.amount) + ' ₽' : ''; break;
case 'deleted': icon = '🗑'; sub = 'Удалён'; break;
default: sub = item.note || '';
}
const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
el.innerHTML = `<div class="history-icon">${icon}</div><div class="history-main"><div class="history-title">${esc(item.creditName || 'Кредит')}</div><div class="history-sub">${esc(sub)}</div></div><div class="history-right">${amountText ? `<div class="history-amount ${amountClass}">${amountText}</div>` : ''}<div class="history-time">${dd}.${String(d.getMonth()+1).padStart(2,'0')} · ${hh}:${mm}</div></div>`;
list.appendChild(el);
});
});
}
async function clearHistory() {
if (!db || !authUser) return;
if (!confirm('Очистить всю историю платежей?')) return;
try { const snap = await db.collection('paymentHistory').where('userId', '==', authUser.uid).get(); const batch = db.batch(); snap.forEach(doc => batch.delete(doc.ref)); await batch.commit(); showToast('История очищена'); closeHistory(); } catch(e) { showToast('Ошибка: ' + e.message); }
}
// ========== ЗАГРУЗКА ==========
function loadCredits() {
if (!authUser || !db) return;
showGlobalLoader(true);
if (creditsUnsubscribe) { creditsUnsubscribe(); creditsUnsubscribe = null; }
creditsUnsubscribe = db.collection('credits').where('userId', '==', authUser.uid)
.onSnapshot(snapshot => {
credits = []; cards = [];
snapshot.forEach(doc => { const d = doc.data(); if (d.type === 'creditcard') cards.push({ id: doc.id, ...d }); else credits.push({ id: doc.id, ...d }); });
render(); renderCards();
if (!monthResetDone) { monthResetDone = true; checkMonthReset(); }
showGlobalLoader(false);
checkUpcomingNotifications();
}, e => { showGlobalLoader(false); guardNetwork(e); });
loadHistory();
}
async function deleteCredit(id){ if (!db) return; await withTimeout(db.collection('credits').doc(id).delete(), 8000).catch(()=>{}); }
async function updateCreditField(id,data){ if (!db) return; await withTimeout(db.collection('credits').doc(id).update(data), 8000).catch(()=>{}); }
async function checkMonthReset(){
if (!authUser || !db) return;
let updatedCount = 0;
for (const c of credits) {
if (c.completed) continue;
const currentKey = getPeriodKeyForToday(c.resetDay || 1);
if (c.lastResetMonth === currentKey) continue;
const updates = { lastResetMonth: currentKey };
if (c.lastResetMonth) { updates.paid = false; updates.partial = 0; updatedCount++; }
await updateCreditField(c.id, updates);
}
for (const c of cards) {
const rd = c.resetDay || c.day || 1;
const currentKey = getPeriodKeyForToday(rd);
if (c.lastResetMonth === currentKey) continue;
const updates = { lastResetMonth: currentKey };
if (c.lastResetMonth) { updates.donePayments = 0; updatedCount++; }
await updateCreditField(c.id, updates);
}
if (updatedCount > 0) { const m = document.getElementById('resetMsg'); m.style.display = 'block'; setTimeout(() => m.style.display = 'none', 5000); }
ls.set(MONTH_K, `${new Date().getMonth()}-${new Date().getFullYear()}`);
}
// ========== УВЕДОМЛЕНИЯ ==========
async function requestNotificationPermission() {
if (!('Notification' in window)) { showToast('Уведомления не поддерживаются в этом браузере'); return false; }
if (Notification.permission === 'granted') return true;
if (Notification.permission === 'denied') { showToast('Уведомления заблокированы в настройках браузера'); return false; }
try { return await Notification.requestPermission() === 'granted'; } catch(e) { return false; }
}
async function showAppNotification(title, body, tag) {
if (!('Notification' in window) || Notification.permission !== 'granted') return;
try {
if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
const reg = await navigator.serviceWorker.ready;
await reg.showNotification(title, { body, icon: './icon.png', badge: './icon.png', tag: tag || 'default' });
} else new Notification(title, { body, icon: './icon.png', tag });
} catch(e) { try { new Notification(title, { body }); } catch(ee) {} }
}
function checkUpcomingNotifications() {
if (!notifEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
const now = new Date(); const todayKey = now.toDateString(); const today = now.getDate();
if (notifEnabled && ls.get('crt_last_notif_date') !== todayKey) {
const upcoming = [];
credits.forEach(c => { if (c.completed || c.paid) return; const diff = (c.day||1) - today; if (diff >= 0 && diff <= notifDays) upcoming.push({ name: c.name, amount: c.amount, when: diff === 0 ? 'сегодня' : `через ${diff} дн.` }); });
cards.forEach(c => { const done = c.donePayments||0; const eff = (c.payments||0) > 0 ? c.payments : 1; if (done >= eff) return; const diff = (c.day||1) - today; if (diff >= 0 && diff <= notifDays) upcoming.push({ name: c.name, amount: c.amount, when: diff === 0 ? 'сегодня' : `через ${diff} дн.` }); });
if (upcoming.length) {
const total = upcoming.reduce((s,u) => s + (u.amount||0), 0);
const names = upcoming.slice(0,3).map(u => `${u.name} (${u.when})`).join(', ');
const more = upcoming.length > 3 ? ` и ещё ${upcoming.length-3}` : '';
showAppNotification('💰 Напоминание о платежах', `${names}${more}${total ? `\nВсего: ${fmt(total)} ₽` : ''}`, 'daily-reminder');
ls.set('crt_last_notif_date', todayKey);
}
}
if (overdueEnabled && ls.get('crt_last_overdue_date') !== todayKey) {
const od = [];
credits.forEach(c => { const d = getOverdueDays(c); if (d > 0) od.push({ name: c.name, d }); });
cards.forEach(c => { const done = c.donePayments||0; const eff = (c.payments||0) > 0 ? c.payments : 1; if (done < eff) { const d = getOverdueDays(c); if (d > 0) od.push({ name: c.name, d }); } });
if (od.length) {
showAppNotification('⚠️ Просрочка', od.slice(0,3).map(x => `${x.name}: ${x.d} дн.`).join(', ') + (od.length > 3 ? ` и ещё ${od.length-3}` : ''), 'overdue');
ls.set('crt_last_overdue_date', todayKey);
}
}
}
setInterval(checkUpcomingNotifications, 3600000);
function setNotifDays(n) { notifDays = n; ls.set(NOTIF_DAYS_K, n); updateSettingsUI(); haptic(10); }
function toggleOverdueFromSettings() { overdueEnabled = !overdueEnabled; ls.set(OVERDUE_K, overdueEnabled); updateSettingsUI(); haptic(10); }
async function toggleNotifFromSettings() {
if (!notifEnabled) {
const ok = await requestNotificationPermission();
notifEnabled = ok;
if (ok) { showToast('Уведомления включены'); checkUpcomingNotifications(); }
} else { notifEnabled = false; showToast('Уведомления выключены'); }
ls.set(NOTIF_K, notifEnabled);
updateSettingsUI(); haptic(10);
}
// ========== ПОИСК И СОРТИРОВКА ==========
function onSearch() { searchQuery = (document.getElementById('searchInput').value || '').toLowerCase().trim(); render(); renderCards(); }
function onSort() { sortBy = document.getElementById('sortSelect').value; render(); renderCards(); }
function sortList(arr) {
const a = arr.slice();
const paidLast = (x,y) => (x.paid?1:0) - (y.paid?1:0);
if (sortBy === 'day') a.sort((x,y) => paidLast(x,y) || x.day - y.day);
else if (sortBy === 'amount') a.sort((x,y) => paidLast(x,y) || y.amount - x.amount);
else a.sort((x,y) => paidLast(x,y) || (x.name||'').localeCompare(y.name,'ru'));
return a;
}
// ========== РЕНДЕРИНГ ==========
function render(){
const now = new Date(); const cm = now.getMonth(), cy = now.getFullYear();
let active = credits.filter(c => !c.completed);
if (searchQuery) active = active.filter(c => (c.name||'').toLowerCase().includes(searchQuery));
active = sortList(active);
const completed = credits.filter(c => c.completed);
const list = document.getElementById('creditList'); list.innerHTML = '';
if (!active.length) list.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">${searchQuery ? 'Ничего не найдено' : 'Нет активных кредитов'}</div><div class="empty-sub">${searchQuery ? 'Попробуйте другой запрос' : 'Нажмите + чтобы добавить первый'}</div></div>`;
else { const frag = document.createDocumentFragment(); active.forEach(c => frag.appendChild(buildCreditItem(c, cm, cy))); list.appendChild(frag); }
const compSec = document.getElementById('completedSection');
if (completed.length) { compSec.style.display = ''; document.getElementById('completedLabel').textContent = `Завершённые (${completed.length})`; const compList = document.getElementById('completedList'); if (compList.classList.contains('open')) { compList.innerHTML = ''; const cfrag = document.createDocumentFragment(); completed.forEach(c => cfrag.appendChild(buildCreditItem(c, cm, cy))); compList.appendChild(cfrag); } }
else compSec.style.display = 'none';
document.getElementById('activeCount').textContent = active.length ? `${active.length}` : '';
updateSummary(active);
if (!amountsVisible) setTimeout(startSpoilers, 30);
applyCollapseUI(); attachSwipeHandlers();
}
function buildCreditItem(c, cm, cy){
const partial = c.partial || 0; const remain = Math.max(0, c.amount - partial);
const percent = c.amount > 0 ? (partial / c.amount) * 100 : 0;
let termHtml = '';
if (c.endDate) { const ed = new Date(c.endDate); const ml = (ed.getFullYear() - cy) * 12 + (ed.getMonth() - cm); if (ml <= 0) termHtml = `<span class="credit-term-tag ending">Завершается</span>`; else if (ml <= 3) termHtml = `<span class="credit-term-tag soon">Ещё ${ml} мес.</span>`; else termHtml = `<span class="credit-term-tag ok">${ml} мес.</span>`; }
else termHtml = `<span class="credit-term-tag infinite">Бессрочный</span>`;
const od = getOverdueDays(c);
if (od > 0) termHtml += `<span class="credit-term-tag ending">Просрочено ${od} дн.</span>`;
const cat = CATS[c.category] || CATS.other;
const wrap = document.createElement('div'); wrap.style.background = 'var(--surface)';
const item = document.createElement('div');
item.className = 'credit-item swipeable' + (c.completed ? ' completed' : c.paid ? ' paid' : '');
item.dataset.creditId = c.id; item.dataset.creditType = 'credit';
if (!c.paid && !c.completed && partial > 0) { if (partial >= c.amount) item.classList.add('partial-complete'); else { item.classList.add('partial-bg'); item.style.setProperty('--partial-width', percent + '%'); } }
const displayAmount = c.paid ? fmt(c.amount) : (partial > 0 ? fmt(remain) : fmt(c.amount));
item.innerHTML = `
<div class="swipe-hint hint-left">Редактировать</div>
<div class="swipe-hint hint-right">Удалить</div>
<div class="swipe-content">
<div class="credit-icon-wrap">${cat.emoji}</div>
<div class="credit-main"><div class="credit-name">${esc(c.name)}</div>
<div class="credit-meta"><span class="credit-date-tag">${formatPaymentDate(c.day)}</span>${termHtml}</div></div>
<div class="credit-right"><span class="credit-amount">${displayAmount} ₽</span>
${c.paid ? '<span class="credit-paid-badge">Оплачено</span>' : (partial > 0 ? `<span style="font-size:0.68rem;color:var(--text-2);font-weight:500">из ${fmt(c.amount)} ₽</span>` : '')}</div>
<div class="check-wrap ${c.paid || c.completed ? 'checked' : ''}" data-id="${c.id}">
<svg viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="2.5"><polyline points="2,7 6,11 12,3"/></svg>
</div>
</div>`;
item.addEventListener('click', e => { if (item.dataset.suppressClick === '1') return; if (!c.completed && !e.target.closest('.check-wrap')) openAction(c.id); });
item.querySelector('.check-wrap').addEventListener('click', async e => {
e.stopPropagation();
if (!c.completed) {
const newPaid = !c.paid; haptic(20);
await updateCreditField(c.id, { paid: newPaid, partial: newPaid ? c.amount : 0 });
if (newPaid) histUpsert(c.id, c.name, 'paid_full', c.amount);
else histRemoveIf(c.id, ['paid_full', 'partial']);
haptic([30, 50, 30]);
}
});
wrap.appendChild(item);
return wrap;
}
function updateSummary(active){
const total = active.reduce((s,c) => s + c.amount, 0);
const paidTotalSum = active.reduce((s,c) => s + (c.paid ? c.amount : (c.partial||0)), 0);
const cardsTotal = cards.reduce((s,c) => s + (c.amount||0), 0);
const cardsPaidCount = cards.filter(c => (c.donePayments||0) >= ((c.payments||0) > 0 ? c.payments : 1)).length;
const cardsPaidSum = cards.reduce((s,c) => { const eff = (c.payments||0) > 0 ? c.payments : 1; return s + ((c.donePayments||0) >= eff ? (c.amount||0) : 0); }, 0);
const grandTotal = total + cardsTotal; const grandPaid = paidTotalSum + cardsPaidSum;
const grandRemain = Math.max(0, grandTotal - grandPaid);
const pct = grandTotal > 0 ? Math.floor((grandPaid / grandTotal) * 100) : 0;
document.getElementById('summaryAmount').textContent = fmt(grandRemain) + ' ₽';
document.getElementById('summaryPaid').textContent = `Внесено ${fmt(grandPaid)} ₽`;
document.getElementById('summaryPercent').textContent = pct + '%';
document.getElementById('summaryBarFill').style.width = pct + '%';
document.getElementById('summaryCount').textContent = active.filter(c => c.paid).length + '/' + active.length;
document.getElementById('summaryCardsPaid').textContent = cardsPaidCount + '/' + cards.length;
document.getElementById('summaryTotal').textContent = fmt(grandTotal) + ' ₽';
const allPaidAlreadyShown = sessionStorage.getItem('all_paid_shown') === '1';
const creditsAllPaid = paidTotalSum >= total && total > 0 && active.length > 0;
const cardsAllPaid = cards.length === 0 || cards.every(c => (c.donePayments||0) >= ((c.payments||0) > 1 ? c.payments : 1));
const everythingPaid = creditsAllPaid && cardsAllPaid;
if (everythingPaid && !allPaidShown && !allPaidAlreadyShown) { allPaidShown = true; sessionStorage.setItem('all_paid_shown', '1'); haptic([50,50,50]); setTimeout(() => document.getElementById('allPaidOverlay').classList.add('active'), 400); }
else if (!everythingPaid) allPaidShown = false;
}
// ========== СВАЙПЫ (вправо=редактировать, влево=удалить) ==========
function attachSwipeHandlers() {
document.querySelectorAll('.credit-item.swipeable').forEach(item => {
if (item.dataset.swipeAttached === '1') return;
item.dataset.swipeAttached = '1';
const content = item.querySelector('.swipe-content');
const hintL = item.querySelector('.hint-left'); const hintR = item.querySelector('.hint-right');
if (!content) return;
let startX = 0, startY = 0, currentX = 0, isSwiping = false, direction = null;
item.addEventListener('touchstart', e => { const t = e.touches[0]; startX = t.clientX; startY = t.clientY; currentX = 0; isSwiping = false; direction = null; content.style.transition = 'none'; }, { passive: true });
item.addEventListener('touchmove', e => {
const t = e.touches[0]; const dx = t.clientX - startX; const dy = t.clientY - startY;
if (!isSwiping) { if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) { isSwiping = true; direction = dx > 0 ? 'right' : 'left'; } else if (Math.abs(dy) > 10) return; }
if (isSwiping) { currentX = dx; const clamped = Math.max(-140, Math.min(140, dx)); content.style.transform = `translateX(${clamped}px)`; const prog = Math.min(1, Math.abs(dx) / 90); if (dx > 0) { hintL.style.opacity = prog; hintR.style.opacity = 0; item.style.background = 'rgba(107,107,107,0.10)'; } else { hintR.style.opacity = prog; hintL.style.opacity = 0; item.style.background = 'rgba(230,57,70,0.10)'; } }
}, { passive: true });
item.addEventListener('touchend', async () => {
if (!isSwiping) { content.style.transition = ''; return; }
content.style.transition = 'transform 0.2s ease';
const creditId = item.dataset.creditId; const creditType = item.dataset.creditType;
let acted = false;
if (direction === 'right' && currentX > 80) {
if (creditType === 'card') { const c = cards.find(x => x.id === creditId); if (c) { openEditCard(c); acted = true; } }
else { const c = credits.find(x => x.id === creditId); if (c) { openEditCredit(c); acted = true; } }
if (acted) haptic(20);
} else if (direction === 'left' && currentX < -80) {
if (confirm('Удалить этот элемент?')) {
const src = creditType === 'card' ? cards : credits; const found = src.find(x => x.id === creditId);
await db.collection('credits').doc(creditId).delete().catch(()=>{});
logEvent(creditId, found ? found.name : '', 'deleted', 0);
haptic([15, 30, 15]); showToast('Удалено'); acted = true;
}
}
if (acted) { item.dataset.suppressClick = '1'; setTimeout(() => { delete item.dataset.suppressClick; }, 500); }
content.style.transform = ''; hintL.style.opacity = 0; hintR.style.opacity = 0; item.style.background = '';
setTimeout(() => { content.style.transition = ''; }, 220);
});
});
}
// ========== ДЕЙСТВИЯ С КРЕДИТОМ ==========
function openAction(id){
const c = credits.find(x => x.id === id); if (!c) return;
selectedCreditId = id;
const cat = CATS[c.category] || CATS.other;
document.getElementById('actionNameText').textContent = cat.emoji + ' ' + c.name;
document.getElementById('actionSub').textContent = fmt(c.amount) + ' ₽ · ' + formatPaymentDate(c.day);
const noteBox = document.getElementById('actionNote');
if (c.note) { noteBox.style.display = ''; noteBox.textContent = '📝 ' + c.note; } else noteBox.style.display = 'none';
const partial = c.partial || 0;
document.getElementById('partialPaidDisplay').textContent = fmt(partial) + ' ₽';
document.getElementById('partialRemainDisplay').textContent = fmt(Math.max(0, c.amount - partial)) + ' ₽';
document.getElementById('partialInput').value = '';
const ps = document.getElementById('partialSection'); const rb = document.getElementById('resetPartialBtn');
if (c.paid || c.completed) { ps.style.display = 'none'; rb.style.display = 'none'; } else { ps.style.display = ''; rb.style.display = partial > 0 ? '' : 'none'; }
document.getElementById('actionOverlay').classList.add('active');
}
function addQuickAmount(a) { const i = document.getElementById('partialInput'); i.value = (parseFloat(i.value) || 0) + a; }
async function resetPartial(){
const c = credits.find(x => x.id === selectedCreditId);
if (c && !c.paid && !c.completed) { await updateCreditField(c.id, { partial: 0 }); histRemoveIf(c.id, ['partial']); closeAction(); showToast('Частичная оплата сброшена'); haptic(15); }
}
function closeAction(){ document.getElementById('actionOverlay').classList.remove('active'); }
async function savePartial(){
const c = credits.find(x => x.id === selectedCreditId); if (!c) return;
const inp = parseFloat(document.getElementById('partialInput').value);
if (!inp || inp <= 0) { showToast('Введите сумму'); return; }
haptic(20);
const newPartial = Math.min(c.amount, (c.partial||0) + inp); const newPaid = newPartial >= c.amount;
await updateCreditField(c.id, { partial: newPartial, paid: newPaid });
if (newPaid) histUpsert(c.id, c.name, 'paid_full', c.amount); else histPartial(c.id, c.name, inp);
closeAction(); haptic([30, 50, 30]);
}
function openEditCredit(c){
editMode = true; editId = c.id;
document.getElementById('nameInput').value = c.name;
document.getElementById('amountInput').value = c.amount;
document.getElementById('dayInput').value = c.day;
document.getElementById('resetDayInput').value = c.resetDay || '';
document.getElementById('noteInput').value = c.note || '';
selectCat(c.category);
if (c.endDate) { setDateMode('cal'); document.getElementById('endDateCal').value = c.endDate; }
document.getElementById('formTitleText').innerText = 'Редактировать';
document.getElementById('formSaveBtn').innerText = 'Сохранить';
document.getElementById('formOverlay').classList.add('active'); updateFab(true);
}
function openEdit(){ const c = credits.find(x => x.id === selectedCreditId); if (!c) return; closeAction(); openEditCredit(c); }
function showDeleteConfirm(){ closeAction(); setTimeout(() => document.getElementById('deleteOverlay').classList.add('active'), 100); }
function closeDelete(){ document.getElementById('deleteOverlay').classList.remove('active'); }
async function doDelete(){ if(selectedCreditId){ const c = credits.find(x => x.id === selectedCreditId); await deleteCredit(selectedCreditId); logEvent(selectedCreditId, c ? c.name : 'Кредит', 'deleted', 0); showToast('Удалено'); haptic(15); } closeDelete(); selectedCreditId = null; }
// ========== ФОРМА ==========
function toggleForm(){ const ov = document.getElementById('formOverlay'); if (!ov.classList.contains('active')) { ov.classList.add('active'); updateFab(true); } else closeForm(); }
function closeForm(){ document.getElementById('formOverlay').classList.remove('active'); updateFab(false); resetForm(); _isSaving = false; }
function resetForm(){
editMode = false; editId = null;
document.getElementById('nameInput').value = ''; document.getElementById('amountInput').value = ''; document.getElementById('dayInput').value = ''; document.getElementById('resetDayInput').value = ''; document.getElementById('noteInput').value = ''; document.getElementById('endDateCal').value = '';
document.getElementById('formTitleText').innerText = 'Новый кредит'; document.getElementById('formSaveBtn').innerText = 'Добавить'; document.getElementById('formSaveBtn').disabled = false;
selectCat('mortgage'); setDateMode('cal');
}
async function handleSave(){
if (_isSaving) return;
if (!db) { showToast('База данных недоступна'); return; }
const name = document.getElementById('nameInput').value.trim();
const amount = parseFloat(document.getElementById('amountInput').value);
const day = parseInt(document.getElementById('dayInput').value);
const note = document.getElementById('noteInput').value.trim();
if (!name) { showToast('Введите название'); return; }
if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
if (!day || day < 1 || day > 31) { showToast('День оплаты: 1–31'); return; }
const isEdit = editMode; const saveId = editId; const saveCat = selectedCat; const endDate = getEndDate();
const resetDay = parseInt(document.getElementById('resetDayInput').value) || null;
_isSaving = true; const saveBtn = document.getElementById('formSaveBtn'); saveBtn.disabled = true; saveBtn.textContent = 'Сохранение...';
try {
const currentMonthKey = getPeriodKeyForToday(resetDay || 1);
const creditData = { name, amount, day, category: saveCat, endDate, resetDay: resetDay || null, note: note || null };
if (isEdit && saveId) { creditData.userId = authUser.uid; await withTimeout(db.collection('credits').doc(saveId).update(creditData), 10000); showToast('Кредит обновлён'); }
else { creditData.paid = false; creditData.completed = false; creditData.partial = 0; creditData.lastResetMonth = currentMonthKey; creditData.createdAt = new Date().toISOString(); creditData.userId = authUser.uid; await withTimeout(db.collection('credits').add(creditData), 10000); logEvent(null, name, 'created', amount); showToast('Кредит добавлен'); }
haptic(20); closeForm(); resetForm();
} catch (e) { console.error(e); showToast(e.code === 'timeout' ? 'Сервер не отвечает. Попробуйте ещё раз' : 'Ошибка сохранения'); }
finally { _isSaving = false; saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Сохранить' : 'Добавить'; }
}
function selectCat(cat){ selectedCat = cat; document.querySelectorAll('.cat-item').forEach(el => el.classList.toggle('selected', el.dataset.cat === cat)); }
function setDateMode(m){ dateMode = m; document.getElementById('dtBtnCal').classList.toggle('active', m === 'cal'); document.getElementById('dtBtnMan').classList.toggle('active', m === 'man'); document.getElementById('calInput').classList.toggle('active', m === 'cal'); document.getElementById('manInput').classList.toggle('active', m === 'man'); }
function getEndDate(){
if (dateMode === 'cal') return document.getElementById('endDateCal').value || null;
const mo = document.getElementById('endMonth').value; const yr = document.getElementById('endYear').value;
return (mo !== '' && yr) ? `${yr}-${String(parseInt(mo)+1).padStart(2, '0')}-01` : null;
}
function fabClick(e){ e.stopPropagation(); const menu = document.getElementById('fabMenu'); if (menu.classList.contains('active')) { closeFabMenu(); return; } document.getElementById('fab').classList.add('active'); menu.classList.add('active'); document.getElementById('fabMenuBackdrop').classList.add('active'); haptic(10); }
function closeFabMenu(){ document.getElementById('fab').classList.remove('active'); document.getElementById('fabMenu').classList.remove('active'); document.getElementById('fabMenuBackdrop').classList.remove('active'); }
function openCreditForm(){ closeFabMenu(); toggleForm(); }
function updateFab(active){ document.getElementById('fab').classList.toggle('active', active); }
// ========== КАРТЫ ==========
let selectedCardId = null, cardEditMode = false, cardEditId = null, _isCardSaving = false;
function updateCardPaymentDots(){
const n = parseInt(document.getElementById('cardPaymentsInput').value) || 0;
const preview = document.getElementById('cardDotsPreview'); const wrap = document.getElementById('cardDotsWrap');
if (n < 1 || n > 99) { preview.style.display = 'none'; return; }
preview.style.display = ''; wrap.innerHTML = '';
for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'payment-dot'; wrap.appendChild(d); }
}
function openCardForm(){
closeFabMenu(); cardEditMode = false; cardEditId = null;
document.getElementById('cardNameInput').value = ''; document.getElementById('cardAmountInput').value = ''; document.getElementById('cardPaymentsInput').value = ''; document.getElementById('cardDayInput').value = ''; document.getElementById('cardResetDayInput').value = '';
document.getElementById('cardDotsPreview').style.display = 'none';
document.getElementById('cardFormTitle').textContent = 'Кредитная карта'; document.getElementById('cardSaveBtn').textContent = 'Добавить карту';
document.getElementById('cardFormOverlay').classList.add('active');
}
function closeCardForm(){ document.getElementById('cardFormOverlay').classList.remove('active'); _isCardSaving = false; }
async function handleCardSave(){
if (_isCardSaving) return;
if (!db || !authUser) { showToast('Нет подключения'); return; }
const name = document.getElementById('cardNameInput').value.trim();
if (!name) { showToast('Введите название карты'); return; }
const amount = parseFloat(document.getElementById('cardAmountInput').value) || 0;
const payments = parseInt(document.getElementById('cardPaymentsInput').value) || 0;
const day = parseInt(document.getElementById('cardDayInput').value) || 0;
const resetDay = parseInt(document.getElementById('cardResetDayInput').value) || null;
_isCardSaving = true; const btn = document.getElementById('cardSaveBtn'); btn.disabled = true; btn.textContent = 'Сохранение...';
const wasEditMode = cardEditMode, wasEditId = cardEditId;
try {
const effectiveResetDay = resetDay || day || 1; const currentMonthKey = getPeriodKeyForToday(effectiveResetDay);
const cardData = { name, amount, payments, day, resetDay: resetDay || null, userId: authUser.uid, type: 'creditcard' };
if (wasEditMode && wasEditId) { await withTimeout(db.collection('credits').doc(wasEditId).update(cardData), 10000); showToast('Карта обновлена'); }
else { cardData.donePayments = 0; cardData.lastResetMonth = currentMonthKey; cardData.createdAt = new Date().toISOString(); await withTimeout(db.collection('credits').add(cardData), 10000); logEvent(null, name, 'created', amount); showToast('Карта добавлена'); }
haptic(20); closeCardForm();
} catch(e) { console.error(e); showToast(e.code === 'timeout' ? 'Сервер не отвечает' : 'Ошибка: ' + (e.message || 'неизвестная ошибка')); }
finally { _isCardSaving = false; btn.disabled = false; btn.textContent = wasEditMode ? 'Сохранить' : 'Добавить карту'; }
}
function openCardAction(id){
const c = cards.find(x => x.id === id); if (!c) return;
selectedCardId = id;
document.getElementById('cardActionName').textContent = '💳 ' + c.name;
const subs = []; if (c.amount > 0) subs.push(fmt(c.amount) + ' ₽'); if (c.day > 0) subs.push(getCardPaymentDate(c));
document.getElementById('cardActionSub').textContent = subs.join(' · ');
renderCardActionDots(c);
document.getElementById('cardActionOverlay').classList.add('active');
}
function closeCardAction(){ document.getElementById('cardActionOverlay').classList.remove('active'); }
function renderCardActionDots(c){
const wrap = document.getElementById('cardActionDots'); const progressWrap = document.getElementById('cardActionProgressWrap');
wrap.innerHTML = '';
if (!c.payments || c.payments < 1) { wrap.innerHTML = '<span class="payment-dot-empty">Количество платежей не задано</span>'; progressWrap.style.display = 'none'; return; }
const done = c.donePayments || 0;
for (let i = 0; i < c.payments; i++) { const d = document.createElement('div'); d.className = 'payment-dot' + (i < done ? ' done' : ''); d.onclick = () => toggleCardPayment(c.id, i, c.payments, c.donePayments || 0); wrap.appendChild(d); }
progressWrap.style.display = '';
const pct = Math.round((done / c.payments) * 100);
document.getElementById('cardActionProgressFill').style.width = pct + '%';
document.getElementById('cardActionProgressText').textContent = `Выполнено ${done} из ${c.payments}`;
document.getElementById('cardActionProgressPct').textContent = pct + '%';
}
async function toggleCardPayment(cardId, idx, total, currentDone){
haptic(10);
const newDone = idx < currentDone ? idx : idx + 1;
await db.collection('credits').doc(cardId).update({ donePayments: newDone }).catch(()=>{});
const c = cards.find(x => x.id === cardId);
if (newDone > currentDone) histUpsert(cardId, c ? c.name : 'Карта', 'card_payment', c ? c.amount : 0);
else if (newDone === 0) histRemoveIf(cardId, ['card_payment']);
closeCardAction(); if (newDone >= total) haptic([30, 50, 30]);
}
async function resetCardPayments(){
if (!selectedCardId) return;
const c = cards.find(x => x.id === selectedCardId);
const rd = c ? (c.resetDay || c.day || 1) : 1;
await db.collection('credits').doc(selectedCardId).update({ donePayments: 0, lastResetMonth: getPeriodKeyForToday(rd) }).catch(()=>{});
histRemoveIf(selectedCardId, ['card_payment']);
closeCardAction(); haptic(15);
}
function openEditCard(c){
cardEditMode = true; cardEditId = c.id;
document.getElementById('cardNameInput').value = c.name; document.getElementById('cardAmountInput').value = c.amount || ''; document.getElementById('cardPaymentsInput').value = c.payments || ''; document.getElementById('cardDayInput').value = c.day || ''; document.getElementById('cardResetDayInput').value = c.resetDay || '';
document.getElementById('cardFormTitle').textContent = 'Редактировать карту'; document.getElementById('cardSaveBtn').textContent = 'Сохранить';
updateCardPaymentDots();
document.getElementById('cardFormOverlay').classList.add('active');
}
function openCardEdit(){ const c = cards.find(x => x.id === selectedCardId); if (!c) return; closeCardAction(); openEditCard(c); }
function showCardDeleteConfirm(){ closeCardAction(); setTimeout(() => document.getElementById('cardDeleteOverlay').classList.add('active'), 100); }
function closeCardDelete(){ document.getElementById('cardDeleteOverlay').classList.remove('active'); }
async function doCardDelete(){ if(selectedCardId){ const c = cards.find(x => x.id === selectedCardId); await db.collection('credits').doc(selectedCardId).delete().catch(()=>{}); logEvent(selectedCardId, c ? c.name : 'Карта', 'deleted', 0); showToast('Карта удалена'); haptic(15); } closeCardDelete(); selectedCardId = null; }
function renderCards(){
const section = document.getElementById('cardsSection'); const list = document.getElementById('cardList');
let shown = cards;
if (searchQuery) shown = shown.filter(c => (c.name||'').toLowerCase().includes(searchQuery));
document.getElementById('cardsCount').textContent = shown.length ? `${shown.length}` : '';
if (!shown.length) { section.style.display = searchQuery ? '' : 'none'; if (searchQuery) { list.innerHTML = ''; } return; }
section.style.display = '';
list.innerHTML = '';
const frag = document.createDocumentFragment();
shown.forEach(c => {
const done = c.donePayments || 0; const total = c.payments || 0; const effectiveTotal = total > 0 ? total : 1;
const isPaid = done >= effectiveTotal; const hasMultiPayments = total > 1;
const wrap = document.createElement('div'); wrap.style.background = 'var(--surface)';
const item = document.createElement('div');
item.className = 'credit-item swipeable' + (isPaid ? ' paid' : '');
item.dataset.creditId = c.id; item.dataset.creditType = 'card';
const od = getOverdueDays(c);
const dueTag = (c.day > 0 ? `<span class="credit-date-tag">${getCardPaymentDate(c)}</span>` : '') + (od > 0 && !isPaid ? `<span class="credit-term-tag ending">Просрочено ${od} дн.</span>` : '');
const amtHtml = c.amount > 0 ? `<span class="credit-amount">${fmt(c.amount)} ₽</span>` : '';
const badgeHtml = isPaid ? '<span class="credit-paid-badge">Оплачено</span>' : '';
const controlsHtml = hasMultiPayments ? `<div class="card-pay-row" onclick="event.stopPropagation()"><button class="card-ctrl-btn minus" style="visibility:${done > 0 ? 'visible' : 'hidden'}" onclick="cardPaymentStep('${c.id}', ${done}, ${total}, -1)">−</button><span class="card-ctrl-count">${done}/${total}</span><button class="card-ctrl-btn plus" style="visibility:${done < total ? 'visible' : 'hidden'}" onclick="cardPaymentStep('${c.id}', ${done}, ${total}, 1)">+</button></div>` : '';
item.innerHTML = `
<div class="swipe-hint hint-left">Редактировать</div>
<div class="swipe-hint hint-right">Удалить</div>
<div class="swipe-content">
<div class="credit-main card-main-row"><div class="card-name-col"><div class="credit-name">${esc(c.name)}</div><div class="credit-meta">${dueTag}</div></div>${controlsHtml}</div>
<div class="credit-right">${amtHtml}${badgeHtml}</div>
<div class="check-wrap ${isPaid ? 'checked' : ''}" data-id="${c.id}"><svg viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="2.5"><polyline points="2,7 6,11 12,3"/></svg></div>
</div>`;
item.querySelector('.check-wrap').addEventListener('click', e => { e.stopPropagation(); if (item.dataset.suppressClick === '1') return; toggleCardFull(c.id, total, done); });
item.addEventListener('click', () => { if (item.dataset.suppressClick === '1') return; openCardAction(c.id); });
wrap.appendChild(item); frag.appendChild(wrap);
});
list.appendChild(frag);
if (!amountsVisible) setTimeout(startSpoilers, 30);
attachSwipeHandlers();
}
async function toggleCardFull(cardId, total, currentDone) {
haptic(20);
const effectiveTotal = total > 0 ? total : 1;
const newDone = currentDone >= effectiveTotal ? 0 : effectiveTotal;
await db.collection('credits').doc(cardId).update({ donePayments: newDone }).catch(()=>{});
const c = cards.find(x => x.id === cardId);
if (newDone > currentDone) histUpsert(cardId, c ? c.name : 'Карта', 'card_payment', c ? c.amount : 0);
else histRemoveIf(cardId, ['card_payment']);
haptic([30, 50, 30]);
}
async function cardPaymentStep(cardId, currentDone, total, delta) {
const newDone = Math.max(0, Math.min(total, currentDone + delta));
if (newDone === currentDone) return;
haptic(10);
try {
await db.collection('credits').doc(cardId).update({ donePayments: newDone });
const c = cards.find(x => x.id === cardId);
if (delta > 0) histUpsert(cardId, c ? c.name : 'Карта', 'card_payment', c ? c.amount : 0);
else if (newDone === 0) histRemoveIf(cardId, ['card_payment']);
if (newDone >= total) haptic([30, 50, 30]);
} catch(e) { console.error(e); showToast('Ошибка обновления'); }
}
// ========== НАСТРОЙКИ ==========
function gearClick(e) { e.stopPropagation(); const btn = document.getElementById('settingsBtn'); const svg = btn.querySelector('svg'); svg.style.animation = 'none'; svg.offsetHeight; svg.style.animation = ''; btn.classList.add('spinning'); haptic(15); setTimeout(() => { btn.classList.remove('spinning'); openSettings(); }, 520); }
function openSettings(){
if (authUser) { const display = authUser.displayName || authUser.email.split('@')[0]; document.getElementById('settingsDisplayName').textContent = display; document.getElementById('settingsEmail').textContent = authUser.email || '—'; updateEmailStatusUI(); }
takeSettingsSnapshot(); updateSettingsUI();
document.getElementById('settingsOverlay').classList.add('active');
}
function closeSettings(){ document.getElementById('settingsOverlay').classList.remove('active'); }
function takeSettingsSnapshot(){ settingsSnapshot = { theme, amountsVisible, fontSize, collapseEnabled }; }
function saveSettings(){
ls.set(THEME_K, theme); ls.set(AMT_K, amountsVisible); ls.set(FONT_K, fontSize); ls.set(COLLAPSE_K, collapseEnabled);
showToast('✅ Настройки сохранены'); haptic(25);
closeSettings();
}
function cancelSettings(){
if (settingsSnapshot) { theme = settingsSnapshot.theme; amountsVisible = settingsSnapshot.amountsVisible; fontSize = settingsSnapshot.fontSize; collapseEnabled = settingsSnapshot.collapseEnabled; applyTheme(); applyAmounts(); applyFont(); applyCollapseUI(); updateSettingsUI(); }
closeSettings();
}
function loadTheme(){ const t = ls.get(THEME_K); if (t) theme = t; applyTheme(); }
function applyTheme(){ document.documentElement.setAttribute('data-theme', theme); if (!amountsVisible) { stopSpoilers(); startSpoilers(); } }
function toggleThemeFromSettings(){ theme = theme === 'light' ? 'dark' : 'light'; applyTheme(); updateSettingsUI(); haptic(10); }
function loadAmounts(){ const v = ls.get(AMT_K); if (v !== null) amountsVisible = v === 'true'; applyAmounts(); }
function applyAmounts(){ document.body.classList.toggle('amounts-hidden', !amountsVisible); if (!amountsVisible) startSpoilers(); else stopSpoilers(); }
function toggleAmountsFromSettings(){ amountsVisible = !amountsVisible; applyAmounts(); updateSettingsUI(); haptic(10); }
const fontScales = { s:0.87, m:1, l:1.14 };
function loadFontSize(){ const f = ls.get(FONT_K); if (f && fontScales[f]) fontSize = f; applyFont(); }
function applyFont(){ document.documentElement.style.fontSize = (16 * fontScales[fontSize]) + 'px'; }
function setFontSize(s){ fontSize = s; applyFont(); if (!amountsVisible) { stopSpoilers(); startSpoilers(); } updateSettingsUI(); haptic(10); }
function loadHaptic(){ const v = ls.get(HAPTIC_K); if (v !== null) hapticEnabled = v === 'true'; }
function toggleHapticFromSettings(){
hapticEnabled = !hapticEnabled; ls.set(HAPTIC_K, hapticEnabled); _userTapped = true;
if (hapticEnabled) { if (!('vibrate' in navigator)) showToast('Вибрация не поддерживается в этом браузере'); else { try { navigator.vibrate([80,40,80]); } catch(e) {} showToast('Проверьте вибрацию'); } }
updateSettingsUI();
}
function loadNotif(){ const v = ls.get(NOTIF_K); if (v !== null) notifEnabled = v === 'true'; const d = parseInt(ls.get(NOTIF_DAYS_K)); if (d) notifDays = d; const o = ls.get(OVERDUE_K); if (o !== null) overdueEnabled = o === 'true'; }
function loadBiometric(){ const v = ls.get(BIO_K); if (v !== null) biometricEnabled = v === 'true'; }
async function toggleBiometric() {
if (!biometricEnabled) { const available = await isBiometricAvailable(); if (!available) { showToast('Биометрия недоступна на этом устройстве'); return; } const ok = await registerBiometric(); if (ok) { biometricEnabled = true; ls.set(BIO_K, 'true'); showToast('✅ Биометрия включена'); } }
else { biometricEnabled = false; ls.rm(BIO_K); ls.rm('crt_bio_cred_id'); showToast('Биометрия отключена'); }
updateSettingsUI(); haptic(15);
}
function updateSettingsUI(){
const tt = document.getElementById('themeSwitchTrack'); if (theme === 'dark') tt.classList.add('dark-on'); else tt.classList.remove('dark-on');
const at = document.getElementById('amountsSwitchTrack'); if (!amountsVisible) at.classList.add('dark-on'); else at.classList.remove('dark-on');
const ht = document.getElementById('hapticSwitchTrack'); if (hapticEnabled) ht.classList.add('dark-on'); else ht.classList.remove('dark-on');
const nt = document.getElementById('notifSwitchTrack'); if (notifEnabled) nt.classList.add('dark-on'); else nt.classList.remove('dark-on');
const ot = document.getElementById('overdueTrack'); if (overdueEnabled) ot.classList.add('dark-on'); else ot.classList.remove('dark-on');
document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.days) === notifDays));
const notifStatus = document.getElementById('notifStatus');
if (notifStatus) {
if (!('Notification' in window)) notifStatus.textContent = 'Не поддерживается в этом браузере';
else if (Notification.permission === 'denied') notifStatus.textContent = 'Заблокировано в браузере';
else if (notifEnabled) notifStatus.textContent = notifDays === 1 ? 'За 1 день до платежа' : `За ${notifDays} дн. до платежа`;
else notifStatus.textContent = 'Выключено';
}
document.querySelectorAll('.font-step').forEach(el => el.classList.toggle('active', el.getAttribute('data-size') === fontSize));
const hasPin = !!ls.get(PIN_K);
document.getElementById('lockStatusTitle').textContent = hasPin ? 'ПИН-код установлен' : 'Защита не установлена';
document.getElementById('lockStatusSub').textContent = hasPin ? 'Нажмите для изменения' : 'Нажмите для настройки';
document.getElementById('removeLockBtn').style.display = hasPin ? '' : 'none';
const bioBtn = document.getElementById('biometricBtn');
if (bioBtn) { bioBtn.style.display = hasPin ? '' : 'none'; bioBtn.textContent = biometricEnabled ? '🔐 Биометрия ✓' : '🔐 Включить биометрию'; }
}
// ========== СВОРАЧИВАНИЕ ==========
let collapseEnabled = false, activeCollapsed = false, cardsCollapsed = false;
const COLLAPSE_ACTIVE_K = 'crt_collapse_active_v1', COLLAPSE_CARDS_K = 'crt_collapse_cards_v1';
function loadCollapse(){ collapseEnabled = ls.get(COLLAPSE_K) === 'true'; activeCollapsed = ls.get(COLLAPSE_ACTIVE_K) === 'true'; cardsCollapsed = ls.get(COLLAPSE_CARDS_K) === 'true'; applyCollapseUI(); }
function toggleCollapseFromSettings(){ collapseEnabled = !collapseEnabled; ls.set(COLLAPSE_K, collapseEnabled); if (!collapseEnabled) { activeCollapsed = false; cardsCollapsed = false; ls.set(COLLAPSE_ACTIVE_K, false); ls.set(COLLAPSE_CARDS_K, false); } applyCollapseUI(); updateSettingsUI(); haptic(10); }
function applyCollapseUI(){
const activeHeader = document.getElementById('activeSectionHeader'); const activeArrow = document.getElementById('activeArrow'); const creditList = document.getElementById('creditList'); const activeSection = activeHeader && activeHeader.closest('.section');
if (activeHeader && activeArrow && creditList) {
if (collapseEnabled) { activeHeader.style.cursor = 'pointer'; activeArrow.style.display = ''; activeHeader.onclick = toggleActiveSection; creditList.style.display = activeCollapsed ? 'none' : ''; activeArrow.style.transform = activeCollapsed ? 'rotate(-90deg)' : ''; if (activeSection) activeSection.classList.toggle('list-hidden', activeCollapsed); }
else { activeHeader.style.cursor = 'default'; activeArrow.style.display = 'none'; activeHeader.onclick = null; creditList.style.display = ''; if (activeSection) activeSection.classList.remove('list-hidden'); }
}
const cardsHeader = document.getElementById('cardsSectionHeader'); const cardsArrow = document.getElementById('cardsArrow'); const cardList = document.getElementById('cardList'); const cardsSection = cardsHeader && cardsHeader.closest('.section');
if (cardsHeader && cardsArrow && cardList) {
if (collapseEnabled) { cardsHeader.style.cursor = 'pointer'; cardsArrow.style.display = ''; cardsHeader.onclick = toggleCardsSection; cardList.style.display = cardsCollapsed ? 'none' : ''; cardsArrow.style.transform = cardsCollapsed ? 'rotate(-90deg)' : ''; if (cardsSection) cardsSection.classList.toggle('list-hidden', cardsCollapsed); }
else { cardsHeader.style.cursor = 'default'; cardsArrow.style.display = 'none'; cardsHeader.onclick = null; cardList.style.display = ''; if (cardsSection) cardsSection.classList.remove('list-hidden'); }
}
const ct = document.getElementById('collapseSwitchTrack'); if (ct) ct.classList.toggle('dark-on', collapseEnabled);
}
function toggleActiveSection(){ if (!collapseEnabled) return; activeCollapsed = !activeCollapsed; ls.set(COLLAPSE_ACTIVE_K, activeCollapsed); applyCollapseUI(); haptic(10); }
function toggleCardsSection(){ if (!collapseEnabled) return; cardsCollapsed = !cardsCollapsed; ls.set(COLLAPSE_CARDS_K, cardsCollapsed); applyCollapseUI(); haptic(10); }
function updateEmailStatusUI() {
if (!authUser) return;
const indicator = document.getElementById('emailStatusIndicator'); const verifyBtn = document.getElementById('verifyEmailBtn');
if (authUser.emailVerified) { indicator.innerHTML = '<span>✓</span> Почта подтверждена'; indicator.className = 'email-status verified'; if (verifyBtn) verifyBtn.style.display = 'none'; }
else { indicator.innerHTML = '<span>⚠️</span> Почта не подтверждена'; indicator.className = 'email-status unverified'; if (verifyBtn) verifyBtn.style.display = 'flex'; }
}
// ========== АУТЕНТИФИКАЦИЯ ==========
async function resolveEmailFromNick(nick) { if (!db) return null; try { const doc = await db.collection('usernames').doc(nick.toLowerCase()).get(); if (doc.exists && doc.data().email) return doc.data().email; return null; } catch(e) { return null; } }
async function sendVerificationEmail() {
if (!authUser) return;
if (authUser.emailVerified) { showToast('Почта уже подтверждена'); updateEmailStatusUI(); return; }
try { await authUser.sendEmailVerification({ url: window.location.origin + window.location.pathname, handleCodeInApp: false }); showToast('Письмо отправлено!'); }
catch(e) { if (e.code === 'auth/too-many-requests') showToast('Слишком много запросов'); else showToast('Ошибка отправки'); }
}
async function doAuth() {
if (!db || !auth) { showToast('Ошибка соединения'); return; }
const pass = document.getElementById('authPassword').value;
const login = document.getElementById('authName').value.trim();
const confirmPass = document.getElementById('authConfirmPassword')?.value.trim();
if (isLoginMode) {
const loginOrEmail = document.getElementById('authEmailOrNick').value.trim();
if (!loginOrEmail || !pass) { showToast('Заполните все поля'); return; }
const btn = document.getElementById('authBtn'); btn.disabled = true; btn.textContent = 'Подождите...';
try {
let email = loginOrEmail;
if (!loginOrEmail.includes('@')) { const resolved = await resolveEmailFromNick(loginOrEmail); if (!resolved) { showToast('Не найден'); btn.disabled = false; btn.textContent = 'Войти'; return; } email = resolved; }
const userCred = await withTimeout(auth.signInWithEmailAndPassword(email, pass), 20000, 'signin');
const user = userCred.user;
db.collection('users').doc(user.uid).set({ email: user.email, displayName: user.displayName, emailVerified: user.emailVerified }, { merge: true }).catch(()=>{});
if (user.displayName) db.collection('usernames').doc(user.displayName.toLowerCase()).set({ uid: user.uid, email: user.email }, { merge: true }).catch(()=>{});
const isNewDevice = !sessionStorage.getItem('session_started');
if (isNewDevice) { ls.rm(PIN_K); ls.rm(PIN_LEN_K); }
} catch(e) {
let msg = 'Ошибка';
if (e.code === 'timeout') msg = 'Сервер не отвечает. Проверьте интернет';
else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Неверный email/логин или пароль';
else if (e.code === 'auth/invalid-email') msg = 'Некорректный email';
else if (e.code === 'auth/network-request-failed') msg = 'Нет сети или заблокировано';
else msg = e.message;
showToast(msg); btn.disabled = false; btn.textContent = 'Войти';
}
return;
}
const email = document.getElementById('authEmailOrNick').value.trim();
if (!email) { showToast('Введите email'); return; }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Некорректный email'); return; }
if (!login) { showToast('Введите логин'); return; }
if (!pass || !confirmPass) { showToast('Введите пароль'); return; }
if (pass !== confirmPass) { showToast('Пароли не совпадают'); return; }
if (pass.length < 6) { showToast('Мин. 6 символов'); return; }
if (!login.match(/^[a-zA-Z0-9_]{3,20}$/)) { showToast('Логин: 3-20 символов'); return; }
const btn = document.getElementById('authBtn'); btn.disabled = true; btn.textContent = 'Создание...';
let createdUser = null;
try {
const userCred = await withTimeout(auth.createUserWithEmailAndPassword(email, pass), 20000, 'signup');
createdUser = userCred.user;
const loginLower = login.toLowerCase(); const usernameRef = db.collection('usernames').doc(loginLower);
try { await withTimeout(db.runTransaction(async (transaction) => { const doc = await transaction.get(usernameRef); if (doc.exists) throw new Error('Логин уже занят'); transaction.set(usernameRef, { uid: createdUser.uid, email: email }); }), 15000); }
catch (txError) { await createdUser.delete(); throw txError; }
await createdUser.updateProfile({ displayName: login });
db.collection('users').doc(createdUser.uid).set({ email, displayName: login, emailVerified: false }).catch(()=>{});
createdUser.sendEmailVerification({ url: window.location.origin + window.location.pathname, handleCodeInApp: false }).catch(()=>{});
showToast('✅ Аккаунт создан!');
await auth.signOut();
isLoginMode = true;
document.getElementById('authTitle').textContent = 'Войти в аккаунт'; document.getElementById('authBtn').textContent = 'Войти'; document.getElementById('authBtn').disabled = false;
document.getElementById('authNameField').style.display = 'none'; document.getElementById('authConfirmField').style.display = 'none'; document.getElementById('authEmailOrNick').style.display = 'block';
document.querySelector('.auth-switch-link').innerHTML = 'Нет аккаунта? <span>Зарегистрироваться</span>';
document.getElementById('emailFieldLabel').textContent = 'Email или Логин'; document.getElementById('authEmailOrNick').placeholder = 'email@example.com или ваш логин'; document.getElementById('authEmailOrNick').value = email;
} catch(e) {
let msg = 'Ошибка';
if (e.code === 'timeout') msg = 'Сервер не отвечает. Попробуйте ещё раз';
else if (e.message === 'Логин уже занят') msg = 'Логин уже занят';
else if (e.code === 'auth/email-already-in-use') msg = 'Email уже используется';
else if (e.code === 'auth/invalid-email') msg = 'Некорректный email';
else if (e.code === 'auth/weak-password') msg = 'Слабый пароль';
else msg = e.message;
showToast(msg); btn.disabled = false; btn.textContent = 'Зарегистрироваться';
}
}
async function doLogout(){
if (creditsUnsubscribe) { creditsUnsubscribe(); creditsUnsubscribe = null; }
if (historyUnsubscribe) { historyUnsubscribe(); historyUnsubscribe = null; }
await auth.signOut(); closeSettings();
sessionStorage.removeItem('pin_ok'); sessionStorage.removeItem('session_started'); sessionStorage.removeItem('all_paid_shown');
monthResetDone = false; credits = []; cards = []; paymentHistory = []; allPaidShown = false;
render(); renderCards();
document.getElementById('authEmailOrNick').value = ''; document.getElementById('authPassword').value = ''; document.getElementById('authConfirmPassword').value = ''; document.getElementById('authName').value = '';
isLoginMode = true;
document.getElementById('authTitle').textContent = 'Войти в аккаунт'; document.getElementById('authBtn').textContent = 'Войти'; document.getElementById('authBtn').disabled = false;
document.getElementById('authNameField').style.display = 'none'; document.getElementById('authConfirmField').style.display = 'none'; document.getElementById('authEmailOrNick').style.display = 'block';
document.querySelector('.auth-switch-link').innerHTML = 'Нет аккаунта? <span>Зарегистрироваться</span>';
document.getElementById('emailFieldLabel').textContent = 'Email или Логин'; document.getElementById('authEmailOrNick').placeholder = 'email@example.com или ваш логин';
document.getElementById('app').classList.remove('visible'); document.getElementById('authScreen').style.display = 'flex';
}
function toggleAuthMode(){
isLoginMode = !isLoginMode;
document.getElementById('authTitle').textContent = isLoginMode ? 'Войти в аккаунт' : 'Создать аккаунт';
document.getElementById('authBtn').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
document.getElementById('authBtn').disabled = false;
document.getElementById('authNameField').style.display = isLoginMode ? 'none' : 'flex';
document.getElementById('authConfirmField').style.display = isLoginMode ? 'none' : 'flex';
document.getElementById('authEmailOrNick').style.display = 'block';
const emailInput = document.getElementById('authEmailOrNick'); const emailLabel = document.getElementById('emailFieldLabel');
if (isLoginMode) { emailInput.type = 'text'; emailInput.placeholder = 'email@example.com или ваш логин'; emailLabel.textContent = 'Email или Логин'; }
else { emailInput.type = 'email'; emailInput.placeholder = 'email@example.com'; emailLabel.textContent = 'Email'; }
document.querySelector('.auth-switch-link').innerHTML = isLoginMode ? 'Нет аккаунта? <span>Зарегистрироваться</span>' : 'Уже есть аккаунт? <span>Войти</span>';
document.getElementById('authPassword').value = ''; document.getElementById('authConfirmPassword').value = ''; document.getElementById('authName').value = '';
if (!isLoginMode) emailInput.value = '';
}
// ========== АККАУНТ ==========
function openEditAccount() { closeSettings(); setTimeout(() => { if (authUser) { document.getElementById('editNickname').value = authUser.displayName || ''; document.getElementById('editOldPass').value = ''; document.getElementById('editNewPass').value = ''; document.getElementById('editConfirmPass').value = ''; } document.getElementById('editAccountOverlay').classList.add('active'); }, 200); }
function closeEditAccount() { document.getElementById('editAccountOverlay').classList.remove('active'); }
async function saveAccountChanges() {
if (!db) { showToast('Нет связи'); return; }
const newNick = document.getElementById('editNickname').value.trim();
const oldPass = document.getElementById('editOldPass').value; const newPass = document.getElementById('editNewPass').value; const confirmPass = document.getElementById('editConfirmPass').value;
if (!authUser) return;
let updates = [];
if (newNick && newNick !== authUser.displayName) {
const newNickLower = newNick.toLowerCase();
if (!newNick.match(/^[a-zA-Z0-9_]{3,20}$/)) { showToast('Логин: 3-20 символов'); return; }
const existing = await db.collection('usernames').doc(newNickLower).get();
if (existing.exists && existing.data().uid !== authUser.uid) { showToast('Логин занят'); return; }
if (authUser.displayName) await db.collection('usernames').doc(authUser.displayName.toLowerCase()).delete();
await db.collection('usernames').doc(newNickLower).set({ uid: authUser.uid, email: authUser.email });
updates.push(authUser.updateProfile({ displayName: newNick })); updates.push(db.collection('users').doc(authUser.uid).update({ displayName: newNick }));
}
if (newPass) {
if (newPass.length < 6) { showToast('Мин. 6 символов'); return; }
if (newPass !== confirmPass) { showToast('Пароли не совпадают'); return; }
if (!oldPass) { showToast('Введите текущий пароль'); return; }
const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, oldPass);
try { await authUser.reauthenticateWithCredential(credential); updates.push(authUser.updatePassword(newPass)); } catch(e) { showToast('Неверный пароль'); return; }
}
try { await Promise.all(updates); showToast('Профиль обновлён'); closeEditAccount(); if (authUser.displayName) document.getElementById('settingsDisplayName').textContent = authUser.displayName; else document.getElementById('settingsDisplayName').textContent = authUser.email.split('@')[0]; updateEmailStatusUI(); } catch(e) { showToast('Ошибка: ' + e.message); }
}
function openDeleteAccount() { closeSettings(); setTimeout(() => { document.getElementById('deleteAccPass').value = ''; document.getElementById('deleteAccountOverlay').classList.add('active'); }, 200); }
function closeDeleteAccount() { document.getElementById('deleteAccountOverlay').classList.remove('active'); }
async function doDeleteAccount() {
if (!db) { showToast('Нет связи'); return; }
const pass = document.getElementById('deleteAccPass').value;
if (!pass) { showToast('Введите пароль'); return; }
if (!authUser) return;
try {
const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, pass);
await authUser.reauthenticateWithCredential(credential);
const uid = authUser.uid; const displayName = authUser.displayName;
const creditsSnap = await db.collection('credits').where('userId', '==', uid).get();
const histSnap = await db.collection('paymentHistory').where('userId', '==', uid).get();
const batch = db.batch();
creditsSnap.forEach(doc => batch.delete(doc.ref)); histSnap.forEach(doc => batch.delete(doc.ref));
if (displayName) batch.delete(db.collection('usernames').doc(displayName.toLowerCase()));
batch.delete(db.collection('users').doc(uid));
await batch.commit(); await authUser.delete();
if (creditsUnsubscribe) { creditsUnsubscribe(); creditsUnsubscribe = null; }
if (historyUnsubscribe) { historyUnsubscribe(); historyUnsubscribe = null; }
sessionStorage.removeItem('pin_ok'); sessionStorage.removeItem('session_started'); sessionStorage.removeItem('all_paid_shown');
ls.rm(PIN_K); ls.rm(PIN_LEN_K); ls.rm(BIO_K); ls.rm('crt_bio_cred_id');
monthResetDone = false; credits = []; cards = []; window.authUser = null; allPaidShown = false;
closeDeleteAccount(); document.getElementById('app').classList.remove('visible'); document.getElementById('authScreen').style.display = 'flex';
showToast('Аккаунт удалён');
} catch(e) { if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') showToast('Неверный пароль'); else showToast('Ошибка: ' + e.message); }
}
// ========== ПИН + БИОМЕТРИЯ ==========
async function hashPin(pin) { const encoder = new TextEncoder(); const data = encoder.encode(pin + PIN_SALT); const hashBuffer = await crypto.subtle.digest('SHA-256', data); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); }
function buildPinDots(cId, count, pfx){ const el = document.getElementById(cId); el.innerHTML = ''; for (let i = 0; i < count; i++) { const d = document.createElement('div'); d.className = 'pin-dot'; d.id = pfx + i; el.appendChild(d); } }
function fillPinDots(cId, pfx, filled, count){ for (let i = 0; i < count; i++) { const d = document.getElementById(pfx + i); if (d) { d.classList.toggle('filled', i < filled); d.classList.remove('error'); } } }
function shakePinDots(cId, pfx, count){ for (let i = 0; i < count; i++) { const d = document.getElementById(pfx + i); if (d) d.classList.add('error'); } const el = document.getElementById(cId); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); }
function unlockSuccess(){
sessionStorage.setItem('pin_ok', '1'); sessionStorage.setItem('session_started', '1');
document.getElementById('pinLockOverlay').classList.remove('active');
document.getElementById('app').classList.add('visible');
haptic([40, 60, 40]);
loadCredits(); runPendingAction();
}
function selectPinLen(n){ pinSetLen = n; document.querySelectorAll('.pin-len-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === n)); pinSetBuf = ''; buildPinDots('pinSetDots', n, 'sd'); fillPinDots('pinSetDots', 'sd', 0, n); }
async function pinSetKey(v) {
if (pinSetBuf.length >= pinSetLen) return;
pinSetBuf += v; haptic(8); fillPinDots('pinSetDots', 'sd', pinSetBuf.length, pinSetLen);
if (pinSetBuf.length === pinSetLen) {
setTimeout(async () => {
if (pinSetStep === 2) {
const hashed = await hashPin(pinSetBuf);
if (hashed === ls.get(PIN_K)) {
if (pinSetVerifyMode === 'remove') { document.getElementById('pinSetOverlay').classList.remove('active'); _removeLock(); }
else { pinSetBuf = ''; pinSetStep = 0; pinSetVerifyMode = null; document.getElementById('pinSetTitle').textContent = 'Создайте новый ПИН-код'; document.getElementById('pinSetSub').textContent = 'Выберите длину и введите цифры'; document.getElementById('pinLenRow').style.display = ''; pinSetLen = 4; selectPinLen(4); }
} else { document.getElementById('pinSetSub').textContent = 'Неверный ПИН-код'; shakePinDots('pinSetDots', 'sd', pinSetLen); haptic([60,40,60,40,60]); pinSetBuf = ''; setTimeout(() => fillPinDots('pinSetDots', 'sd', 0, pinSetLen), 400); }
} else if (pinSetStep === 0) { pinSetFirst = pinSetBuf; pinSetBuf = ''; pinSetStep = 1; document.getElementById('pinLenRow').style.display = 'none'; document.getElementById('pinSetTitle').textContent = 'Повторите ПИН-код'; document.getElementById('pinSetSub').textContent = `Введите ${pinSetLen} цифр ещё раз`; fillPinDots('pinSetDots', 'sd', 0, pinSetLen); }
else {
if (pinSetBuf === pinSetFirst) { const hashed = await hashPin(pinSetBuf); ls.set(PIN_K, hashed); ls.set(PIN_LEN_K, String(pinSetLen)); document.getElementById('pinSetOverlay').classList.remove('active'); updateSettingsUI(); showToast('ПИН-код установлен'); haptic([40,60,40]); lockPanelOpen = false; document.getElementById('lockButtons').style.display = 'none'; document.getElementById('lockStatusRow').classList.remove('open'); }
else { document.getElementById('pinSetSub').textContent = 'Коды не совпадают'; shakePinDots('pinSetDots', 'sd', pinSetLen); haptic([60,40,60,40,60]); pinSetBuf = ''; pinSetStep = 0; pinSetFirst = ''; document.getElementById('pinLenRow').style.display = ''; buildPinDots('pinSetDots', pinSetLen, 'sd'); setTimeout(() => fillPinDots('pinSetDots', 'sd', 0, pinSetLen), 400); }
}
}, 100);
}
}
function pinSetDel(){ pinSetBuf = pinSetBuf.slice(0, -1); fillPinDots('pinSetDots', 'sd', pinSetBuf.length, pinSetLen); }
function openNewPin(){ pinSetBuf = ''; pinSetStep = 0; pinSetFirst = ''; pinSetLen = 4; pinSetVerifyMode = null; document.getElementById('pinSetTitle').textContent = 'Создайте ПИН-код'; document.getElementById('pinSetSub').textContent = 'Выберите длину и введите цифры'; document.getElementById('pinLenRow').style.display = ''; buildPinDots('pinSetDots', pinSetLen, 'sd'); document.getElementById('pinSetOverlay').classList.add('active'); }
function openPinVerify(title, sub){ pinSetBuf = ''; pinSetStep = 2; const len = parseInt(ls.get(PIN_LEN_K)) || 4; pinSetLen = len; document.getElementById('pinSetTitle').textContent = title; document.getElementById('pinSetSub').textContent = sub; document.getElementById('pinLenRow').style.display = 'none'; buildPinDots('pinSetDots', len, 'sd'); document.getElementById('pinSetOverlay').classList.add('active'); }
function cancelPinSet(){ document.getElementById('pinSetOverlay').classList.remove('active'); pinSetBuf = ''; pinSetStep = 0; pinSetVerifyMode = null; }
function openPinLock(){
pinLockLen = parseInt(ls.get(PIN_LEN_K)) || 4; pinLockBuf = '';
document.getElementById('pinLockSub').textContent = 'Для входа в приложение';
buildPinDots('pinLockDots', pinLockLen, 'ld'); fillPinDots('pinLockDots', 'ld', 0, pinLockLen);
document.getElementById('pinLockOverlay').classList.add('active');
checkShowBiometricLogin();
_bioAutoTried = false;
setTimeout(() => { if (!_bioAutoTried && document.getElementById('pinLockOverlay').classList.contains('active')) { _bioAutoTried = true; tryBiometricUnlock(); } }, 400);
}
async function tryBiometricUnlock() { if (!(biometricEnabled && ls.get('crt_bio_cred_id'))) return; if (!(await isBiometricAvailable())) return; const ok = await verifyBiometric(); if (ok) unlockSuccess(); }
async function pinLockKey(v){
if (pinLockBuf.length >= pinLockLen) return;
pinLockBuf += v; haptic(8); fillPinDots('pinLockDots', 'ld', pinLockBuf.length, pinLockLen);
if (pinLockBuf.length === pinLockLen) {
setTimeout(async () => {
const hashed = await hashPin(pinLockBuf);
if (hashed === ls.get(PIN_K)) unlockSuccess();
else { document.getElementById('pinLockSub').textContent = 'Неверный ПИН-код'; shakePinDots('pinLockDots', 'ld', pinLockLen); haptic([60,40,60,40,60]); pinLockBuf = ''; setTimeout(() => { document.getElementById('pinLockSub').textContent = 'Для входа в приложение'; fillPinDots('pinLockDots', 'ld', 0, pinLockLen); }, 500); }
}, 100);
}
}
function pinLockDel(){ pinLockBuf = pinLockBuf.slice(0, -1); fillPinDots('pinLockDots', 'ld', pinLockBuf.length, pinLockLen); }
function startSetPin(){ const s = ls.get(PIN_K); if (s) { pinSetVerifyMode = 'change'; openPinVerify('Введите текущий ПИН', 'Для смены защиты'); } else openNewPin(); }
function doRemoveLock(){ const s = ls.get(PIN_K); if (s) { pinSetVerifyMode = 'remove'; openPinVerify('Подтвердите удаление', 'Введите текущий ПИН-код'); } else _removeLock(); }
function _removeLock(){ ls.rm(PIN_K); ls.rm(PIN_LEN_K); ls.rm(BIO_K); ls.rm('crt_bio_cred_id'); biometricEnabled = false; lockPanelOpen = false; document.getElementById('lockButtons').style.display = 'none'; document.getElementById('lockStatusRow').classList.remove('open'); updateSettingsUI(); showToast('Защита снята'); }
function toggleLockPanel(){ lockPanelOpen = !lockPanelOpen; document.getElementById('lockButtons').style.display = lockPanelOpen ? '' : 'none'; document.getElementById('lockStatusRow').classList.toggle('open', lockPanelOpen); haptic(10); }
// ========== БИОМЕТРИЯ ==========
async function isBiometricAvailable() { if (!window.PublicKeyCredential) return false; try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch(e) { return false; } }
async function registerBiometric() {
try {
const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
const userId = new Uint8Array(16); crypto.getRandomValues(userId);
const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { name: 'Мои Кредиты' }, user: { id: userId, name: authUser ? authUser.email : 'user', displayName: authUser ? (authUser.displayName || authUser.email) : 'User' }, pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }], authenticatorSelection: { userVerification: 'preferred' }, timeout: 60000 } });
if (credential) { ls.set('crt_bio_cred_id', btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))); return true; }
return false;
} catch(e) { showToast('Не удалось зарегистрировать биометрию'); return false; }
}
async function verifyBiometric() {
const credId = ls.get('crt_bio_cred_id'); if (!credId) return false;
try { const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0)); const challenge = new Uint8Array(32); crypto.getRandomValues(challenge); await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ id: rawId, type: 'public-key' }], userVerification: 'preferred', timeout: 60000 } }); return true; } catch(e) { return false; }
}
async function doBiometricLogin() {
const btn = document.getElementById('biometricLoginBtn'); btn.disabled = true;
const ok = await verifyBiometric(); btn.disabled = false;
if (ok) { unlockSuccess(); showToast('✅ Вход выполнен'); } else { showToast('Биометрия не распознана'); haptic([60,40,60,40,60]); }
}
async function checkShowBiometricLogin() { const btn = document.getElementById('biometricLoginBtn'); if (!btn) return; if (biometricEnabled && ls.get('crt_bio_cred_id') && (await isBiometricAvailable())) btn.style.display = ''; else btn.style.display = 'none'; }
// ========== СПОЙЛЕРЫ ==========
let spoilerRAF = null; const spoilerMap = new Map();
function makeDotColor(){ const dark = theme === 'dark'; const v = dark ? (160 + Math.random() * 90) | 0 : (50 + Math.random() * 80) | 0; return `rgba(${v},${v},${v},${(0.08 + Math.random() * 0.22).toFixed(2)})`; }
function initSpoilerCanvas(el){ if (el.querySelector('.spoiler-canvas')) return; const cv = document.createElement('canvas'); cv.className = 'spoiler-canvas'; el.appendChild(cv); const r = el.getBoundingClientRect(); cv.width = r.width + 8; cv.height = r.height + 4; const count = Math.ceil((cv.width * cv.height) / 6); const pts = []; for (let i = 0; i < count; i++) pts.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 0.5 + Math.random() * 1.1, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, color: makeDotColor() }); spoilerMap.set(cv, pts); }
function animateSpoilers(){ document.querySelectorAll('.spoiler-canvas').forEach(cv => { const pts = spoilerMap.get(cv); if (!pts) return; const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = cv.width; else if (p.x > cv.width) p.x = 0; if (p.y < 0) p.y = cv.height; else if (p.y > cv.height) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); }); }); spoilerRAF = requestAnimationFrame(animateSpoilers); }
function startSpoilers(){ document.querySelectorAll('.credit-amount,.total-val,.s-amount,.s-paid-val,.s-remain-val').forEach(initSpoilerCanvas); if (!spoilerRAF) spoilerRAF = requestAnimationFrame(animateSpoilers); }
function stopSpoilers(){ if (spoilerRAF) { cancelAnimationFrame(spoilerRAF); spoilerRAF = null; } document.querySelectorAll('.spoiler-canvas').forEach(cv => { spoilerMap.delete(cv); cv.remove(); }); }
// ========== ЗАВЕРШЁННЫЕ ==========
function toggleCompleted(){ const list = document.getElementById('completedList'); const arrow = document.getElementById('completedArrow'); const open = !list.classList.contains('open'); list.classList.toggle('open', open); arrow.classList.toggle('open', open); if (open) { const cm = new Date().getMonth(), cy = new Date().getFullYear(); list.innerHTML = ''; const frag = document.createDocumentFragment(); credits.filter(c => c.completed).forEach(c => frag.appendChild(buildCreditItem(c, cm, cy))); list.appendChild(frag); } }
function closeAllPaid(){ document.getElementById('allPaidOverlay').classList.remove('active'); }
// ========== БЫСТРЫЕ ДЕЙСТВИЯ (shortcuts) ==========
function runPendingAction(){
if (!pendingAction) return;
const a = pendingAction; pendingAction = null;
try { history.replaceState(null, '', location.pathname); } catch(e) {}
setTimeout(() => { if (a === 'add') openCreditForm(); else if (a === 'history') openHistory(); }, 500);
}
// ========== ЗАПУСК ==========
function evaluateLaunch(){
if (!authResolved || !splashTimerDone) return;
document.getElementById('splash').classList.add('hidden');
if (window.authUser) {
document.getElementById('authScreen').style.display = 'none';
const hasPin = ls.get(PIN_K);
if (hasPin && !sessionStorage.getItem('pin_ok')) { openPinLock(); }
else { sessionStorage.setItem('pin_ok', '1'); sessionStorage.setItem('session_started', '1'); document.getElementById('app').classList.add('visible'); loadCredits(); runPendingAction(); }
} else { document.getElementById('app').classList.remove('visible'); document.getElementById('authScreen').style.display = 'flex'; }
}
function setupBackBtn(){
document.addEventListener('backbutton', () => {
if (document.getElementById('historyOverlay').classList.contains('active')) { closeHistory(); return; }
if (document.getElementById('editAccountOverlay').classList.contains('active')) { closeEditAccount(); return; }
if (document.getElementById('deleteAccountOverlay').classList.contains('active')) { closeDeleteAccount(); return; }
if (document.getElementById('cardDeleteOverlay').classList.contains('active')) { closeCardDelete(); return; }
if (document.getElementById('cardActionOverlay').classList.contains('active')) { closeCardAction(); return; }
if (document.getElementById('cardFormOverlay').classList.contains('active')) { closeCardForm(); return; }
if (document.getElementById('deleteOverlay').classList.contains('active')) { closeDelete(); return; }
if (document.getElementById('actionOverlay').classList.contains('active')) { closeAction(); return; }
if (document.getElementById('formOverlay').classList.contains('active')) { closeForm(); return; }
if (document.getElementById('settingsOverlay').classList.contains('active')) { cancelSettings(); return; }
if (document.getElementById('fabMenu').classList.contains('active')) { closeFabMenu(); return; }
if (backPressedOnce) { navigator.app && navigator.app.exitApp(); return; }
backPressedOnce = true; showToast('Нажмите ещё раз для выхода'); setTimeout(() => backPressedOnce = false, 2000);
});
}
document.addEventListener('DOMContentLoaded', () => {
try { const p = new URLSearchParams(location.search); const a = p.get('action'); if (a === 'add' || a === 'history') pendingAction = a; } catch(e) {}
loadTheme(); loadFontSize(); loadAmounts(); loadCollapse(); loadHaptic(); loadNotif(); loadBiometric(); setupBackBtn();
selectCat('mortgage'); setDateMode('cal');
document.getElementById('endMonth').value = new Date().getMonth();
document.getElementById('endYear').value = new Date().getFullYear() + 1;
buildPinDots('pinSetDots', 4, 'sd');
function bindPad(padId, keyFn, delId, delFn) {
const pad = document.getElementById(padId); if (!pad) return;
const handle = (btn, e) => { e.preventDefault(); btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 100); const v = btn.getAttribute('data-v'); if (v !== null) keyFn(v); else if (btn.id === delId) delFn(); };
pad.addEventListener('touchstart', e => { const btn = e.target.closest('.pin-key'); if (!btn || btn.classList.contains('empty')) return; handle(btn, e); }, { passive: false });
pad.addEventListener('mousedown', e => { const btn = e.target.closest('.pin-key'); if (!btn || btn.classList.contains('empty')) return; handle(btn, e); });
}
bindPad('pinSetPad', pinSetKey, 'pinSetDel', pinSetDel);
bindPad('pinLockPad', pinLockKey, 'pinLockDel', pinLockDel);
setTimeout(() => { if (!splashTimerDone) { splashTimerDone = true; if (!authResolved) { document.getElementById('splash').classList.add('hidden'); document.getElementById('app').classList.remove('visible'); document.getElementById('authScreen').style.display = 'flex'; } else evaluateLaunch(); } }, 1500);
_initFirebase();
});
window.onerror = function(msg) { console.log('Ошибка: ' + msg); return false; };
document.getElementById('lockStatusRow').onclick = e => { toggleLockPanel(); e.stopPropagation(); };
if ('serviceWorker' in navigator) {
window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js?v=1.2.06').then(reg => reg.update()).catch(() => {}); });
}
const installBtn = document.getElementById('installBtn');
let deferredPrompt = null;
if (window.matchMedia('(display-mode: standalone)').matches) installBtn.style.display = 'none';
else {
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.style.display = 'inline-block'; installBtn.onclick = () => { deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; }); }; });
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { installBtn.style.display = 'inline-block'; installBtn.onclick = () => { alert('Нажмите «Поделиться» → «На экран «Домой»»'); }; }
}