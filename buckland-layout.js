/* Ledger browsing controls; never modifies item data, prices or totals. */
(() => {
  const search = document.getElementById('ledgerSearch');
  const sections = document.getElementById('sections');
  if (!search || !sections) return;
  const tabs = [...document.querySelectorAll('[data-ledger-filter]')];
  const empty = document.getElementById('ledgerNoResults');
  const count = document.getElementById('selectionCount');
  let filter = 'all';
  const matchText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it');
  function apply() {
    const phrase=matchText(search.value.trim());
    let shown=0;
    for(const block of sections.querySelectorAll('.section-block')) {
      const blockType=block.querySelector('.section-kicker')?.textContent || '';
      const isFish=blockType.toLocaleLowerCase('it').includes('pescato');
      const tabMatch=filter==='all'||(filter==='raccolta'?isFish:!isFish);
      let any=false;
      for(const category of block.querySelectorAll('.category')) {
        let countInCategory=0;
        for(const row of category.querySelectorAll('.row')) {
          const name=row.querySelector('.item-name')?.textContent || '';
          const matches=!phrase || matchText(name).includes(phrase);
          row.hidden = !matches || !tabMatch;
          if(matches && tabMatch)countInCategory++;
        }
        category.hidden=!countInCategory || !tabMatch;
        if(countInCategory && tabMatch) {
          any=true;
          shown+=countInCategory;
          if(phrase || filter!=='all'){category.classList.remove('collapsed');category.querySelector('.category-head')?.setAttribute('aria-expanded','true');}
        }
      }
      block.hidden=!any;
    }
    if(empty)empty.hidden=shown>0;
  }
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    filter=tab.dataset.ledgerFilter;
    tabs.forEach(x=>{const on=x===tab;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});
    apply();
  }));
  search.addEventListener('input',apply);
  search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';apply();search.blur()}});
  document.addEventListener('keydown',e=>{
    const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();search.focus()}
  });
  const updateCount=()=>{
    const items=[...sections.querySelectorAll('.row')].filter(r=>[...r.querySelectorAll('.qty-cube')].some(i=>Number(i.value)>0)).length;
    if(count)count.textContent=items===0?'Nessun articolo selezionato':`${items} articol${items===1?'o':'i'} selezionat${items===1?'o':'i'}`;
  };
  sections.addEventListener('input',updateCount);
  sections.addEventListener('click',()=>requestAnimationFrame(updateCount));
  updateCount();apply();
})();
