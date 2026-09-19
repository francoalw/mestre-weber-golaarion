import { SKILL_ACTION_MAP, SKILL_ORDER, SKILL_ICONS } from "./skill-map.js";

const MODULE_ID = "mestre-weber-golaarion";
const TARGET_MODULE_ID = "pf2e-skill-actions";
const TARGET_HEADER_KEY = "PF2ESKILLACTIONS.SkillActions";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing skill-actions-groups`);
});

Hooks.on("renderCharacterSheetPF2e", (app, html) => {
  if (!game.modules.get(TARGET_MODULE_ID)?.active) return;
  // Defer to a microtask so this runs after every render hook (including the
  // Skill Actions module's own, synchronous, listener) has already inserted
  // its flat "Skill Actions" list, regardless of module load/registration order.
  queueMicrotask(() => groupSkillActions(app, html));
});

function groupSkillActions(app, html) {
  const actor = app.actor ?? app.document;
  if (!actor) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  const targetLabel = game.i18n.localize(TARGET_HEADER_KEY).trim();
  const header = Array.from(root.querySelectorAll("header.action-header")).find(
    (h) => h.textContent.trim() === targetLabel
  );
  if (!header) return;

  insertGroupedByNote(header);

  // A nota fica entre o header e a lista — pula ela ao procurar a <ol> de verdade.
  const afterHeader = header.nextElementSibling;
  const list = afterHeader?.classList.contains("skill-actions-groups-note") ? afterHeader.nextElementSibling : afterHeader;
  if (!list || list.tagName !== "OL" || list.classList.contains("skill-actions-groups-processed")) return;

  const items = Array.from(list.children).filter((el) => el.tagName === "LI");
  if (!items.length) return;

  const buckets = new Map();
  for (const li of items) {
    const itemId = li.dataset.itemId;
    const item = itemId ? actor.items.get(itemId) : null;
    const slug = item?.system?.slug ?? "";
    const skillKey = SKILL_ACTION_MAP[slug] ?? "general";
    if (!buckets.has(skillKey)) buckets.set(skillKey, []);
    buckets.get(skillKey).push(li);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));

  const wrapper = document.createElement("div");
  wrapper.className = "skill-actions-groups";

  for (const key of sortedKeys) {
    const group = document.createElement("div");
    group.className = "skill-actions-group";

    const subheader = document.createElement("div");
    subheader.className = "skill-actions-subheader";
    subheader.innerHTML = `<i class="fa-solid fa-fw ${SKILL_ICONS[key] ?? "fa-circle"}"></i><span>${skillLabel(actor, key)}</span>`;
    group.appendChild(subheader);

    const sublist = document.createElement("ol");
    sublist.className = "actions-list item-list directory-list";
    for (const li of buckets.get(key)) sublist.appendChild(li);
    group.appendChild(sublist);

    wrapper.appendChild(group);
  }

  list.replaceWith(wrapper);
}

function insertGroupedByNote(header) {
  if (header.nextElementSibling?.classList.contains("skill-actions-groups-note")) return;
  const note = document.createElement("div");
  note.className = "skill-actions-groups-note";
  note.innerHTML = game.i18n.localize("SKILLACTIONSGROUPS.GroupedByNote");
  header.after(note);
}

function skillLabel(actor, key) {
  if (key === "perception") return game.i18n.localize("PF2E.PerceptionLabel");
  if (key === "general") return game.i18n.localize("SKILLACTIONSGROUPS.General");
  return actor.system.skills?.[key]?.label ?? key;
}
