/* Elementi comuni Buckland Angling Club: logo e campanella ordini in tempo reale. */
(function () {
  'use strict';
  const ORDER_FILE='ordini.html';
  const isOrders=location.pathname.split('/').pop().toLowerCase()===ORDER_FILE;
  let lastCount=0;

  function el(tag, cls, attributes={}) {
    const node=document.createElement(tag);
    node.className=cls;
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    return node;
  }
  function decorate() {
    const hero=document.querySelector('.hero > .hero-inner');
    const classic=!hero?document.querySelector('body > header'):null;
    const slot=hero||classic;
    if(!slot || slot.querySelector('.mp-header-tools'))return;
    if(hero){
      const oldLogo=hero.querySelector('.hero-mark');
      if(oldLogo)oldLogo.remove();
    }
    const tools=el('div','mp-header-tools');
    const bell=el('a','mp-bell',{
      href:ORDER_FILE,
      title:'Visualizza gli ordini ancora da gestire',
      'aria-label':'Visualizza gli ordini ancora da gestire'
    });
    bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4M12 2v-1"/></svg>';
    const badge=el('span','mp-order-count');
    badge.setAttribute('aria-hidden','true');
    badge.textContent='0';
    bell.append(badge);
    const logo=el('a','mp-brand',{href:'index.html',title:'Buckland Angling Club - Vai al registro','aria-label':'Buckland Angling Club, logo del grizzly: torna al registro'});
    const image=el('img','',{src:'brand-assets/buckland-angling-club-logo.png',alt:'Buckland Angling Club - logo vittoriano con trota',width:'840',height:'438'});
    logo.append(image);
    if(!isOrders)tools.append(bell);
    tools.append(logo);
    slot.append(tools);
    return bell;
  }
  function update(pending) {
    const bell=document.querySelector('.mp-bell');
    if(!bell)return;
    const number=Math.max(0,Number(pending)||0);
    const hasAny=number>0;
    const numberText=number>99?'99+':String(number);
    bell.classList.toggle('mp-visible',hasAny);
    bell.querySelector('.mp-order-count').textContent=numberText;
    const description=number===1?'1 ordine da gestire':`${number} ordini da gestire`;
    bell.setAttribute('aria-label',description+'. Apri la pagina Ordini');
    bell.title=description;
    if(hasAny&&number>lastCount){
      bell.classList.remove('mp-pulse');
      void bell.offsetWidth;
      bell.classList.add('mp-pulse');
    }
    lastCount=number;
    document.querySelectorAll('a[href]').forEach(a=>{
      try {
        const url=new URL(a.getAttribute('href'),location.href);
        if(url.origin!==location.origin||!url.pathname.endsWith('/'+ORDER_FILE))return;
      } catch (_) {return;}
      if(a.classList.contains('mp-bell')||a.classList.contains('mp-brand'))return;
      a.classList.add('mp-orders-link');
      let navBadge=a.querySelector('.mp-nav-badge');
      if(hasAny){
        if(!navBadge){navBadge=el('span','mp-nav-badge');navBadge.setAttribute('aria-hidden','true');a.append(navBadge);}
        navBadge.textContent=numberText;
        a.title=description;
      } else {
        navBadge?.remove();
        a.removeAttribute('title');
      }
    });
  }
  function listen() {
    // La pagina Ordini mostra gia gli stati di ogni ordine; li segnaliamo nelle altre pagine.
    if(isOrders)return;
    let firestore=null;
    try {
      if(typeof db!=='undefined'&&db)firestore=db;
      else if(typeof firebase!=='undefined'&&firebase.apps?.length)firestore=firebase.firestore();
    } catch (err) {console.warn('Manzanita: impossibile inizializzare le notifiche ordini',err);}
    if(!firestore)return;
    try {
      firestore.collection('Ordini').onSnapshot(snapshot=>{
        let pending=0;
        snapshot.forEach(doc=>{
          const state=String(doc.data().stato??'Da fare').trim().toLowerCase();
          if(state==='da fare'||state==='preparato')pending++;
        });
        update(pending);
      },err=>{
        console.warn('Manzanita: lettura ordini non disponibile',err);
        // Non visualizziamo un numero non verificato quando la lettura fallisce.
        update(0);
      });
    } catch(err){console.warn('Manzanita: notifiche ordini non disponibili',err);}
  }
  function init(){decorate();listen();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
