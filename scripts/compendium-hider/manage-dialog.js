import { getHiddenPacks, setHiddenPacks } from "./main.js";
import { escapeHTML } from "./util.js";

const GROUP_ORDER = ["system", "module", "world"];
const GROUP_LABEL_KEY = {
  system: "COMPHIDE.GroupSystem",
  module: "COMPHIDE.GroupModule",
  world: "COMPHIDE.GroupWorld"
};

export async function openManageDialog() {
  const packs = Array.from(game.packs).sort((a, b) => a.title.localeCompare(b.title));
  const hidden = new Set(getHiddenPacks());

  const groups = new Map();
  for (const pack of packs) {
    const type = pack.metadata.packageType ?? "world";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(pack);
  }

  const sections = GROUP_ORDER.filter((type) => groups.has(type))
    .map((type) => {
      const rows = groups
        .get(type)
        .map(
          (pack) => `
          <label class="compendium-hider-row">
            <input type="checkbox" name="pack:${pack.collection}" ${hidden.has(pack.collection) ? "checked" : ""} />
            <span>${escapeHTML(pack.title)}</span>
          </label>`
        )
        .join("");
      return `<fieldset class="compendium-hider-group"><legend>${game.i18n.localize(GROUP_LABEL_KEY[type])}</legend>${rows}</fieldset>`;
    })
    .join("");

  const content = `
    <p class="hint">${game.i18n.localize("COMPHIDE.Hint")}</p>
    <input type="search" class="compendium-hider-search" placeholder="${game.i18n.localize("COMPHIDE.SearchPlaceholder")}" />
    <div class="compendium-hider-form">${sections}</div>
  `;

  Hooks.on("renderDialogV2", onRenderDialog);

  let result;
  try {
    result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("COMPHIDE.ManageButton"), icon: "fa-solid fa-eye-slash" },
      position: { width: 460 },
      content,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("COMPHIDE.Save"),
          icon: "fa-solid fa-check",
          default: true,
          callback: (_event, button) => {
            const form = button.form;
            const newHidden = [];
            for (const pack of packs) {
              const input = form.elements.namedItem(`pack:${pack.collection}`);
              if (input instanceof HTMLInputElement && input.checked) newHidden.push(pack.collection);
            }
            return newHidden;
          }
        },
        {
          action: "cancel",
          label: game.i18n.localize("COMPHIDE.Cancel"),
          icon: "fa-solid fa-xmark",
          callback: () => null
        }
      ]
    });
  } catch {
    result = null;
  } finally {
    Hooks.off("renderDialogV2", onRenderDialog);
  }

  if (!result) return;

  await setHiddenPacks(result);
  ui.compendium?.render();
}

function onRenderDialog(_app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const search = root?.querySelector(".compendium-hider-search");
  if (!search) return;

  Hooks.off("renderDialogV2", onRenderDialog);

  const rows = root.querySelectorAll(".compendium-hider-row");
  const groups = root.querySelectorAll(".compendium-hider-group");

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const row of rows) {
      const matches = !query || row.textContent.toLowerCase().includes(query);
      row.classList.toggle("compendium-hider-row-hidden", !matches);
    }
    for (const group of groups) {
      const anyVisible = Array.from(group.querySelectorAll(".compendium-hider-row")).some(
        (row) => !row.classList.contains("compendium-hider-row-hidden")
      );
      group.classList.toggle("compendium-hider-group-hidden", !anyVisible);
    }
  });

  search.focus();
}
