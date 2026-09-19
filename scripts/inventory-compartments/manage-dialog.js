import { getCompartments, renameCompartment, deleteCompartment, createCompartment } from "./compartments.js";
import { escapeHTML } from "./util.js";

export async function openManageDialog(actor) {
  const compartments = getCompartments(actor);

  const rows = compartments
    .map(
      (c) => `
      <div class="form-group compartment-row">
        <label>
          <input type="text" name="name-${c.id}" value="${escapeHTML(c.name)}" />
        </label>
        <label class="compartment-delete" data-tooltip="${game.i18n.localize("INVCOMP.Delete")}">
          <input type="checkbox" name="delete-${c.id}" />
          <i class="fa-solid fa-trash"></i>
        </label>
      </div>`
    )
    .join("");

  const content = `
    <div class="inventory-compartments-manage-form">
      ${compartments.length ? `<div class="compartment-rows">${rows}</div>` : `<p class="hint">${game.i18n.localize("INVCOMP.NoCompartmentsYet")}</p>`}
      <div class="form-group compartment-add">
        <label>${game.i18n.localize("INVCOMP.NewCompartmentName")}</label>
        <input type="text" name="newName" placeholder="${game.i18n.localize("INVCOMP.NewCompartmentNamePlaceholder")}" />
      </div>
    </div>
  `;

  let result;
  try {
    result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("INVCOMP.ManageCompartments"), icon: "fa-solid fa-folder-tree" },
      position: { width: 420 },
      content,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("INVCOMP.Save"),
          icon: "fa-solid fa-check",
          default: true,
          callback: (_event, button) => {
            const form = button.form;
            const renames = {};
            const deletions = [];
            for (const compartment of compartments) {
              const deleteInput = form.elements.namedItem(`delete-${compartment.id}`);
              if (deleteInput instanceof HTMLInputElement && deleteInput.checked) {
                deletions.push(compartment.id);
                continue;
              }
              const nameInput = form.elements.namedItem(`name-${compartment.id}`);
              if (nameInput instanceof HTMLInputElement) renames[compartment.id] = nameInput.value.trim();
            }
            const newNameInput = form.elements.namedItem("newName");
            const newName = newNameInput instanceof HTMLInputElement ? newNameInput.value.trim() : "";
            return { renames, deletions, newName };
          }
        },
        {
          action: "cancel",
          label: game.i18n.localize("INVCOMP.Cancel"),
          icon: "fa-solid fa-xmark",
          callback: () => null
        }
      ]
    });
  } catch {
    result = null;
  }

  if (!result) return;

  for (const compartment of compartments) {
    if (result.deletions.includes(compartment.id)) {
      await deleteCompartment(actor, compartment.id);
      continue;
    }
    const newName = result.renames[compartment.id];
    if (newName && newName !== compartment.name) await renameCompartment(actor, compartment.id, newName);
  }

  if (result.newName) await createCompartment(actor, result.newName);
}
