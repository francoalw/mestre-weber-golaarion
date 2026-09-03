import { getBookSources, setBookSources, scanKnownSources } from "./main.js";
import { escapeHTML } from "./util.js";

export async function openManageDialog() {
  const progress = ui.notifications.info(game.i18n.localize("BOOKSRC.Scanning"), { progress: true });
  let known;
  try {
    known = await scanKnownSources();
  } finally {
    progress.update({ pct: 1 });
  }

  const current = getBookSources();
  const allowed = new Set(current.allowed);
  const defaultChecked = current.allowed.length === 0;

  const entries = Array.from(known.entries()).sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang));

  const rows = entries
    .map(
      ([slug, title]) => `
      <label class="book-sources-row">
        <input type="checkbox" name="book:${slug}" ${defaultChecked || allowed.has(slug) ? "checked" : ""} />
        <span>${escapeHTML(title)}</span>
      </label>`
    )
    .join("");

  const content = `
    <p class="hint">${game.i18n.localize("BOOKSRC.Hint")}</p>
    <label class="book-sources-toggle">
      <input type="checkbox" name="enabled" ${current.enabled ? "checked" : ""} />
      <strong>${game.i18n.localize("BOOKSRC.Enable")}</strong>
    </label>
    <label class="book-sources-toggle">
      <input type="checkbox" name="showUnknown" ${current.showUnknown ? "checked" : ""} />
      ${game.i18n.localize("BOOKSRC.ShowUnknown")}
    </label>
    <div class="book-sources-actions">
      <input type="search" class="book-sources-search" placeholder="${game.i18n.localize("BOOKSRC.SearchPlaceholder")}" />
      <button type="button" class="book-sources-all">${game.i18n.localize("BOOKSRC.SelectAll")}</button>
      <button type="button" class="book-sources-none">${game.i18n.localize("BOOKSRC.SelectNone")}</button>
    </div>
    <div class="book-sources-form">${rows || `<p class="hint">${game.i18n.localize("BOOKSRC.NoSources")}</p>`}</div>
  `;

  Hooks.on("renderDialogV2", onRenderDialog);

  let result;
  try {
    result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("BOOKSRC.ManageButton"), icon: "fa-solid fa-book" },
      position: { width: 480, height: 640 },
      content,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("BOOKSRC.Save"),
          icon: "fa-solid fa-check",
          default: true,
          callback: (_event, button) => {
            const form = button.form;
            const newAllowed = [];
            for (const [slug] of entries) {
              const input = form.elements.namedItem(`book:${slug}`);
              if (input instanceof HTMLInputElement && input.checked) newAllowed.push(slug);
            }
            const enabledInput = form.elements.namedItem("enabled");
            const showUnknownInput = form.elements.namedItem("showUnknown");
            return {
              enabled: enabledInput instanceof HTMLInputElement && enabledInput.checked,
              showUnknown: showUnknownInput instanceof HTMLInputElement && showUnknownInput.checked,
              allowed: newAllowed
            };
          }
        },
        {
          action: "cancel",
          label: game.i18n.localize("BOOKSRC.Cancel"),
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

  await setBookSources(result, known);
  ui.compendium?.render();
  ui.notifications.info(game.i18n.localize("BOOKSRC.Saved"));
}

function onRenderDialog(_app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const search = root?.querySelector(".book-sources-search");
  if (!search) return;

  Hooks.off("renderDialogV2", onRenderDialog);

  const rows = root.querySelectorAll(".book-sources-row");

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const row of rows) {
      const matches = !query || row.textContent.toLowerCase().includes(query);
      row.classList.toggle("book-sources-row-hidden", !matches);
    }
  });

  root.querySelector(".book-sources-all")?.addEventListener("click", () => {
    for (const row of rows) {
      if (!row.classList.contains("book-sources-row-hidden")) row.querySelector("input").checked = true;
    }
  });
  root.querySelector(".book-sources-none")?.addEventListener("click", () => {
    for (const row of rows) {
      if (!row.classList.contains("book-sources-row-hidden")) row.querySelector("input").checked = false;
    }
  });

  search.focus();
}
