export const MODULE_ID = "mestre-weber-golaarion";
export const SETTING_HIDDEN_PACKS = "hiddenCompendiums";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_HIDDEN_PACKS, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
});

export function getHiddenPacks() {
  return game.settings.get(MODULE_ID, SETTING_HIDDEN_PACKS) ?? [];
}

export async function setHiddenPacks(ids) {
  await game.settings.set(MODULE_ID, SETTING_HIDDEN_PACKS, ids);
}

Hooks.on("renderCompendiumDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  hideEntries(root);
  injectManageButton(root);
});

// Compêndios do sistema/módulo não podem ser apagados de verdade pelo Foundry
// (deleteCompendium só permite packs "world"), então em vez de tentar contornar
// esse bloqueio (arriscado: pode corromper a pasta do pack ou voltar sozinho na
// próxima atualização do sistema), este ajuste apenas remove a entrada da lista.
function hideEntries(root) {
  const hidden = new Set(getHiddenPacks());
  if (!hidden.size) return;

  const entries = root.querySelectorAll("[data-pack]");
  for (const entry of entries) {
    if (hidden.has(entry.dataset.pack)) entry.remove();
  }
}

function injectManageButton(root) {
  if (!game.user.isGM) return;
  if (root.querySelector(".compendium-hider-manage-btn")) return;

  const anchor =
    root.querySelector('[data-action="createEntry"]') ??
    root.querySelector(".directory-header .header-actions") ??
    root.querySelector(".directory-footer") ??
    root.querySelector(".directory-header");
  if (!anchor) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "compendium-hider-manage-btn";
  btn.dataset.tooltip = game.i18n.localize("COMPHIDE.ManageButton");
  btn.innerHTML = `<i class="fa-solid fa-fw fa-eye-slash"></i>${game.i18n.localize("COMPHIDE.ManageButtonShort")}`;
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    const { openManageDialog } = await import("./manage-dialog.js");
    await openManageDialog();
  });

  if (anchor.tagName === "BUTTON") anchor.after(btn);
  else anchor.appendChild(btn);
}
