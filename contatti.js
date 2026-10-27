/* Buckland Angling Club — rubrica Firestore con accesso Google.
   Non è previsto il salvataggio locale: una modifica è riuscita solo
   quando Firestore la conferma. I permessi dipendono dalle regole Firestore. */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const list = $('#contactsList');
  const search = $('#contactsSearch');
  const status = $('#status');
  const form = $('#contactForm');
  const editor = $('#contactEditor');
  const addButton = $('#addContact');
  const nameInput = $('#contactName');
  const letterInput = $('#contactLetter');
  const saveButton = $('#saveContact');
  const ledger = $('#contactsLedger');
  const loginButton = $('#loginContact');
  const logoutButton = $('#logoutContact');
  const copyUidButton = $('#copyUid');
  const uidLabel = $('#authUid');
  const accountLabel = $('#authAccount');
  const authDescription = $('#authDescription');
  const collator = new Intl.Collator('it', { sensitivity:'base' });
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

  let contacts = [];
  let editingId = null;
  let busy = false;
  let authorized = false;
  let activeUser = null;
  let unsubscribe = null;
  let auth = null;

  const notify = (message = '', kind = '') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };

  const canEdit = () => Boolean(authorized && activeUser && !busy);

  function render() {
    $('#contactCount').textContent = contacts.length;
    const term = search.value.trim().toLocaleLowerCase('it');
    const found = [...contacts]
      .sort((a,b) => collator.compare(String(a.nome || ''), String(b.nome || '')))
      .filter(c => `${c.nome || ''} ${c.missiva || ''}`.toLocaleLowerCase('it').includes(term));

    if (!found.length) {
      list.innerHTML = `<p class="contacts-empty">${contacts.length
        ? 'Nessun contatto corrisponde alla ricerca.'
        : 'Nessun contatto registrato. Premi «+ Nuovo contatto» per aggiungerne uno.'}</p>`;
      return;
    }
    list.innerHTML = found.map(c => {
      const initials = String(c.nome || '').trim().split(/\s+/).filter(Boolean)
        .slice(0,2).map(x => x[0]).join('').toLocaleUpperCase('it');
      const id = escapeHtml(c.id);
      return `<article class="contact-card">
        <div class="contact-card-top">
          <div class="contact-monogram" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="contact-title"><h4>${escapeHtml(c.nome)}</h4><small>Corrispondenza del club</small></div>
        </div>
        <div class="contact-letter">
          <span class="contact-letter-label">Missiva / Recapito</span>
          <strong class="contact-letter-value">${escapeHtml(c.missiva)}</strong>
        </div>
        <div class="contact-actions">
          <button type="button" data-action="copy" data-id="${id}">Copia</button>
          <button type="button" data-action="edit" data-id="${id}">Modifica</button>
          <button type="button" class="contact-delete" data-action="delete" data-id="${id}">✕</button>
        </div>
      </article>`;
    }).join('');
  }

  function openEditor(contact = null) {
    if (!canEdit()) return;
    editingId = contact ? contact.id : null;
    form.reset();
    nameInput.value = contact?.nome || '';
    letterInput.value = contact?.missiva || '';
    $('#editorHeading').textContent = contact ? 'Modifica un contatto' : 'Aggiungi un contatto';
    saveButton.textContent = contact ? 'Salva modifiche' : 'Salva nel registro';
    editor.hidden = false;
    addButton.setAttribute('aria-expanded', 'true');
    editor.scrollIntoView({ behavior:'smooth', block:'nearest' });
    nameInput.focus({ preventScroll:true });
  }

  function closeEditor() {
    if (busy) return;
    editor.hidden = true;
    editingId = null;
    form.reset();
    addButton.setAttribute('aria-expanded', 'false');
  }

  function updateAccessUI() {
    addButton.hidden = !authorized;
    addButton.disabled = !canEdit();
    ledger.hidden = !authorized;
    loginButton.hidden = !!activeUser;
    logoutButton.hidden = !activeUser;
    uidLabel.hidden = !activeUser;
    copyUidButton.hidden = !activeUser;
    accountLabel.hidden = !activeUser;
    if (activeUser) {
      authDescription.textContent = authorized
        ? 'Rubrica online con accesso riservato.'
        : 'Account collegato. Per abilitare la rubrica, autorizza il tuo UID nelle regole Firestore.';
      accountLabel.textContent = `Account: ${activeUser.email || activeUser.displayName || 'Google'}`;
      uidLabel.textContent = `UID Firebase: ${activeUser.uid}`;
    } else {
      authDescription.textContent = 'Accedi con Google per consultare e gestire i contatti online.';
      accountLabel.textContent = '';
      uidLabel.textContent = '';
    }
  }

  function resetListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    contacts = [];
    authorized = false;
    render();
    closeEditor();
    updateAccessUI();
  }

  function listenOnline() {
    if (!db || !activeUser) return;
    // Autenticazione completa: Firestore applica le regole sul token Google.
    unsubscribe = db.collection('Contatti').onSnapshot(snapshot => {
      authorized = true;
      contacts = snapshot.docs.map(doc => ({ ...doc.data(), id:doc.id }));
      updateAccessUI();
      render();
      notify('Rubrica sincronizzata online.', 'ok');
    }, err => {
      authorized = false;
      contacts = [];
      render();
      updateAccessUI();
      notify(err.code === 'permission-denied'
        ? 'Questo account non è ancora autorizzato. Copia l’UID e aggiungilo nelle regole Firestore.'
        : `Impossibile leggere i contatti online: ${err.message}`, 'error');
    });
  }

  $('#nav').innerHTML = nav('c');
  render();

  if (!db || typeof firebase === 'undefined' || !firebase.auth) {
    notify('Firebase non è stato caricato correttamente.', 'error');
    loginButton.disabled = true;
  } else {
    auth = firebase.auth();
    auth.onAuthStateChanged(user => {
      resetListener();
      activeUser = user;
      updateAccessUI();
      if (user) listenOnline();
      else notify('Accedi con Google per aprire la rubrica.');
    }, err => notify(`Errore autenticazione: ${err.message}`, 'error'));
  }

  loginButton.addEventListener('click', async () => {
    if (!auth) return;
    loginButton.disabled = true;
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (err) {
      notify(`Accesso Google non riuscito: ${err.message}`, 'error');
    } finally {
      loginButton.disabled = false;
    }
  });
  logoutButton.addEventListener('click', async () => {
    if (!auth) return;
    try { await auth.signOut(); }
    catch (err) { notify(`Uscita non riuscita: ${err.message}`, 'error'); }
  });
  copyUidButton.addEventListener('click', async () => {
    if (!activeUser) return;
    try {
      await navigator.clipboard.writeText(activeUser.uid);
      notify('UID copiato negli appunti.', 'ok');
    } catch (_) {
      notify('UID visibile accanto al pulsante; selezionalo e copialo manualmente.', 'error');
    }
  });

  addButton.addEventListener('click', () => editor.hidden ? openEditor() : closeEditor());
  $('#closeEditor').addEventListener('click', closeEditor);
  $('#cancelEditor').addEventListener('click', closeEditor);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !editor.hidden) closeEditor();
  });
  search.addEventListener('input', render);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEdit()) return;
    const nome = nameInput.value.trim().replace(/\s+/g, ' ');
    const missiva = letterInput.value.trim();
    if (!nome || !missiva) {
      notify('Inserisci sia nome che missiva.', 'error');
      return;
    }
    const payload = { nome, missiva };
    const id = editingId;
    busy = true;
    saveButton.disabled = true;
    updateAccessUI();
    try {
      if (id === null) await db.collection('Contatti').add({ ...payload, creato:Date.now() });
      else await db.collection('Contatti').doc(id).update(payload);
      notify(id === null ? 'Contatto salvato online.' : 'Contatto modificato online.', 'ok');
    } catch (err) {
      notify(err.code === 'permission-denied'
        ? 'Salvataggio negato dalle regole Firestore: controlla l’UID autorizzato.'
        : `Salvataggio online non riuscito: ${err.message}`, 'error');
      return;
    } finally {
      busy = false;
      saveButton.disabled = false;
      updateAccessUI();
    }
    closeEditor();
  });

  list.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !authorized || busy) return;
    const id = button.dataset.id;
    const contact = contacts.find(c => String(c.id) === id);
    if (!contact) return;
    switch (button.dataset.action) {
      case 'edit': openEditor(contact); break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(String(contact.missiva));
          notify(`Missiva di ${contact.nome} copiata negli appunti.`, 'ok');
        } catch (_) { notify('Copia non disponibile: seleziona la missiva manualmente.', 'error'); }
        break;
      case 'delete':
        if (!canEdit() || !confirm(`Eliminare il contatto «${contact.nome}»?`)) return;
        busy = true;
        updateAccessUI();
        try {
          await db.collection('Contatti').doc(id).delete();
          notify('Contatto eliminato online.', 'ok');
        } catch (err) {
          notify(`Eliminazione non riuscita: ${err.message}`, 'error');
        } finally {
          busy = false;
          updateAccessUI();
        }
        break;
    }
  });
})();
