/* Rubrica del club: dati su Firestore (Contatti), cache solo per anteprima e modalità locale esplicita. */
(() => {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const list = $('#contactsList');
  const search = $('#contactsSearch');
  const status = $('#status');
  const form = $('#contactForm');
  const editor = $('#contactEditor');
  const addButton = $('#addContact');
  const nameInput = $('#contactName');
  const letterInput = $('#contactLetter');
  const saveButton = $('#saveContact');
  const KEY = 'buckland_contatti_v1';
  const collator = new Intl.Collator('it', { sensitivity: 'base' });
  let contacts = [];
  let editingId = null;
  let mode = db ? 'cloud' : 'local';
  let inProgress = false;

  const escapeHtml = val => String(val ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const saveCache = () => {
    try { localStorage.setItem(KEY, JSON.stringify(contacts)); }
    catch (_) { setStatus('Impossibile scrivere nella memoria del browser.', 'error'); }
  };
  const readCache = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
    } catch (_) { return []; }
  };
  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };
  const sorted = () => [...contacts].sort((a,b) => collator.compare(String(a.nome || ''), String(b.nome || '')));
  function render() {
    $('#contactCount').textContent = contacts.length;
    const term = search.value.trim().toLocaleLowerCase('it');
    const found = sorted().filter(c => (`${c.nome || ''} ${c.missiva || ''}`).toLocaleLowerCase('it').includes(term));
    if (!found.length) {
      list.innerHTML = `<p class="contacts-empty">${contacts.length ? 'Nessun contatto corrisponde alla ricerca.' : 'Nessun contatto registrato. Premi «+ Nuovo contatto» per aggiungerne uno.'}</p>`;
      return;
    }
    list.innerHTML = found.map(c => {
      const initials = String(c.nome || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(n => n[0]).join('').toLocaleUpperCase('it');
      const id = escapeHtml(c.id);
      return `<article class="contact-card">
        <div class="contact-card-top">
          <div class="contact-monogram" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="contact-title"><h4>${escapeHtml(c.nome)}</h4><small>Corrispondenza del club</small></div>
        </div>
        <div class="contact-letter"><span class="contact-letter-label">Missiva / Recapito</span><strong class="contact-letter-value">${escapeHtml(c.missiva)}</strong></div>
        <div class="contact-actions">
          <button type="button" data-action="copy" data-id="${id}" aria-label="Copia la missiva di ${escapeHtml(c.nome)}">Copia</button>
          <button type="button" data-action="edit" data-id="${id}" aria-label="Modifica ${escapeHtml(c.nome)}">Modifica</button>
          <button type="button" class="contact-delete" data-action="delete" data-id="${id}" aria-label="Elimina ${escapeHtml(c.nome)}">✕</button>
        </div>
      </article>`;
    }).join('');
  }
  function showForm(contact = null) {
    editingId = contact ? contact.id : null;
    form.reset();
    nameInput.value = contact?.nome || '';
    letterInput.value = contact?.missiva || '';
    $('#editorHeading').textContent = contact ? 'Modifica un contatto' : 'Aggiungi un contatto';
    saveButton.textContent = contact ? 'Salva modifiche' : 'Salva nel registro';
    editor.hidden = false;
    addButton.setAttribute('aria-expanded', 'true');
    editor.scrollIntoView({behavior:'smooth',block:'nearest'});
    nameInput.focus({preventScroll:true});
  }
  function hideForm() {
    if (inProgress) return;
    editor.hidden = true;
    editingId = null;
    form.reset();
    addButton.setAttribute('aria-expanded', 'false');
    addButton.focus({preventScroll:true});
  }
  function fallbackToLocal(err) {
    mode = 'local';
    setStatus(`Archivio online non disponibile (${err.code === 'permission-denied' ? 'permessi Firestore mancanti' : 'errore di connessione'}). I contatti saranno conservati solo in questo browser, non condivisi fra dispositivi.`, 'error');
  }
  function localMutation(action, id, data) {
    if (action === 'create') contacts.push({id: `local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`, ...data});
    if (action === 'edit') contacts = contacts.map(c => c.id === id ? {...c,...data} : c);
    if (action === 'delete') contacts = contacts.filter(c => c.id !== id);
    saveCache();
    render();
  }
  addButton.addEventListener('click', () => editor.hidden ? showForm() : hideForm());
  $('#closeEditor').addEventListener('click', hideForm);
  $('#cancelEditor').addEventListener('click', hideForm);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !editor.hidden && !inProgress) hideForm(); });
  search.addEventListener('input', render);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (inProgress) return;
    const nome = nameInput.value.trim().replace(/\s+/g, ' ');
    const missiva = letterInput.value.trim();
    if (!nome || !missiva) { setStatus('Inserisci sia il nome che la missiva.', 'error'); return; }
    const payload = {nome, missiva};
    const id = editingId;
    inProgress = true; saveButton.disabled = true;
    try {
      if (mode === 'cloud') {
        if (id === null) await db.collection('Contatti').add({...payload, creato:Date.now()});
        else await db.collection('Contatti').doc(id).update(payload);
        setStatus(id === null ? 'Contatto aggiunto alla rubrica online.' : 'Contatto aggiornato nella rubrica online.', 'ok');
      } else {
        localMutation(id === null ? 'create' : 'edit', id, payload);
        setStatus('Salvato soltanto in questo browser (modalità locale).', 'error');
      }
      inProgress = false;
      saveButton.disabled = false;
      hideForm();
    } catch (err) {
      inProgress = false; saveButton.disabled = false;
      setStatus('Salvataggio non riuscito: ' + (err.code === 'permission-denied' ? 'mancano i permessi Firestore per la raccolta Contatti.' : err.message), 'error');
    }
  });
  list.addEventListener('click', async e => {
    const button = e.target.closest('button[data-action]');
    if (!button || inProgress) return;
    const id = button.dataset.id;
    const c = contacts.find(c => String(c.id) === id);
    if (!c) return;
    switch (button.dataset.action) {
      case 'edit': showForm(c); break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(String(c.missiva));
          setStatus(`Missiva di ${c.nome} copiata negli appunti.`, 'ok');
        } catch (_) { setStatus('Copia non disponibile in questo browser. Seleziona la missiva e copiala manualmente.', 'error'); }
        break;
      case 'delete':
        if (!confirm(`Eliminare il contatto «${c.nome}»?`)) return;
        inProgress = true;
        try {
          if (mode === 'cloud') await db.collection('Contatti').doc(id).delete();
          else localMutation('delete', id);
          setStatus(mode === 'cloud' ? 'Contatto eliminato dalla rubrica online.' : 'Contatto eliminato da questo browser.', 'ok');
          if (editingId === id) { inProgress = false; hideForm(); }
        } catch (err) {
          setStatus('Eliminazione non riuscita: ' + (err.code === 'permission-denied' ? 'permessi Firestore mancanti.' : err.message), 'error');
        } finally { inProgress = false; }
        break;
    }
  });

  $('#nav').innerHTML = nav('c');
  contacts = readCache();
  render();
  if (db) {
    db.collection('Contatti').onSnapshot(s => {
      // Firestore è la fonte autorevole. La cache serve solo per mostrare dati già letti.
      contacts = s.docs.map(d => ({...d.data(), id:d.id}));
      saveCache();
      render();
      if (!status.textContent || status.textContent.includes('Caricamento')) {
        setStatus('Rubrica sincronizzata con l’archivio online.', 'ok');
      }
    }, err => {
      contacts = readCache();
      fallbackToLocal(err);
      render();
    });
  } else {
    setStatus('Modalità locale: i contatti sono salvati solo in questo browser.', 'error');
  }
})();
