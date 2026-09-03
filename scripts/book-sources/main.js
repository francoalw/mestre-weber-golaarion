export const MODULE_ID = "mestre-weber-golaarion";
export const SETTING_BOOK_SOURCES = "bookSources";

const DEFAULT_BOOK_SOURCES = { enabled: false, showUnknown: true, allowed: [] };

// Mesmos campos que o próprio PF2e usa para descobrir de qual livro cada item/ator veio
// (Compendium Browser, PackLoader#loadSources) — mantido igual para o slug bater com o dele.
const SOURCE_FIELDS = ["system.publication.title", "system.source.value"];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_BOOK_SOURCES, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_BOOK_SOURCES
  });
});

export function getBookSources() {
  return game.settings.get(MODULE_ID, SETTING_BOOK_SOURCES) ?? DEFAULT_BOOK_SOURCES;
}

function getSourceTitle(entry) {
  const t = entry.system;
  return t?.publication?.title ?? t?.source?.value ?? "";
}

function getSourceSlug(entry) {
  const title = getSourceTitle(entry);
  return title ? game.pf2e.system.sluggify(title) : "";
}

// Varre todos os compêndios de Ator/Item carregados (sistema, módulos e mundo) atrás dos
// livros realmente presentes nesta instância, para montar a lista de checkboxes do diálogo.
export async function scanKnownSources() {
  const sources = new Map();
  const packs = game.packs.filter((p) => p.documentName === "Actor" || p.documentName === "Item");
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: SOURCE_FIELDS });
    for (const entry of index) {
      const slug = getSourceSlug(entry);
      if (slug && !sources.has(slug)) sources.set(slug, getSourceTitle(entry));
    }
  }
  return sources;
}

export async function setBookSources(data, known) {
  await game.settings.set(MODULE_ID, SETTING_BOOK_SOURCES, data);
  await syncPf2eBrowserSources(data, known ?? (await scanKnownSources()));
  indexCache.clear();
}

// Em vez de reimplementar a filtragem, aproveita o próprio filtro de fontes do Compendium
// Browser do sistema (Configurações > Compendium Browser): assim a criação de personagem,
// a busca de itens e a busca de talentos — que já passam por ali — respeitam os livros
// escolhidos aqui, sem duplicar lógica nem depender de detalhes internos do sistema.
async function syncPf2eBrowserSources(data, known) {
  const browserSettings = game.settings.get("pf2e", "compendiumBrowserSources");
  const allowed = new Set(data.allowed);
  const sources = { ...browserSettings.sources };

  for (const [slug, title] of known) {
    sources[slug] = { load: data.enabled ? allowed.has(slug) : true, name: title };
  }

  await game.settings.set("pf2e", "compendiumBrowserSources", {
    ...browserSettings,
    ignoreAsGM: true,
    showEmptySources: data.enabled ? data.showUnknown : true,
    showUnknownSources: data.enabled ? data.showUnknown : true,
    sources
  });
}

// -- filtro nos compêndios abertos diretamente pela aba Compêndios (fora do Compendium Browser) --

const indexCache = new Map();

async function getIndexSlugs(pack) {
  if (indexCache.has(pack.collection)) return indexCache.get(pack.collection);
  const index = await pack.getIndex({ fields: SOURCE_FIELDS });
  const map = new Map();
  for (const entry of index) map.set(entry._id, getSourceSlug(entry));
  indexCache.set(pack.collection, map);
  return map;
}

Hooks.on("renderCompendium", async (app, html) => {
  if (game.user.isGM) return;

  const data = getBookSources();
  if (!data.enabled) return;

  const pack = app.collection;
  if (!pack || (pack.documentName !== "Actor" && pack.documentName !== "Item")) return;

  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  const slugs = await getIndexSlugs(pack);
  const allowed = new Set(data.allowed);

  for (const entry of root.querySelectorAll("[data-entry-id]")) {
    const slug = slugs.get(entry.dataset.entryId) ?? "";
    const visible = slug ? allowed.has(slug) : data.showUnknown;
    if (!visible) entry.remove();
  }

  for (const folder of Array.from(root.querySelectorAll(".folder")).reverse()) {
    if (!folder.querySelector("[data-entry-id]")) folder.remove();
  }
});

// -- botão "Livros" na aba Compêndios, ao lado de "Criar Compêndio" --

Hooks.on("renderCompendiumDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;
  injectManageButton(root);
});

function injectManageButton(root) {
  if (!game.user.isGM) return;
  if (root.querySelector(".book-sources-manage-btn")) return;

  const anchor =
    root.querySelector('[data-action="createEntry"]') ??
    root.querySelector(".directory-header .header-actions") ??
    root.querySelector(".directory-footer") ??
    root.querySelector(".directory-header");
  if (!anchor) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "book-sources-manage-btn";
  btn.dataset.tooltip = game.i18n.localize("BOOKSRC.ManageButton");
  btn.innerHTML = `<i class="fa-solid fa-fw fa-book"></i>${game.i18n.localize("BOOKSRC.ManageButtonShort")}`;
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    const { openManageDialog } = await import("./manage-dialog.js");
    await openManageDialog();
  });

  if (anchor.tagName === "BUTTON") anchor.after(btn);
  else anchor.appendChild(btn);
}
