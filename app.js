import * as db from './db.js';

// ===========================================================================
// Data: the 8 objects
// ===========================================================================
const OBJECTS = {
  agriculture: {
    num: 1, name: 'Agriculture',
    excerpt: 'Everything belonging to this art, and whatever has a near relation to it. Photograph the people who work the land. The vineyards of the Moselle, the olive presses of Provence, the rice fields of Vercelli, the cheesemakers of Rozzano. Photograph also the animals and the seasons. New methods which might be brought home in your notebook, if not in your camera.'
  },
  'mechanical-arts': {
    num: 2, name: 'Mechanical arts',
    excerpt: 'So far as they respect things necessary in America, and inconvenient to be transported thither ready made. Photograph the forges, the stone quarries, the boats, the bridges (very specially). Photograph also the people who build them and the people who maintain them. The work that holds the cities up is not the work the cities advertise.'
  },
  'lighter-arts': {
    num: 3, name: 'Lighter arts and manufactures',
    excerpt: 'Jefferson insisted America would never become a manufacturing nation. He saw the world through his idealistic vision, and advised not to waste time studying European factories. My own advice here is to capture and experience things you would not expect to enjoy. Create a story from what you believe to be story-less. Seek out opportunities to expand what counts as "interesting."'
  },
  gardens: {
    num: 4, name: 'Gardens',
    excerpt: 'Peculiarly worth the attention of an American, because it is the country of all others where the noblest gardens may yet be made. Photograph the formal gardens of Versailles and Schwetzingen, the English-style grounds of Lombardy, the kitchen gardens behind every Italian house. The composition of a garden teaches the composition of a frame.'
  },
  architecture: {
    num: 5, name: 'Architecture',
    excerpt: 'Worth great attention. As America doubles its numbers every twenty years it must double its houses, and we build of such perishable materials that half of what stands today will be rebuilt within twenty years. Photograph everything: the Roman temples that survived two thousand years, the Gothic cathedrals that survived eight hundred, the Bauhaus blocks that survived a century, the postwar towers already coming down. It is among the most important arts, and your photographs are the record of which choices held.'
  },
  painting: {
    num: 6, name: 'Painting, statuary',
    excerpt: 'Too established for you to add to through the camera. It would be useless and preposterous to endeavor to make yourself a connoisseur in those arts by photographing them. Photograph them in their context: the painting on the gallery wall with the visitors before it, the statue in the square with the pigeons on it. They are worth seeing, but not studying.'
  },
  politics: {
    num: 7, name: 'Politics',
    excerpt: 'Well worth studying, and especially worth photographing, so far as respects internal affairs. Examine their influence on the happiness of the people. Take every possible occasion of entering the kitchens of the labourers, and especially at the moments of their repast, see what they eat, how they are clothed, whether they are obliged to labour too hard, whether the government or their landlord takes from them an unjust proportion of their labour, on what footing stands the property they call their own, their personal liberty. Photograph all of it. Each is a life. This is the work of a lifetime, and the lifetime begins here.'
  },
  courts: {
    num: 8, name: 'Courts',
    excerpt: "Jefferson's last point is a fiery attack on the courts, which he compares to wild animals and \"humanity's weakest part.\" Ironically, his judgment uses the same logic he critiques in the courts themselves. If you come across a court in your travels, I advise not to think about the political infrastructure or lobbyist influence. Let it instead be a reminder of the liberty you have, protected. Think of the freedom you have to travel and explore the world. The same liberty Jefferson had when he crossed an ocean to Europe, and that you have now, to photograph fishmongers in Naples. Photograph the courts as a reminder and a thank-you for the freedom you have. Photograph the night sky in the same way."
  }
};
const OBJECT_KEYS = Object.keys(OBJECTS);

// ===========================================================================
// State
// ===========================================================================
const state = {
  travelerName: 'Rhett',
  tripStart: '',
  tripEnd: '',
  composer: { mode: 'new', object: null, entryId: null, photos: [], draftKey: null },
  cityEditor: { mode: 'new', cityId: null },
  currentEntryId: null,
  // session photo url cache (for object URL revoke)
  photoUrls: new Map()
};

// ===========================================================================
// DOM helpers
// ===========================================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const VIEWS = ['view-home', 'view-reader', 'view-plan', 'view-journal', 'view-object', 'view-entry'];

function showView(id) {
  for (const v of VIEWS) {
    const el = document.getElementById(v);
    if (!el) continue;
    el.hidden = v !== id;
  }
  $('#main')?.focus();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function debounce(fn, wait) {
  let to;
  return (...args) => {
    clearTimeout(to);
    to = setTimeout(() => fn(...args), wait);
  };
}

function fmtDateISO(iso) {
  if (!iso) return '';
  // Treat as date-only (no timezone shift)
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// ===========================================================================
// Theme + Reading style
// ===========================================================================
async function loadTheme() {
  const saved = await db.kvGet('theme');
  const initial = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(initial);
  const reading = (await db.kvGet('reading')) || 'standard';
  applyReading(reading);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('#theme-toggle')?.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}
async function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await db.kvSet('theme', next);
}
function applyReading(mode) {
  if (mode === 'comfortable') {
    document.documentElement.setAttribute('data-reading', 'comfortable');
  } else {
    document.documentElement.removeAttribute('data-reading');
  }
  $$('.seg-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.reading === mode ? 'true' : 'false');
  });
}
async function setReading(mode) {
  applyReading(mode);
  await db.kvSet('reading', mode);
}

// ===========================================================================
// Settings (name, trip dates)
// ===========================================================================
async function loadSettings() {
  state.travelerName = (await db.kvGet('travelerName')) || 'Rhett';
  state.tripStart = (await db.kvGet('tripStart')) || '';
  state.tripEnd = (await db.kvGet('tripEnd')) || '';
  renderHomeMeta();
}

function renderHomeMeta() {
  $('#home-sub').textContent = `For ${state.travelerName || 'Rhett'}`;
  const meta = $('#home-meta');
  const text = tripStatusText();
  if (text) {
    meta.textContent = text;
    meta.hidden = false;
  } else {
    meta.textContent = '';
    meta.hidden = true;
  }
}

function tripStatusText() {
  if (!state.tripStart) return '';
  const start = parseISO(state.tripStart);
  const end = state.tripEnd ? parseISO(state.tripEnd) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (today < start) {
    const days = Math.round((start - today) / 86400000);
    if (days === 0) return 'Departs today';
    if (days === 1) return 'Departs tomorrow';
    return `${days} days until departure`;
  }
  if (end && today > end) {
    return `Trip ended ${fmtDateISO(state.tripEnd)}`;
  }
  if (end) {
    const total = Math.round((end - start) / 86400000) + 1;
    const dayN = Math.min(total, Math.round((today - start) / 86400000) + 1);
    return `Day ${dayN} of ${total}`;
  }
  return `Departed ${fmtDateISO(state.tripStart)}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ===========================================================================
// Router
// ===========================================================================
function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h;
}

async function route() {
  const path = parseHash();
  // Save scroll for previous view
  saveScroll(route._prev || '#/');
  route._prev = '#' + path;

  if (path === '/' || path === '') return renderHome();
  if (path === '/card') return renderReader('card', 'A card');
  if (path === '/letter-2026') return renderReader('letter-2026', 'Hints, 2026');
  if (path === '/letter-1788') return renderReader('letter-1788', 'Hints, 1788');
  if (path === '/plan') return renderPlan();
  if (path === '/journal') return renderJournal();
  if (path.startsWith('/journal/')) {
    const slug = path.slice('/journal/'.length);
    if (OBJECTS[slug]) return renderObject(slug);
  }
  if (path.startsWith('/entry/')) {
    const id = path.slice('/entry/'.length);
    return renderEntry(id);
  }
  // Unknown
  return renderHome();
}

function saveScroll(hash) {
  try {
    sessionStorage.setItem(`scroll:${hash}`, String(window.scrollY));
  } catch (e) {}
}
function restoreScroll() {
  const hash = '#' + parseHash();
  const y = Number(sessionStorage.getItem(`scroll:${hash}`) || 0);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

// ===========================================================================
// Home
// ===========================================================================
async function renderHome() {
  renderHomeMeta();
  showView('view-home');
  restoreScroll();
}

// ===========================================================================
// Reader (letters)
// ===========================================================================
const _letterCache = new Map();
async function loadLetter(slug) {
  if (_letterCache.has(slug)) return _letterCache.get(slug);
  const res = await fetch(`content/${slug}.html`);
  const html = await res.text();
  _letterCache.set(slug, html);
  return html;
}

async function renderReader(slug, title) {
  const mount = $('#reader-mount');
  mount.innerHTML = '<p class="empty-state">Loading…</p>';
  $('#reader-topbar-title').textContent = title;
  showView('view-reader');
  try {
    const html = await loadLetter(slug);
    mount.innerHTML = html;
  } catch (e) {
    mount.innerHTML = `<p class="empty-state">Could not load this letter. ${e.message}</p>`;
  }
  restoreScroll();
}

// ===========================================================================
// Plan
// ===========================================================================
async function renderPlan() {
  showView('view-plan');
  $('#plan-start').value = state.tripStart || '';
  $('#plan-end').value = state.tripEnd || '';
  $('#plan-counter').textContent = tripStatusText();
  await renderCities();
  restoreScroll();
}

async function renderCities() {
  const cities = await db.getCities();
  const list = $('#city-list');
  const empty = $('#city-empty');
  list.innerHTML = '';
  if (cities.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  cities.forEach((c, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'city-item';
    btn.dataset.id = c.id;
    btn.innerHTML = `
      <span class="city-num">${i + 1}</span>
      <span class="city-main">
        <span class="city-name"></span>
        <span class="city-meta"></span>
      </span>
      <svg class="city-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    `;
    btn.querySelector('.city-name').textContent = c.name;
    const meta = [];
    if (c.arrive) meta.push(fmtDateISO(c.arrive));
    if (c.arrive && c.depart) meta.push('→');
    if (c.depart) meta.push(fmtDateISO(c.depart));
    if ((c.tags || []).length) meta.push(`· ${c.tags.length} object${c.tags.length === 1 ? '' : 's'}`);
    btn.querySelector('.city-meta').textContent = meta.join(' ');
    btn.addEventListener('click', () => openCityEditor('edit', c.id));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

async function savePlanDates() {
  state.tripStart = $('#plan-start').value;
  state.tripEnd = $('#plan-end').value;
  await db.kvSet('tripStart', state.tripStart);
  await db.kvSet('tripEnd', state.tripEnd);
  $('#plan-counter').textContent = tripStatusText();
  renderHomeMeta();
}

// City editor sheet
function openCityEditor(mode, id) {
  state.cityEditor = { mode, cityId: id };
  $('#city-sheet-title').textContent = mode === 'edit' ? 'Edit city' : 'New city';
  $('#c-delete').hidden = mode !== 'edit';
  $('#c-name-error').textContent = '';
  // Build chips
  const chipRow = $('#c-tags');
  chipRow.innerHTML = '';
  for (const k of OBJECT_KEYS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = OBJECTS[k].name;
    chip.setAttribute('aria-pressed', 'false');
    chip.dataset.tag = k;
    chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    });
    chipRow.appendChild(chip);
  }
  // Populate fields
  if (mode === 'edit') {
    db.getCities().then(list => {
      const c = list.find(x => x.id === id);
      if (!c) return;
      $('#c-name').value = c.name || '';
      $('#c-arrive').value = c.arrive || '';
      $('#c-depart').value = c.depart || '';
      $('#c-notes').value = c.notes || '';
      for (const tag of (c.tags || [])) {
        const chip = chipRow.querySelector(`[data-tag="${tag}"]`);
        if (chip) chip.setAttribute('aria-pressed', 'true');
      }
    });
  } else {
    $('#c-name').value = '';
    $('#c-arrive').value = '';
    $('#c-depart').value = '';
    $('#c-notes').value = '';
  }
  openSheet('city-sheet');
  setTimeout(() => $('#c-name').focus(), 240);
}

async function saveCity() {
  const name = $('#c-name').value.trim();
  if (!name) {
    $('#c-name-error').textContent = 'A city name is required.';
    $('#c-name').focus();
    return;
  }
  const tags = $$('#c-tags .chip[aria-pressed="true"]').map(c => c.dataset.tag);
  const arrive = $('#c-arrive').value;
  const depart = $('#c-depart').value;
  const notes = $('#c-notes').value.trim();
  if (state.cityEditor.mode === 'edit') {
    const list = await db.getCities();
    const c = list.find(x => x.id === state.cityEditor.cityId);
    if (c) {
      c.name = name; c.arrive = arrive; c.depart = depart; c.notes = notes; c.tags = tags;
      await db.putCity(c);
    }
  } else {
    const list = await db.getCities();
    const maxOrder = list.reduce((m, c) => Math.max(m, c.order || 0), 0);
    await db.putCity({
      id: uid(),
      name, arrive, depart, notes, tags,
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    });
  }
  closeSheet('city-sheet');
  await renderCities();
  toast('City saved');
}

async function deleteCityNow() {
  if (state.cityEditor.mode !== 'edit') return;
  if (!confirm('Delete this city?')) return;
  await db.deleteCity(state.cityEditor.cityId);
  closeSheet('city-sheet');
  await renderCities();
  toast('City deleted');
}

// ===========================================================================
// Journal index
// ===========================================================================
async function renderJournal() {
  showView('view-journal');
  const counts = await db.countEntriesByObject();
  for (const k of OBJECT_KEYS) {
    const el = document.querySelector(`[data-key="${k}"]`);
    if (!el) continue;
    const n = counts[k] || 0;
    el.textContent = n === 0 ? 'No entries' : n === 1 ? '1 entry' : `${n} entries`;
  }
  restoreScroll();
}

// ===========================================================================
// Object view (entries within one object)
// ===========================================================================
async function renderObject(slug) {
  const obj = OBJECTS[slug];
  state.composer.object = slug;
  $('#object-topbar-title').textContent = obj.name;
  $('#object-eyebrow').textContent = `Object ${obj.num} of 8`;
  $('#object-title').textContent = obj.name;
  $('#object-excerpt-body').textContent = obj.excerpt;
  showView('view-object');

  const list = $('#entry-list');
  const empty = $('#entry-empty');
  list.innerHTML = '';
  const entries = (await db.getEntries(slug)).sort(byDateDesc);
  if (entries.length === 0) {
    empty.textContent = `Nothing here yet. Tap the plus when you find your first.`;
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const e of entries) {
      list.appendChild(await renderEntryCard(e));
    }
  }
  restoreScroll();
}

function byDateDesc(a, b) {
  const aa = a.date || a.createdAt || '';
  const bb = b.date || b.createdAt || '';
  return bb.localeCompare(aa);
}

async function renderEntryCard(entry) {
  const li = document.createElement('li');
  const btn = document.createElement('a');
  btn.href = `#/entry/${entry.id}`;
  btn.className = 'entry-card';
  btn.innerHTML = `
    <div class="entry-card-head">
      <span class="entry-card-title"></span>
      <span class="entry-card-date"></span>
    </div>
    <div class="entry-card-location"></div>
    <p class="entry-card-snippet"></p>
    <div class="entry-card-thumbs"></div>
  `;
  btn.querySelector('.entry-card-title').textContent = entry.title || 'Untitled';
  btn.querySelector('.entry-card-date').textContent = fmtDateISO(entry.date || entry.createdAt);
  const loc = btn.querySelector('.entry-card-location');
  if (entry.location) loc.textContent = entry.location; else loc.remove();
  const snip = btn.querySelector('.entry-card-snippet');
  if (entry.notes) snip.textContent = entry.notes; else snip.remove();

  // Thumbs
  const thumbsEl = btn.querySelector('.entry-card-thumbs');
  const ids = (entry.photoIds || []).slice(0, 3);
  for (const pid of ids) {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const p = await db.getPhoto(pid);
    if (p) img.src = photoUrl(pid, p.thumb || p.blob);
    thumbsEl.appendChild(img);
  }
  if ((entry.photoIds || []).length > 3) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `+${entry.photoIds.length - 3}`;
    thumbsEl.appendChild(more);
  }
  if ((entry.photoIds || []).length === 0) thumbsEl.remove();
  li.appendChild(btn);
  return li;
}

function photoUrl(id, blob) {
  if (state.photoUrls.has(id)) return state.photoUrls.get(id);
  const url = URL.createObjectURL(blob);
  state.photoUrls.set(id, url);
  return url;
}

// ===========================================================================
// Entry detail view
// ===========================================================================
async function renderEntry(id) {
  state.currentEntryId = id;
  const entry = await db.getEntry(id);
  if (!entry) {
    toast('Entry not found');
    window.location.hash = '#/journal';
    return;
  }
  const obj = OBJECTS[entry.object];
  // Back goes to object view
  $('#entry-back').href = `#/journal/${entry.object}`;
  $('#entry-back-label').textContent = obj?.name || 'Back';

  const body = $('#entry-body');
  body.innerHTML = `
    <header class="entry-hero">
      <p class="entry-hero-eyebrow"></p>
      <h1 class="entry-hero-title"></h1>
      <div class="entry-hero-meta">
        <span class="entry-hero-date"></span>
        <span class="entry-hero-location"></span>
      </div>
    </header>
    <div class="entry-gallery" id="entry-gallery"></div>
    <p class="entry-notes"></p>
  `;
  body.querySelector('.entry-hero-eyebrow').textContent = obj?.name || '';
  body.querySelector('.entry-hero-title').textContent = entry.title || 'Untitled';
  body.querySelector('.entry-hero-date').textContent = fmtDateISO(entry.date || entry.createdAt);
  const locSpan = body.querySelector('.entry-hero-location');
  if (entry.location) {
    locSpan.innerHTML = `<strong>·</strong> ${escapeHtml(entry.location)}`;
  } else {
    locSpan.remove();
  }
  const notes = body.querySelector('.entry-notes');
  if (entry.notes) notes.textContent = entry.notes; else notes.remove();

  // Gallery
  const gal = $('#entry-gallery');
  if ((entry.photoIds || []).length === 0) {
    gal.remove();
  } else {
    for (const pid of entry.photoIds) {
      const p = await db.getPhoto(pid);
      if (!p) continue;
      const img = document.createElement('img');
      img.alt = entry.title || 'Photo';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = photoUrl(pid, p.thumb || p.blob);
      img.dataset.fullId = pid;
      img.addEventListener('click', () => openLightbox(pid, p.blob));
      gal.appendChild(img);
    }
  }
  showView('view-entry');
  restoreScroll();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

// ===========================================================================
// Composer (entry editor sheet)
// ===========================================================================
async function openComposer(mode, object, entryId) {
  state.composer = { mode, object, entryId, photos: [], draftKey: composerDraftKey(mode, object, entryId) };
  $('#composer-title').textContent = mode === 'edit' ? 'Edit entry' : 'New entry';
  $('#f-title').value = '';
  $('#f-title-error').textContent = '';
  $('#f-date').value = todayISO();
  $('#f-location').value = '';
  $('#f-notes').value = '';
  $('#f-photo-grid').innerHTML = '';

  let initial = null;
  if (mode === 'edit' && entryId) {
    const e = await db.getEntry(entryId);
    if (e) {
      initial = {
        title: e.title || '', date: e.date || todayISO(),
        location: e.location || '', notes: e.notes || '',
        photoIds: e.photoIds || []
      };
    }
  }

  // Draft restore
  const draft = await db.kvGet(state.composer.draftKey);
  if (draft && (!initial || draft.editedAfter)) {
    if (confirm('You have an unsaved draft. Restore it?')) {
      initial = draft;
    } else {
      await db.kvDelete(state.composer.draftKey);
    }
  }
  if (initial) {
    $('#f-title').value = initial.title || '';
    $('#f-date').value = initial.date || todayISO();
    $('#f-location').value = initial.location || '';
    $('#f-notes').value = initial.notes || '';
    if (initial.photoIds) {
      for (const pid of initial.photoIds) {
        const p = await db.getPhoto(pid);
        if (p) state.composer.photos.push({ id: pid, blob: p.blob, thumb: p.thumb, width: p.width, height: p.height, existing: true });
      }
      renderComposerPhotos();
    }
  }
  openSheet('composer-sheet');
  setTimeout(() => $('#f-title').focus(), 240);
}

function composerDraftKey(mode, object, entryId) {
  return mode === 'edit' ? `draft:edit:${entryId}` : `draft:new:${object}`;
}

const saveComposerDraft = debounce(async () => {
  if (!state.composer.draftKey) return;
  const data = {
    title: $('#f-title').value,
    date: $('#f-date').value,
    location: $('#f-location').value,
    notes: $('#f-notes').value,
    photoIds: state.composer.photos.map(p => p.id),
    editedAfter: true
  };
  await db.kvSet(state.composer.draftKey, data);
}, 500);

function bindComposerAutosave() {
  for (const id of ['f-title','f-date','f-location','f-notes']) {
    const el = $('#' + id);
    el.addEventListener('input', saveComposerDraft);
  }
}

async function saveComposer() {
  const title = $('#f-title').value.trim();
  const titleErr = $('#f-title-error');
  if (!title) {
    titleErr.textContent = 'A title is required.';
    $('#f-title').focus();
    return;
  }
  titleErr.textContent = '';

  // Persist any new photos to the photos store
  const photoIds = [];
  for (const p of state.composer.photos) {
    if (!p.existing) {
      await db.putPhoto({ id: p.id, blob: p.blob, thumb: p.thumb, width: p.width, height: p.height });
    }
    photoIds.push(p.id);
  }

  const now = new Date().toISOString();
  if (state.composer.mode === 'edit') {
    const e = await db.getEntry(state.composer.entryId);
    if (e) {
      // Photos to delete: ones removed from the set
      const existingIds = new Set(photoIds);
      for (const oldId of (e.photoIds || [])) {
        if (!existingIds.has(oldId)) await db.deletePhoto(oldId);
      }
      e.title = title;
      e.date = $('#f-date').value;
      e.location = $('#f-location').value.trim();
      e.notes = $('#f-notes').value.trim();
      e.photoIds = photoIds;
      e.updatedAt = now;
      await db.putEntry(e);
    }
  } else {
    await db.putEntry({
      id: uid(),
      object: state.composer.object,
      title,
      date: $('#f-date').value,
      location: $('#f-location').value.trim(),
      notes: $('#f-notes').value.trim(),
      photoIds,
      createdAt: now,
      updatedAt: now
    });
  }
  await db.kvDelete(state.composer.draftKey);
  closeSheet('composer-sheet');
  toast('Entry saved');
  // Refresh current view
  await route();
}

function attemptCloseComposer() {
  const dirty = ($('#f-title').value || $('#f-notes').value || $('#f-location').value ||
                 state.composer.photos.some(p => !p.existing));
  if (dirty) {
    if (!confirm('Discard this entry? Your draft is saved on this device.')) return;
  }
  closeSheet('composer-sheet');
}

// Photo input handlers
function handlePhotoInput(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = ''; // allow re-pick
  for (const file of files) {
    addPhotoToComposer(file);
  }
}

async function addPhotoToComposer(file) {
  const id = uid();
  const placeholder = { id, loading: true };
  state.composer.photos.push(placeholder);
  renderComposerPhotos();

  try {
    const processed = await processPhotoFile(file);
    const i = state.composer.photos.findIndex(p => p.id === id);
    if (i >= 0) {
      state.composer.photos[i] = { id, ...processed };
      renderComposerPhotos();
      saveComposerDraft();
    }
  } catch (err) {
    console.error('photo error', err);
    toast('Could not load that photo');
    state.composer.photos = state.composer.photos.filter(p => p.id !== id);
    renderComposerPhotos();
  }
}

function renderComposerPhotos() {
  const grid = $('#f-photo-grid');
  grid.innerHTML = '';
  for (const p of state.composer.photos) {
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb';
    wrap.setAttribute('role', 'listitem');
    if (p.loading) {
      wrap.innerHTML = `<div class="photo-thumb-loading"><div class="spinner" role="status" aria-label="Processing photo"></div></div>`;
    } else {
      const img = document.createElement('img');
      img.alt = '';
      img.src = photoUrl(p.id, p.thumb || p.blob);
      wrap.appendChild(img);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'photo-thumb-remove';
      rm.setAttribute('aria-label', 'Remove photo');
      rm.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      rm.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        state.composer.photos = state.composer.photos.filter(x => x.id !== p.id);
        renderComposerPhotos();
        saveComposerDraft();
      });
      wrap.appendChild(rm);
    }
    grid.appendChild(wrap);
  }
}

// ===========================================================================
// Photo pipeline (resize + thumbnail)
// ===========================================================================
async function processPhotoFile(file) {
  const img = await fileToImage(file);
  const fullCanvas = drawScaled(img, 2048);
  const thumbCanvas = drawScaled(img, 600);
  const fullBlob = await canvasToBlob(fullCanvas, 'image/jpeg', 0.85);
  const thumbBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.8);
  return {
    blob: fullBlob, thumb: thumbBlob,
    width: fullCanvas.width, height: fullCanvas.height
  };
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); };
    img.onerror = (e) => reject(new Error('image load failed'));
    img.src = url;
  });
}

function drawScaled(img, maxDim) {
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const ratio = maxDim / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(b => resolve(b), mime, quality));
}

// ===========================================================================
// Sheets
// ===========================================================================
let _lastFocused = null;
function openSheet(id) {
  _lastFocused = document.activeElement;
  const sheet = document.getElementById(id);
  sheet.hidden = false;
  // force reflow then add class for transition
  void sheet.offsetWidth;
  sheet.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeSheet(id) {
  const sheet = document.getElementById(id);
  sheet.classList.remove('show');
  // wait for transition
  setTimeout(() => {
    sheet.hidden = true;
    document.body.style.overflow = '';
    if (_lastFocused && _lastFocused.focus) _lastFocused.focus();
  }, 220);
}

// ===========================================================================
// Lightbox
// ===========================================================================
function openLightbox(id, blob) {
  const url = photoUrl(id, blob);
  $('#lightbox-img').src = url;
  const lb = $('#lightbox');
  lb.hidden = false;
}
function closeLightbox() {
  const lb = $('#lightbox');
  lb.hidden = true;
  $('#lightbox-img').src = '';
}

// ===========================================================================
// Settings sheet
// ===========================================================================
function openSettings() {
  $('#s-name').value = state.travelerName || 'Rhett';
  openSheet('settings-sheet');
}

async function saveTravelerNameLive() {
  const v = $('#s-name').value.trim();
  if (v) {
    state.travelerName = v;
    await db.kvSet('travelerName', v);
    renderHomeMeta();
  }
}

async function exportData() {
  const payload = await db.dumpAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = todayISO();
  a.download = `apertures-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}

async function importData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('Replace all data on this device with the contents of this backup? This cannot be undone.')) return;
    await db.restoreAll(data);
    await loadSettings();
    toast('Backup restored');
    window.location.hash = '#/';
  } catch (e) {
    alert('Could not restore that file. ' + (e.message || ''));
  }
}

async function eraseAll() {
  if (!confirm('Erase everything on this device? Entries, photos, plan, and settings will be deleted. There is no undo.')) return;
  if (!confirm('Are you sure? This cannot be undone.')) return;
  // Revoke object URLs
  for (const url of state.photoUrls.values()) URL.revokeObjectURL(url);
  state.photoUrls.clear();
  await db.wipeAll();
  await loadSettings();
  closeSheet('settings-sheet');
  toast('Erased');
  window.location.hash = '#/';
}

// ===========================================================================
// Wire up
// ===========================================================================
function bind() {
  // Hash routing
  window.addEventListener('hashchange', route);

  // Theme
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#settings-btn').addEventListener('click', openSettings);

  // Plan
  $('#plan-start').addEventListener('change', savePlanDates);
  $('#plan-end').addEventListener('change', savePlanDates);
  $('#add-city-btn').addEventListener('click', () => openCityEditor('new'));

  // City editor
  $('#city-save').addEventListener('click', saveCity);
  $('#c-delete').addEventListener('click', deleteCityNow);

  // Sheet scrim / cancel. Composer is special-cased to prompt on dirty state.
  $$('[data-close]').forEach(el => el.addEventListener('click', () => {
    const which = el.dataset.close;
    if (which === 'composer') {
      attemptCloseComposer();
      return;
    }
    closeSheet(which + '-sheet');
  }));

  // Composer
  $('#add-entry-btn').addEventListener('click', () => openComposer('new', state.composer.object));
  $('#composer-save').addEventListener('click', saveComposer);
  $('#f-photo-camera').addEventListener('change', handlePhotoInput);
  $('#f-photo-library').addEventListener('change', handlePhotoInput);
  bindComposerAutosave();

  // Entry options menu
  $('#entry-menu-btn').addEventListener('click', () => openSheet('options-sheet'));
  $('#options-edit').addEventListener('click', async () => {
    closeSheet('options-sheet');
    const id = state.currentEntryId;
    const entry = await db.getEntry(id);
    if (entry) openComposer('edit', entry.object, id);
  });
  $('#options-delete').addEventListener('click', async () => {
    if (!confirm('Delete this entry? Photos attached to it will be removed too.')) return;
    const id = state.currentEntryId;
    const entry = await db.getEntry(id);
    if (!entry) return;
    await db.deleteEntry(id);
    closeSheet('options-sheet');
    toast('Entry deleted');
    window.location.hash = `#/journal/${entry.object}`;
  });

  // Lightbox close
  $('#lightbox-close').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target === $('#lightbox')) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#lightbox').hidden) closeLightbox();
      const openSheets = $$('.sheet.show');
      if (openSheets.length) {
        const s = openSheets[openSheets.length - 1];
        if (s.id === 'composer-sheet') attemptCloseComposer();
        else closeSheet(s.id);
      }
    }
  });

  // Settings
  $('#s-name').addEventListener('input', saveTravelerNameLive);
  $('#s-export').addEventListener('click', exportData);
  $('#s-import').addEventListener('change', (e) => importData(e.target.files[0]));
  $('#s-erase').addEventListener('click', eraseAll);
  $$('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => setReading(btn.dataset.reading));
  });
}

// ===========================================================================
// Service worker (offline support)
// ===========================================================================
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Only register over http(s); file:// won't work and would error in console.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // If a new SW takes over, reload so the user gets the new version.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available; activate it on next navigation.
            sw.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(() => { /* offline first install or local file:// — non-fatal */ });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// ===========================================================================
// Boot
// ===========================================================================
(async function init() {
  await loadTheme();
  await loadSettings();
  bind();
  await route();
  registerSW();
})();
