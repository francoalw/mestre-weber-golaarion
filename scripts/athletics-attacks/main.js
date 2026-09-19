const MODULE_ID = "mestre-weber-golaarion";
const MANEUVER_SLUGS = ["grapple", "trip", "disarm", "shove", "reposition"];
const BLOCK_MARKER = "athletics-attacks-block";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing athletics-attacks`);
});

Hooks.on("renderCharacterSheetPF2e", onRenderCharacterSheet);
Hooks.on("renderCharacterConfig", onRenderCharacterConfig);

function onRenderCharacterSheet(app, html) {
  const actor = app.actor ?? app.document;
  if (!actor || !actor.isOfType("character") || !actor.isOwner) return;

  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  root.querySelector(`[data-${BLOCK_MARKER}]`)?.remove();

  if (actor.getFlag(MODULE_ID, "showManeuvers") === false) return;

  const strikesList = root.querySelector("[data-strikes]");
  if (!strikesList) return;

  const rows = MANEUVER_SLUGS.map((slug) => buildManeuverRow(actor, slug)).filter(Boolean);
  if (!rows.length) return;

  const block = document.createElement("div");
  block.dataset[toCamelCase(BLOCK_MARKER)] = "";

  const header = document.createElement("header");
  header.textContent = game.i18n.localize("ATHLETICSATK.SectionHeader");

  const list = document.createElement("ol");
  list.className = "actions-list item-list directory-list athletics-attacks-list";
  list.append(...rows);

  block.append(header, list);
  block.addEventListener("click", (event) => onManeuverClick(event, actor));

  strikesList.after(block);
}

function toCamelCase(kebab) {
  return kebab.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

// O sistema PF2e não tem tradução pt-BR para os nomes dessas ações (o mundo cai no
// fallback em inglês nesses casos), então traduzimos aqui em vez de usar action.name.
function maneuverLabel(slug, action) {
  const key = `ATHLETICSATK.Maneuvers.${slug}`;
  const localized = game.i18n.localize(key);
  return localized !== key ? localized : game.i18n.localize(action.name);
}

function onRenderCharacterConfig(app, html) {
  const actor = app.actor ?? app.object;
  if (!actor || !actor.isOfType("character")) return;

  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  const fieldName = `flags.${MODULE_ID}.showManeuvers`;
  if (root.querySelector(`[name="${fieldName}"]`)) return;

  const submitButton = root.querySelector('form button[type="submit"]');
  if (!submitButton) return;

  const checked = actor.getFlag(MODULE_ID, "showManeuvers") !== false;

  const group = document.createElement("div");
  group.className = "form-group";
  group.innerHTML = `
    <label>${game.i18n.localize("ATHLETICSATK.Configure.Label")}</label>
    <input type="checkbox" name="${fieldName}" ${checked ? "checked" : ""} />
    <p class="hint">${game.i18n.localize("ATHLETICSATK.Configure.Hint")}</p>
  `;

  submitButton.before(group);
  app.setPosition?.({ height: "auto" });
}

function buildManeuverRow(actor, slug) {
  const action = game.pf2e.actions?.get(slug);
  if (!action) {
    console.warn(`${MODULE_ID} | Ação de sistema "${slug}" não encontrada; o sistema pf2e pode ter mudado.`);
    return null;
  }

  const statisticSlug = Array.isArray(action.statistic) ? action.statistic[0] : action.statistic;
  const statistic = actor.getStatistic(statisticSlug);
  if (!statistic) return null;

  const baseModifier = statistic.mod;
  const saveKey = CONFIG.PF2E.saves[action.difficultyClass];
  const subtitle = game.i18n.format("ATHLETICSATK.RowSubtitle", {
    skill: statistic.label,
    save: saveKey ? game.i18n.localize(saveKey) : action.difficultyClass
  });

  const li = document.createElement("li");
  li.className = "strike ready";
  li.dataset.slug = slug;

  const image = document.createElement("div");
  image.className = "item-image variant-strike framed ready";
  image.dataset.action = "athletics-attack";
  image.dataset.slug = slug;
  image.dataset.mapIncreases = "0";
  image.innerHTML = `<img src="${action.img}" /><i class="fa-solid fa-dice-d20" inert></i>`;

  const section = document.createElement("section");

  const name = document.createElement("h4");
  name.className = "name";
  name.innerHTML = `<span>${maneuverLabel(slug, action)}</span><span class="action-glyph">${action.glyph}</span>`;
  name.dataset.tooltip = subtitle;

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "button-group tags";
  buttonGroup.dataset.tooltipDirection = "UP";
  buttonGroup.append(
    buildVariantButton(action, baseModifier, 0),
    buildVariantButton(action, baseModifier, 1),
    buildVariantButton(action, baseModifier, 2)
  );

  section.append(name, buttonGroup);
  li.append(image, section);
  return li;
}

function buildVariantButton(action, baseModifier, mapIncreases) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag tag_secondary variant-strike";
  button.dataset.action = "athletics-attack";
  button.dataset.slug = action.slug;
  button.dataset.mapIncreases = String(mapIncreases);

  const penalty = mapIncreases === 0 ? 0 : mapIncreases === 1 ? -5 : -10;
  const value = baseModifier + penalty;
  const label =
    penalty === 0
      ? signed(value)
      : game.i18n.format("PF2E.MAPAbbreviationValueLabel", { value: signed(value), penalty: String(penalty) });

  button.textContent = label;
  return button;
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

async function onManeuverClick(event, actor) {
  const button = event.target.closest('[data-action="athletics-attack"]');
  if (!button) return;
  event.preventDefault();

  const slug = button.dataset.slug;
  const mapIncreases = Number(button.dataset.mapIncreases ?? "0");
  const action = game.pf2e.actions?.get(slug);
  if (!action) {
    ui.notifications.error(`${MODULE_ID} | Ação de sistema "${slug}" não encontrada.`);
    return;
  }

  await action.use({
    actors: [actor],
    event,
    multipleAttackPenalty: mapIncreases
  });
}
