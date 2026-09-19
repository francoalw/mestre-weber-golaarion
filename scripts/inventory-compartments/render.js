import {
  getCompartments,
  getItemCompartment,
  setItemCompartment,
  createCompartment,
  toggleCompartmentCollapsed
} from "./compartments.js";
import { escapeHTML } from "./util.js";

const NEW_VALUE = "__new__";

export function onRenderInventory(app, html) {
  const actor = app.actor ?? app.document;
  if (!actor) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  injectManageButton(root, actor);
  injectCompartmentPickers(root, actor);
  groupByCompartment(root, actor);
}

function injectManageButton(root, actor) {
  if (!actor.isOwner) return;
  const search = root.querySelector(".inventory-header .search");
  if (!search || search.parentElement?.querySelector(".compartment-manage-btn")) return;

  const btn = document.createElement("a");
  btn.className = "compartment-manage-btn";
  btn.dataset.tooltip = game.i18n.localize("INVCOMP.ManageCompartments");
  btn.innerHTML = '<i class="fa-solid fa-folder-tree"></i>';
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    const { openManageDialog } = await import("./manage-dialog.js");
    openManageDialog(actor);
  });
  search.after(btn);
}

function injectCompartmentPickers(root, actor) {
  if (!actor.isOwner) return;
  const compartments = getCompartments(actor);
  const rows = root.querySelectorAll("section[data-inventory] > ul.items[data-item-list] > li[data-item-id]");

  for (const li of rows) {
    const controls = li.querySelector(":scope > .data > .item-controls");
    if (!controls || controls.classList.contains("readonly")) continue;
    if (controls.querySelector(".compartment-picker")) continue;

    const item = actor.items.get(li.dataset.itemId);
    if (!item) continue;

    const current = getItemCompartment(item);
    const select = document.createElement("select");
    select.className = "compartment-picker";
    select.dataset.tooltip = game.i18n.localize("INVCOMP.AssignCompartment");
    select.innerHTML = buildOptions(compartments, current);

    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", async (event) => {
      event.stopPropagation();
      const value = select.value;
      if (value === NEW_VALUE) {
        const name = await promptCompartmentName();
        if (!name) {
          select.value = compartments.some((c) => c.id === current) ? current : "";
          return;
        }
        const compartment = await createCompartment(actor, name);
        if (compartment) await setItemCompartment(item, compartment.id);
      } else {
        await setItemCompartment(item, value || null);
      }
    });

    controls.insertBefore(select, controls.firstChild);
  }
}

function buildOptions(compartments, current) {
  const none = `<option value="">${game.i18n.localize("INVCOMP.NoCompartment")}</option>`;
  const options = compartments
    .map((c) => `<option value="${c.id}"${c.id === current ? " selected" : ""}>${escapeHTML(c.name)}</option>`)
    .join("");
  const add = `<option value="${NEW_VALUE}">${game.i18n.localize("INVCOMP.NewCompartmentOption")}</option>`;
  return none + options + add;
}

async function promptCompartmentName() {
  try {
    const name = await foundry.applications.api.DialogV2.input({
      window: { title: game.i18n.localize("INVCOMP.NewCompartment"), icon: "fa-solid fa-folder-plus" },
      content: `<div class="form-group"><label>${game.i18n.localize(
        "INVCOMP.NewCompartmentName"
      )}</label><input type="text" name="name" autofocus /></div>`,
      ok: {
        label: game.i18n.localize("INVCOMP.Create"),
        icon: "fa-solid fa-check",
        callback: (_event, button) => {
          const input = button.form.elements.namedItem("name");
          return input instanceof HTMLInputElement ? input.value.trim() : "";
        }
      }
    });
    return name || null;
  } catch {
    return null;
  }
}

function groupByCompartment(root, actor) {
  const compartments = getCompartments(actor);
  if (!compartments.length) return;

  const lists = root.querySelectorAll("section[data-inventory] > ul.items[data-item-list]");
  for (const ul of lists) {
    const lis = Array.from(ul.children).filter((el) => el.tagName === "LI");
    if (!lis.length) continue;

    const buckets = new Map();
    const rest = [];
    for (const li of lis) {
      const itemId = li.dataset.itemId;
      const item = itemId ? actor.items.get(itemId) : null;
      const compartmentId = item ? getItemCompartment(item) : null;
      const compartment = compartmentId ? compartments.find((c) => c.id === compartmentId) : null;
      if (compartment) {
        if (!buckets.has(compartment.id)) buckets.set(compartment.id, []);
        buckets.get(compartment.id).push(li);
      } else {
        rest.push(li);
      }
    }
    if (!buckets.size) continue;

    const frag = document.createDocumentFragment();
    for (const compartment of compartments) {
      const bucket = buckets.get(compartment.id);
      if (!bucket?.length) continue;
      frag.appendChild(buildGroupElement(compartment, bucket, actor));
    }
    for (const li of rest) frag.appendChild(li);
    ul.append(frag);

    attachRootDropHandler(ul, actor);
  }
}

function buildGroupElement(compartment, items, actor) {
  const li = document.createElement("li");
  li.className = `compartment-group${compartment.collapsed ? " collapsed" : ""}`;
  li.dataset.compartmentId = compartment.id;

  const header = document.createElement("div");
  header.className = "compartment-header";
  header.innerHTML = `
    <i class="fa-solid fa-chevron-right compartment-caret"></i>
    <i class="fa-solid fa-folder${compartment.collapsed ? "" : "-open"} fa-fw compartment-icon"></i>
    <span class="compartment-name">${escapeHTML(compartment.name)}</span>
    <span class="compartment-count">${items.length}</span>
  `;
  header.addEventListener("click", async () => {
    await toggleCompartmentCollapsed(actor, compartment.id);
  });
  li.appendChild(header);

  const nested = document.createElement("ul");
  nested.className = "items compartment-contents";
  for (const item of items) {
    ensureDraggable(item, actor);
    nested.appendChild(item);
  }
  li.appendChild(nested);

  attachDropHandler(li, actor, compartment.id, li);

  return li;
}

// Foundry marks each inventory row as draggable on its own, but once we move a row
// into our nested compartment list that can be lost, and the browser falls back to
// a text-selection drag that visually "selects" the whole folder instead of moving
// just the one item. Binding our own dragstart guarantees a real, single-item drag.
function ensureDraggable(li, actor) {
  if (li.dataset.compartmentDragBound) return;
  li.dataset.compartmentDragBound = "1";
  li.draggable = true;
  li.addEventListener("dragstart", (event) => {
    const item = actor.items.get(li.dataset.itemId);
    if (!item) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });
}

function attachDropHandler(target, actor, compartmentId, highlightEl) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    highlightEl.classList.add("drag-over");
  });
  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) highlightEl.classList.remove("drag-over");
  });
  target.addEventListener("drop", async (event) => {
    highlightEl.classList.remove("drag-over");
    const item = resolveDroppedOwnItem(event, actor);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    await setItemCompartment(item, compartmentId);
  });
}

function attachRootDropHandler(ul, actor) {
  if (ul.dataset.compartmentRootBound) return;
  ul.dataset.compartmentRootBound = "1";
  ul.addEventListener("dragover", (event) => event.preventDefault());
  ul.addEventListener("drop", async (event) => {
    const item = resolveDroppedOwnItem(event, actor);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    await setItemCompartment(item, null);
  });
}

function resolveDroppedOwnItem(event, actor) {
  let data;
  try {
    data = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
  if (!data || data.type !== "Item" || !data.uuid) return null;
  const item = fromUuidSync(data.uuid);
  if (!item || item.actor?.uuid !== actor.uuid) return null;
  return item;
}
