import 'leaflet/dist/leaflet.css';
import './style.css';
import L from 'leaflet';
import { buildAnswer, makeFinder, type Answer, type Finder, type StreamPlaces } from './answer';
import { decide, type EmbeddingBankJson } from './classify';
import { ITEMS, itemById, itemStream } from './catalog';
import { MALAGA_CENTRE, formatDistance, type ContainerData, type LatLon } from './geo';
import { QUICK, SAMPLES, tr, type Key } from './i18n';
import { addReport, listReports, localStore, reportsText } from './reports';
import { buildIndex, search } from './search';
import { sourceById } from './sources';
import { STREAMS, STREET_BINS, streamById } from './streams';
import type { Lang } from './types';
import { Vision, shrink } from './vision';

const index = buildIndex(ITEMS);
const base = import.meta.env.BASE_URL;

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem('tirabien.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* storage may be blocked */
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
})();

let finder: Finder | undefined;
let vision: Vision | undefined;
let from: LatLon = MALAGA_CENTRE;
let usingGps = false;
let locationMessage: Key = 'locationOff';
let current: { itemId: string; note?: Key; candidates?: string[]; photoUrl?: string } | undefined;
let map: L.Map | undefined;

const app = document.getElementById('app')!;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const t = (k: Key) => tr(k, lang);

function shell(): void {
  app.innerHTML = `
    <header class="top">
      <div class="brand"><span class="logo" aria-hidden="true">♻</span><span>TiraBien</span></div>
      <div class="lang" role="group" aria-label="Language">
        <button data-lang="es" aria-pressed="${lang === 'es'}">ES</button>
        <button data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
      </div>
    </header>
    <main>
      <section class="hero">
        <h1 id="tagline"></h1>
        <div class="inputs">
          <input id="q" type="search" autocomplete="off" spellcheck="false" aria-label="${esc(t('searchPlaceholder'))}" placeholder="${esc(t('searchPlaceholder'))}" />
          <label class="photo-btn">
            <input id="photo" type="file" accept="image/*" capture="environment" hidden />
            <span>📷 ${esc(t('takePhoto'))}</span>
          </label>
        </div>
        <ul id="suggest" class="suggest" role="listbox"></ul>
        <div class="quick" id="quick"></div>
        <div class="quick samples" id="samples"></div>
        <p class="privacy" id="privacy"></p>
      </section>
      <div id="status" class="status" role="status" aria-live="polite" hidden></div>
      <section id="result" aria-live="polite"></section>
      <section class="legend" id="legend"></section>
    </main>
    <footer>
      <p id="disclaimer"></p>
      <p id="datacredit"></p>
      <p><a href="https://github.com/tapaderuza/tirabien" target="_blank" rel="noopener">GitHub</a></p>
    </footer>`;
  renderStatic();
  bindShell();
}

function renderStatic(): void {
  document.documentElement.lang = lang;
  (document.getElementById('tagline') as HTMLElement).textContent = t('tagline');
  (document.getElementById('privacy') as HTMLElement).textContent = t('privacy');
  (document.getElementById('disclaimer') as HTMLElement).textContent = t('disclaimer');
  (document.getElementById('datacredit') as HTMLElement).textContent = t('data');
  (document.getElementById('quick') as HTMLElement).innerHTML =
    `<span>${esc(t('tryThese'))}:</span>` + QUICK.map((q) => `<button type="button" data-q="${esc(q.query)}">${esc(q.label[lang])}</button>`).join('');
  (document.getElementById('samples') as HTMLElement).innerHTML =
    `<span>${esc(t('trySample'))}:</span>` +
    SAMPLES.map((s) => `<button type="button" data-sample="${s.file}">📷 ${esc(s.label[lang])}</button>`).join('');
  (document.getElementById('legend') as HTMLElement).innerHTML =
    `<h2>${esc(t('bins'))}</h2><div class="bins">` +
    STREET_BINS.map((id) => {
      const s = streamById(id);
      return `<div class="bin" style="--c:${s.color}"><strong>${esc(s.short[lang])}</strong><span>${esc(s.accepts[lang])}</span></div>`;
    }).join('') +
    '</div>';
}

function bindShell(): void {
  const q = document.getElementById('q') as HTMLInputElement;
  const suggest = document.getElementById('suggest') as HTMLUListElement;

  app.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      lang = b.dataset.lang as Lang;
      try {
        localStorage.setItem('tirabien.lang', lang);
      } catch {
        /* ignore */
      }
      const value = q.value;
      shell();
      (document.getElementById('q') as HTMLInputElement).value = value;
      renderResult();
    }),
  );

  const runSearch = () => {
    const hits = search(index, q.value, 5);
    if (!q.value.trim()) {
      suggest.innerHTML = '';
      return;
    }
    suggest.innerHTML = hits.length
      ? hits
          .map((h) => {
            const s = streamById(h.item.stream);
            return `<li role="option"><button type="button" data-item="${h.item.id}"><span class="dot" style="background:${s.color}"></span>${esc(h.item.name[lang])}<em>${esc(s.short[lang])}</em></button></li>`;
          })
          .join('')
      : `<li class="none">${esc(t('noMatch'))}</li>`;
  };
  q.addEventListener('input', runSearch);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const top = search(index, q.value, 1)[0];
      if (top) choose(top.item.id);
    }
  });
  suggest.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-item]');
    if (b) choose(b.dataset.item!);
  });
  document.getElementById('quick')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-q]');
    if (!b) return;
    q.value = b.dataset.q!;
    runSearch();
    const top = search(index, q.value, 1)[0];
    if (top) choose(top.item.id);
  });
  (document.getElementById('photo') as HTMLInputElement).addEventListener('change', onPhoto);
  document.getElementById('samples')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sample]');
    if (b) void onSample(b.dataset.sample!);
  });
}

function setStatus(msg: string | null, progress?: number): void {
  const el = document.getElementById('status') as HTMLElement;
  if (!msg) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `<span>${esc(msg)}</span>${progress !== undefined ? `<progress max="100" value="${Math.round(progress)}"></progress>` : ''}`;
}

function choose(itemId: string, extra: { note?: Key; candidates?: string[]; photoUrl?: string } = {}): void {
  current = { itemId, ...extra };
  (document.getElementById('suggest') as HTMLElement).innerHTML = '';
  renderResult();
  document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onPhoto(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await classifyPhoto(file);
}

/** One tap on a sample photo (public/samples) goes through exactly the same on-device path as a camera photo. */
async function onSample(name: string): Promise<void> {
  try {
    const res = await fetch(`${base}samples/${name}.jpg`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await classifyPhoto(new File([await res.blob()], `${name}.jpg`, { type: 'image/jpeg' }));
  } catch (e) {
    console.error(e);
    setStatus(t('modelError'));
  }
}

async function classifyPhoto(file: File): Promise<void> {
  if (!vision) return;
  const photoUrl = URL.createObjectURL(file);
  try {
    setStatus(t('analysing'));
    const ranked = await vision.classify(await shrink(file));
    setStatus(null);
    const d = decide(ranked, itemStream);
    if (d.verdict === 'not_waste') {
      current = { itemId: '', note: 'notWaste', photoUrl };
      renderResult();
    } else if (d.verdict === 'unsure' || !d.itemId) {
      current = { itemId: '', note: 'unsure', candidates: d.candidates.map((c) => c.id), photoUrl };
      renderResult();
    } else {
      choose(d.itemId, {
        note: d.verdict === 'confident' ? 'confident' : 'likely',
        candidates: d.verdict === 'likely' ? d.candidates.map((c) => c.id) : undefined,
        photoUrl,
      });
    }
  } catch (e) {
    console.error(e);
    setStatus(t('modelError'));
  }
}

function placeRow(p: StreamPlaces): string {
  if (p.total === 0) return `<p class="muted">${esc(t('noMap'))}</p>`;
  return `<ol class="places">${p.nearest
    .map((n) => `<li><strong>${esc(formatDistance(n.meters))}</strong> · ${n.walkMin} ${esc(t('walk'))}</li>`)
    .join('')}</ol>`;
}

function renderResult(): void {
  const el = document.getElementById('result') as HTMLElement;
  if (map) {
    map.remove();
    map = undefined;
  }
  if (!current) {
    el.innerHTML = '';
    return;
  }
  const photo = current.photoUrl ? `<img class="thumb" src="${current.photoUrl}" alt="" />` : '';
  const chips = (ids: string[]) =>
    `<div class="chips">${ids
      .map((id) => {
        const it = itemById(id);
        return it ? `<button type="button" data-item="${id}">${esc(it.name[lang])}</button>` : '';
      })
      .join('')}</div>`;

  if (!current.itemId) {
    el.innerHTML = `<article class="card">${photo}<p class="notice">${esc(t(current.note ?? 'noMatch'))}</p>${current.candidates ? chips(current.candidates) : ''}${wrongBlock()}</article>`;
    bindChips(el);
    bindWrong(el);
    return;
  }

  const answer: Answer | undefined = finder ? buildAnswer(current.itemId, finder, from) : undefined;
  if (!answer) {
    el.innerHTML = '';
    return;
  }
  const { item, main, alt } = answer;
  const s = main.stream;
  const confidence = current.note === 'confident' || current.note === 'likely' ? `<p class="badge ${current.note}">${esc(t(current.note))}</p>` : '';
  const sources = s.sources
    .map((id) => sourceById(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`)
    .join(' · ');

  el.innerHTML = `
    <article class="card">
      ${photo}
      ${confidence}
      ${current.note === 'likely' && current.candidates ? chips(current.candidates) : ''}
      <h2>${esc(item.name[lang])}</h2>
      <div class="verdict" style="--c:${s.color};--on:${s.ink}">
        <span class="go">${esc(t('goesIn'))}</span>
        <strong>${esc(s.name[lang])}</strong>
      </div>
      <p>${esc(item.tip[lang])}</p>
      ${item.mistake ? `<p class="callout warn"><b>${esc(t('mistake'))}:</b> ${esc(item.mistake[lang])}</p>` : ''}
      ${item.changing ? `<p class="callout info"><b>${esc(t('changing'))}:</b> ${esc(item.changing[lang])}</p>` : ''}
      ${item.alt ? `<p class="callout"><b>${esc(t('ifThen'))}:</b> ${esc(streamById(item.alt.stream).name[lang])} — ${esc(item.alt.when[lang])}</p>` : ''}
      <p class="muted"><b>${esc(t('lookFor'))}:</b> ${esc(s.lookFor[lang])}</p>
      <h3>${esc(t('nearest'))}</h3>
      ${main.outside ? `<p class="callout warn">${esc(t('outside'))}</p>` : ''}
      ${placeRow(main)}
      <div id="map" class="map" role="img" aria-label="${esc(t('nearest'))}"></div>
      <div class="loc">
        <button type="button" id="gps" ${usingGps ? 'disabled' : ''}>📍 ${esc(t('useLocation'))}</button>
        <span class="muted">${esc(t(locationMessage))}</span>
      </div>
      <p class="sources"><b>${esc(t('sources'))}:</b> ${sources}</p>
      ${wrongBlock()}
    </article>`;
  bindChips(el);
  bindWrong(el);
  document.getElementById('gps')?.addEventListener('click', useLocation);
  drawMap(main, alt);
}

function bindChips(el: HTMLElement): void {
  el.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((b) =>
    b.addEventListener('click', () => choose(b.dataset.item!, { photoUrl: current?.photoUrl })),
  );
}

/** "Wrong answer?": the user says what it really was; kept only in localStorage. */
function wrongBlock(): string {
  return `<details class="wrong">
      <summary>${esc(t('wrong'))}</summary>
      <p class="muted">${esc(t('wrongAsk'))}</p>
      <input id="wrong-q" type="search" autocomplete="off" aria-label="${esc(t('searchPlaceholder'))}" placeholder="${esc(t('searchPlaceholder'))}" />
      <ul id="wrong-suggest" class="suggest"></ul>
      <button type="button" data-wrong-item="">${esc(t('wrongNone'))}</button>
      <p id="wrong-msg" class="muted" role="status"></p>
      <button type="button" id="wrong-copy" hidden>${esc(t('wrongCopy'))}</button>
    </details>`;
}

function bindWrong(el: HTMLElement): void {
  const box = el.querySelector<HTMLDetailsElement>('details.wrong');
  if (!box) return;
  const q = box.querySelector<HTMLInputElement>('#wrong-q')!;
  const list = box.querySelector<HTMLUListElement>('#wrong-suggest')!;
  const msg = box.querySelector<HTMLElement>('#wrong-msg')!;
  const copy = box.querySelector<HTMLButtonElement>('#wrong-copy')!;
  const store = localStore();
  const nameOf = (id: string) => itemById(id)?.name[lang] ?? id;
  q.addEventListener('input', () => {
    list.innerHTML = search(index, q.value, 4)
      .map((h) => `<li><button type="button" data-wrong-item="${h.item.id}">${esc(h.item.name[lang])}</button></li>`)
      .join('');
  });
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-wrong-item]');
    if (b && current) {
      const all = addReport(store, { shown: current.itemId, actual: b.dataset.wrongItem ?? '', photo: !!current.photoUrl });
      msg.textContent = `${t('wrongSaved')} (${all.length})`;
      list.innerHTML = '';
      q.value = '';
      copy.hidden = false;
    }
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportsText(listReports(store), nameOf));
      msg.textContent = t('wrongCopied');
    } catch {
      msg.textContent = reportsText(listReports(store), nameOf);
    }
  });
  if (listReports(store).length) copy.hidden = false;
}

function drawMap(main: StreamPlaces, alt?: StreamPlaces): void {
  const host = document.getElementById('map');
  if (!host) return;
  if (!navigator.onLine) {
    // Map tiles need the network; the nearest-container list above is computed on the phone.
    host.outerHTML = `<p class="callout info">${esc(t('offlineMap'))}</p>`;
    return;
  }
  map = L.map(host, { scrollWheelZoom: false }).setView(from, 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const pts: LatLon[] = [from];
  L.circleMarker(from, { radius: 8, color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 1 }).bindTooltip(usingGps ? '●' : 'Plaza de la Constitución').addTo(map);
  for (const group of [main, alt]) {
    if (!group) continue;
    for (const n of group.nearest) {
      pts.push(n.point);
      L.circleMarker(n.point, { radius: 10, color: '#fff', weight: 2, fillColor: group.stream.color, fillOpacity: 1 })
        .bindTooltip(`${group.stream.short[lang]} · ${formatDistance(n.meters)}`)
        .addTo(map);
    }
  }
  if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 });
}

function useLocation(): void {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      from = [pos.coords.latitude, pos.coords.longitude];
      usingGps = true;
      locationMessage = 'locationOn';
      renderResult();
    },
    () => {
      locationMessage = 'locationDenied';
      renderResult();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}

async function boot(): Promise<void> {
  shell();
  const [data, bank] = await Promise.all([
    fetch(`${base}data/containers.json`).then((r) => r.json() as Promise<ContainerData>),
    fetch(`${base}data/embeddings.json`).then((r) => r.json() as Promise<EmbeddingBankJson>),
  ]);
  finder = makeFinder(data);
  vision = new Vision(bank, (loaded, total) => {
    if (total > 0) setStatus(t('loadingModel'), (100 * loaded) / total);
  });
  (window as unknown as { __tirabien: unknown }).__tirabien = { streams: STREAMS.length, items: ITEMS.length };
  // Installable and offline: public/sw.js caches the app, its data and (after the first photo) the AI model.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${base}sw.js`).catch((e) => console.warn('service worker', e));
  }
}

boot().catch((e) => {
  console.error(e);
  app.innerHTML = `<p class="notice">TiraBien could not start: ${esc(String(e))}</p>`;
});
