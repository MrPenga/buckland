// Incolla qui la configurazione di Firebase (Impostazioni progetto > Le tue app > Configurazione SDK)
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBxyhfYFy6w-Fv5USAWXB7BGb9gwjflvvc',
  authDomain: 'manzanita-post.firebaseapp.com',
  projectId: 'manzanita-post',
  storageBucket: 'manzanita-post.firebasestorage.app',
  messagingSenderId: '661265400480',
  appId: '1:661265400480:web:ec9127ac34c9472bcfbfc5'
};
let db = null;
if (typeof firebase !== 'undefined') { firebase.initializeApp(FIREBASE_CONFIG); db = firebase.firestore(); }
const cache = {};
const leggi = s => s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.creato || 0) - (b.creato || 0));
async function api(action, sheet, extra = {}) {
  const col = db.collection(sheet);
  if (action === 'list') {
    if (!cache[sheet]) cache[sheet] = leggi(await col.get());
    return { rows: cache[sheet] };
  }
  if (action === 'add') await col.add({ data: new Date().toISOString().slice(0, 10), ...extra.row, creato: Date.now() });
  if (action === 'update') await col.doc(extra.id).update(extra.row);
  if (action === 'delete') await col.doc(extra.id).delete();
  return { ok: 1 };
}
function avvia(carica, sheet) {
  db.collection(sheet).onSnapshot(
    s => { cache[sheet] = leggi(s); carica(); if (sheet === 'Ordini') aggiornaBadgeOrdini(); },
    e => { const el = document.querySelector('#err'); if (el) el.textContent = 'Errore: ' + (e.code === 'permission-denied' ? 'permessi Firestore mancanti (vedi le regole)' : e.message); }
  );
}
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nav(p) {
  // L'intestazione è identica su Ordini, Eventi e Regole.
  setTimeout(initChrome, 0);
  const items = [
    ['index.html','REGISTRO','i','📒','Acquisti e vendite'],
    ['ordini.html','ORDINI','o','📦','Fatture e richieste'],
    ['eventi.html','EVENTI','e','🏆','Gara di pesca'],
    ['regole.html','REGOLE','r','📜','Il regolamento'],
    ['wiki.html','WIKI','w','📚','Ricette e manuale'],
    ['contatti.html','CONTATTI','c','✉','Nomi e missive']
  ];
  return `<nav class="site-quick" aria-label="Navigazione principale">${items.map(([href,label,key,ico,sub]) =>
    `<a href="${href}"${p===key?' class="on"':''}><span class="site-nav-icon">${ico}</span><span class="site-nav-label">${label}</span><small>${sub}</small>${key==='o'?'<span class="site-order-count" data-order-count hidden>0</span>':''}</a>`
  ).join('')}</nav>`;
}
let ordineListenerAttivo = false;
function initChrome(){ aggiornaBadgeOrdini(); }
function aggiornaBadgeOrdini(){
  if(ordineListenerAttivo || !db || !document.querySelector('[data-order-bell], [data-order-count]'))return;
  ordineListenerAttivo=true;
  db.collection('Ordini').onSnapshot(s => {
    const aperti=s.docs.filter(d => {
      const stato=String(d.data().stato || 'Da fare').trim();
      return stato !== 'Consegnato';
    }).length;
    document.querySelectorAll('[data-order-count]').forEach(el=>{
      el.textContent=aperti>99?'99+':String(aperti);
      el.hidden=aperti===0;
    });
    document.querySelectorAll('[data-order-bell]').forEach(el=>{
      el.hidden=aperti===0;
      el.classList.toggle('has-orders',aperti>0);
      el.setAttribute('aria-label',aperti+' ordini ancora da gestire. Apri la pagina ordini');
      const badge=el.querySelector('[data-bell-count]');
      if(badge)badge.textContent=aperti>99?'99+':String(aperti);
    });
  }, error => console.warn('Notifiche ordini non disponibili:', error.code || error.message));
}
