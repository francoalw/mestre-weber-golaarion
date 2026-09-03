const MODULE_ID = "mestre-weber-golaarion";
const HIGHLIGHT_CLASS = "mw-feat-unmet";
const PROFICIENCY_RANKS = { untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4 };

// Palavras que indicam que o pré-requisito é prosa/condição especial (nível, tradição, tamanho, etc.),
// não o nome de um talento/característica — nesses casos preferimos não arriscar um falso positivo.
const NON_FEAT_NAME_HINTS =
  /\b(must|level|you|rank|proficiency|trained|expert|master|legendary|class feature|deity|edict|anathema|class|background|tradition|spellcasting|size|alignment|dedication\s+feat)\b/i;

let browsingActor = null;
const itemPromiseCache = new Map();
const log = (...args) => console.log(`${MODULE_ID} | talent-requirements |`, ...args);

Hooks.on("renderCompendiumBrowser", (app) => {
  const container = findResultListContainer(app);
  if (!container) return;
  ensureObserver(app, container);
  syncHighlights(app, container);
});
Hooks.on("closeCompendiumBrowser", () => {
  browsingActor = null;
});

// Captura em fase de "capture" para rodar antes do próprio handler do sistema abrir o buscador,
// assim já sabemos qual ator disparou a busca. Não dependemos só do hook "renderCompendiumBrowser"
// (ele só dispara no primeiro render da sessão) — depois do clique também tentamos anexar o
// observer diretamente, cobrindo o caso comum de o Buscador já estar aberto/renderizado antes.
document.addEventListener(
  "click",
  (event) => {
    const trigger = event.target?.closest?.("[data-action='browse-feats']");
    if (!trigger) return;

    const actor = resolveActorFromElement(trigger);
    if (!actor) {
      console.warn(`${MODULE_ID} | talent-requirements | clique em "browse-feats" mas não achei o ator dono da ficha`, trigger);
      return;
    }
    log("clique em browse-feats, ator:", actor.name);
    browsingActor = actor;
    tryAttachObserver();
  },
  true
);

// Em vez de adivinhar a classe CSS da janela (mudou entre versões do Foundry e foi o motivo do
// bug anterior), procuramos entre todos os apps abertos qual deles CONTÉM o elemento clicado.
function resolveActorFromElement(el) {
  const v1Apps = Object.values(ui.windows ?? {});
  const v2Apps = Array.from(foundry.applications?.instances?.values?.() ?? []);
  for (const app of [...v1Apps, ...v2Apps]) {
    if (!app?.actor) continue;
    const node = app.element?.jquery ? app.element[0] : app.element;
    if (node?.contains?.(el)) return app.actor;
  }
  return null;
}

// "resultList" no CompendiumBrowser começa como um <ul> "placeholder" criado em memória
// (nunca inserido na página) até o componente Svelte terminar de montar e substituir essa
// referência pela <ul> real. Por isso preferimos sempre buscar no DOM de verdade primeiro
// (querySelector só acha elementos realmente inseridos na página) — usar "resultList" direto
// arriscava grudar o observer num elemento fantasma que nunca muda.
function findResultListContainer(app) {
  const fromDom = app?.element?.querySelector?.(".result-list");
  if (fromDom instanceof HTMLElement) return fromDom;
  const bound = app?.resultList;
  if (bound instanceof HTMLElement && bound.isConnected) return bound;
  return null;
}

function tryAttachObserver(attemptsLeft = 60) {
  const app = game.pf2e?.compendiumBrowser;
  const container = findResultListContainer(app);
  if (container) {
    ensureObserver(app, container);
    syncHighlights(app, container);
    return;
  }
  if (attemptsLeft <= 0) {
    console.warn(`${MODULE_ID} | talent-requirements | não encontrei a lista de resultados do Buscador de Compêndio`);
    return;
  }
  requestAnimationFrame(() => tryAttachObserver(attemptsLeft - 1));
}

// Garante o MutationObserver uma única vez por elemento; a sincronização em si (syncHighlights)
// é sempre chamada por fora, tanto aqui quanto após cada clique em "browse-feats", porque o
// Buscador de Compêndio costuma continuar montado (mesmo <ul>) entre uma busca e outra na mesma sessão.
function ensureObserver(app, container) {
  if (container.dataset.mwObserved) return;
  container.dataset.mwObserved = "1";
  log("observer anexado à lista de resultados");

  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncHighlights(app, container);
    });
  };

  new MutationObserver(scheduleSync).observe(container, { childList: true });
}

async function syncHighlights(app, container) {
  const rows = Array.from(container.children);
  if (app.activeTabName !== "feat" || !browsingActor) {
    for (const row of rows) row.classList.remove(HIGHLIGHT_CLASS);
    return;
  }

  const actor = browsingActor;
  const entries = app.tabs?.feat?.results ?? [];
  const count = Math.min(rows.length, entries.length);
  log(`sincronizando ${count} linha(s) para ${actor.name} (nível ${actor.level})`);

  await Promise.all(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const row = rows[i];
      const entry = entries[i];
      if (!entry?.uuid) {
        row.classList.remove(HIGHLIGHT_CLASS);
        return;
      }
      const meets = await actorMeetsFeatRequirements(actor, entry.uuid);
      row.classList.toggle(HIGHLIGHT_CLASS, !meets);
    })
  );
}

function getItem(uuid) {
  if (!itemPromiseCache.has(uuid)) itemPromiseCache.set(uuid, fromUuid(uuid));
  return itemPromiseCache.get(uuid);
}

async function actorMeetsFeatRequirements(actor, uuid) {
  const item = await getItem(uuid);
  if (!item) return true;

  const level = item.system?.level?.value;
  if (typeof level === "number" && (actor.level ?? 0) < level) return false;

  const prerequisites = item.system?.prerequisites?.value ?? [];
  return prerequisites.every((entry) => isPrerequisiteMet(actor, entry?.value ?? ""));
}

// Só marcamos como "não cumprido" quando temos confiança razoável (nível já é checado antes desta função):
// treino mínimo de perícia citado no texto, ou o nome de um talento/característica/ancestralidade que
// o personagem não possui. Qualquer outra coisa (prosa livre, condições que não sabemos interpretar)
// é ignorada de propósito, para não pintar de vermelho um talento que o personagem pode pegar.
function isPrerequisiteMet(actor, rawClause) {
  const clause = rawClause.trim();
  if (!clause) return true;

  const rankMatch = /\b(trained|expert|master|legendary)\b\s+in\s+(?:the\s+)?(.+?)(?:\s+skill)?\.?$/i.exec(clause);
  if (rankMatch) {
    const requiredRank = PROFICIENCY_RANKS[rankMatch[1].toLowerCase()];
    const actualRank = actorSkillRank(actor, rankMatch[2]);
    return actualRank === null ? true : actualRank >= requiredRank;
  }

  if (!looksLikeFeatNameList(clause)) return true;

  const alternatives = clause.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
  return alternatives.some((name) => actorHasNamedPrerequisite(actor, name));
}

function looksLikeFeatNameList(text) {
  return /^[A-Z]/.test(text) && !/\d/.test(text) && !NON_FEAT_NAME_HINTS.test(text);
}

function actorSkillRank(actor, skillLabel) {
  const target = skillLabel.trim().toLowerCase();
  // "slug" (ex.: "deception", "home-region-lore") é o nome interno da perícia — comparamos
  // por ele primeiro porque "skill.label" costuma ser uma CHAVE de tradução (ex.: "PF2E.Skill.Deception"),
  // não o texto já traduzido, então comparar direto com o texto do pré-requisito não funciona.
  const targetSlug = target.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const [slug, skill] of Object.entries(actor.skills ?? {})) {
    if (!skill) continue;
    if (slug === target || slug === targetSlug) return skill.rank ?? 0;
    const localizedLabel = String(game.i18n.localize(skill.label ?? "") ?? "").toLowerCase();
    if (localizedLabel && localizedLabel === target) return skill.rank ?? 0;
  }
  return null;
}

function actorHasNamedPrerequisite(actor, name) {
  const target = name.trim().toLowerCase();
  if (!target) return true;

  const namedItemMatches = (item) => {
    const itemName = item.name.toLowerCase();
    return itemName === target || itemName.includes(target) || target.includes(itemName);
  };

  const types = actor.itemTypes ?? {};
  const pools = [types.feat, types.feature, types.ancestry, types.heritage].filter(Boolean);
  if (pools.some((pool) => pool.some(namedItemMatches))) return true;

  const traits = actor.system?.traits?.value ?? [];
  return traits.some((trait) => String(trait).toLowerCase() === target);
}
