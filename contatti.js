
/* Buckland Angling Club · rubrica pubblica con salvataggio Firestore.
   Tutti i visitatori possono leggere, aggiungere, modificare ed eliminare contatti,
   se le regole Firestore autorizzano la collezione "Contatti".
   Nessun accesso Google e nessun salvataggio soltanto locale. */
(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const list = $('#contactsList');
  const search = $('#contactsSearch');
  const status = $('#status');
  const form = $('#contactForm');
  const editor = $('#contactEditor');
  const addButton = $('#addContact');
  const nameInput = $('#contactName');
  const letterInput = $('#contactLetter');
  const saveButton = $('#saveContact');
  const collator = new Intl.Collator('it', { sensitivity: 'base' });

  let contacts = [];
  let editingId = null;
  let busy = false;
  let ready = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function notify(message = '', kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function updateButtons() {
    addButton.disabled = !ready || busy;
    saveButton.disabled = !ready || busy;
  }

  function render() {
    $('#contactCount').textContent = String(contacts.length);
    const term = search.value.trim().toLocaleLowerCase('it');
    const found = [...contacts]
      .sort((a, b) => collator.compare(String(a.nome || ''), String(b.nome || '')))
      .filter(c => `${c.nome || ''} ${c.missiva || ''}`.toLocaleLowerCase('it').includes(term));

    if (!found.length) {
      list.innerHTML = `<p class="contacts-empty">${contacts.length
        ? 'Nessun contatto corrisponde alla ricerca.'
        : 'Nessun contatto registrato. Premi «+ Nuovo contatto» per aggiungerne uno.'}</p>`;
      return;
    }

    list.innerHTML = found.map(c => {
      const initials = String(c.nome || '').trim().split(/\s+/).filter(Boolean)
        .slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('it');
      const id = escapeHtml(c.id);
      const nome = escapeHtml(c.nome);
      return `<article class="contact-card">
        <div class="contact-card-top">
          <div class="contact-monogram" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="contact-title"><h4>${nome}</h4><small>Corrispondenza del club</small></div>
        </div>
        <div class="contact-letter">
          <span class="contact-letter-label">Missiva / Recapito</span>
          <strong class="contact-letter-value">${escapeHtml(c.missiva)}</strong>
        </div>
        <div class="contact-actions">
          <button type="button" data-action="copy" data-id="${id}" aria-label="Copia la missiva di ${nome}">Copia</button>
          <button type="button" data-action="edit" data-id="${id}" aria-label="Modifica ${nome}">Modifica</button>
          <button type="button" class="contact-delete" data-action="delete" data-id="${id}" aria-label="Elimina ${nome}">✕</button>
        </div>
      </article>`;
    }).join('');
  }

  function openEditor(contact = null) {
    if (!ready || busy) return;
    editingId = contact ? contact.id : null;
    form.reset();
    nameInput.value = contact?.nome || '';
    letterInput.value = contact?.missiva || '';
    $('#editorHeading').textContent = contact ? 'Modifica un contatto' : 'Aggiungi un contatto';
    saveButton.textContent = contact ? 'Salva modifiche' : 'Salva nel registro';
    editor.hidden = false;
    addButton.setAttribute('aria-expanded', 'true');
    editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    nameInput.focus({ preventScroll: true });
  }

  function closeEditor() {
    if (busy) return;
    editor.hidden = true;
    editingId = null;
    form.reset();
    addButton.setAttribute('aria-expanded', 'false');
  }

  // Navbar condivisa con le altre pagine del sito.
  $('#nav').innerHTML = nav('c');
  render();
  updateButtons();

  addButton.addEventListener('click', () => editor.hidden ? openEditor() : closeEditor());
  $('#closeEditor').addEventListener('click', closeEditor);
  $('#cancelEditor').addEventListener('click', closeEditor);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !editor.hidden) closeEditor();
  });
  search.addEventListener('input', render);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy) return;

    const nome = nameInput.value.trim().replace(/\s+/g, ' ');
    const missiva = letterInput.value.trim();
    if (!nome || !missiva) {
      notify('Inserisci sia il nome che la missiva.', 'error');
      return;
    }

    const id = editingId;
    busy = true;
    updateButtons();
    try {
      const collection = db.collection('Contatti');
      if (id === null) {
        await collection.add({ nome, missiva, creato: Date.now() });
      } else {
        await collection.doc(id).update({ nome, missiva });
      }
      notify(id === null ? 'Contatto salvato online.' : 'Contatto modificato online.', 'ok');
    } catch (error) {
      notify(error.code === 'permission-denied'
        ? 'Salvataggio negato: autorizza la raccolta Contatti nelle regole Firestore.'
        : `Salvataggio online non riuscito: ${error.message}`, 'error');
      return;
    } finally {
      busy = false;
      updateButtons();
    }
    closeEditor();
  });

  list.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !ready || busy) return;

    const contact = contacts.find(c => String(c.id) === button.dataset.id);
    if (!contact) return;

    switch (button.dataset.action) {
      case 'edit':
        openEditor(contact);
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(String(contact.missiva));
          notify(`Missiva di ${contact.nome} copiata negli appunti.`, 'ok');
        } catch (_) {
          notify('Copia non disponibile: seleziona la missiva e copiala manualmente.', 'error');
        }
        break;
      case 'delete':
        if (!confirm(`Eliminare il contatto «${contact.nome}»?`)) return;
        busy = true;
        updateButtons();
        try {
          await db.collection('Contatti').doc(contact.id).delete();
          notify('Contatto eliminato online.', 'ok');
          if (editingId === contact.id) {
            busy = false;
            closeEditor();
          }
        } catch (error) {
          notify(error.code === 'permission-denied'
            ? 'Eliminazione negata dalle regole Firestore.'
            : `Eliminazione non riuscita: ${error.message}`, 'error');
        } finally {
          busy = false;
          updateButtons();
        }
        break;
    }
  });

  if (!db) {
    notify('Firebase non è disponibile. Controlla la connessione e la configurazione.', 'error');
    return;
  }

  // I contatti provengono da Firestore: nessun accesso Google richiesto.
  db.collection('Contatti').onSnapshot(snapshot => {
    contacts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    ready = true;
    updateButtons();
    render();
    if (!status.textContent || status.textContent === 'Caricamento della rubrica…') {
      notify('Rubrica sincronizzata online.', 'ok');
    }
  }, error => {
    ready = false;
    contacts = [];
    updateButtons();
    render();
    notify(error.code === 'permission-denied'
      ? 'Accesso negato: aggiungi Contatti alle raccolte consentite nelle regole Firestore.'
      : `Impossibile caricare la rubrica online: ${error.message}`, 'error');
  });
})();
