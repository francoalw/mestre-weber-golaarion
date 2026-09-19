const MODULE_ID = "mestre-weber-golaarion";

// Força cada palavra do nome do local a começar com maiúscula (e o resto em minúscula),
// não importa como o Mestre digitou — "floresta SOMBRIA" ou "floresta sombria" viram
// "Floresta Sombria".
function toTitleCase(str) {
  return str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// Botão na barra de navegação de cenas (só pro Mestre) que substitui o antigo macro de
// exemplo "Anúncio - Novo Local": abre um formulário pedindo o nome do local e dispara
// o anúncio de tela cheia (scripts/screen-announcement) com esse nome, sem precisar de
// macro nem digitar comando nenhum.
Hooks.on("renderSceneNavigation", (_app, element) => {
  if (!game.user.isGM) return;
  injectRevealButton(element);
});

function injectRevealButton(root) {
  if (root.querySelector(".mw-reveal-location-btn")) return;

  // Sem a classe "nav-item": ela carrega posicionamento próprio do core (pensado pro
  // botão de expandir/pips), e colar ela num botão nosso jogava o elemento pra fora da
  // barra de cenas (acabava sobrepondo a lista de jogadores no canto da tela).
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mw-reveal-location-btn";
  btn.dataset.tooltip = game.i18n.localize("REVEALLOC.Button");
  btn.innerHTML = `<i class="fa-solid fa-map-location-dot"></i>`;
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    console.log(`${MODULE_ID} | reveal-location | botão clicado`);
    await promptAndReveal();
  });

  // Logo ao lado do card da cena atualmente visualizada (a com a classe "view").
  const viewedScene = root.querySelector(".scene-list .scene.view") ?? root.querySelector(".scene.view");
  const sceneList = root.querySelector(".scene-list");
  if (viewedScene && viewedScene.parentElement?.tagName === "OL") {
    // Dentro de um <ol>, o filho precisa ser um <li> pra ficar 100% válido/consistente
    // com os outros itens da lista.
    const li = document.createElement("li");
    li.className = "mw-reveal-location-item";
    li.appendChild(btn);
    viewedScene.after(li);
  } else if (viewedScene) {
    viewedScene.after(btn);
  } else if (sceneList) {
    sceneList.append(btn);
  } else {
    root.appendChild(btn);
  }
}

async function promptAndReveal() {
  let name;
  try {
    name = await foundry.applications.api.DialogV2.input({
      window: { title: game.i18n.localize("REVEALLOC.DialogTitle"), icon: "fa-solid fa-map-location-dot" },
      content: `<div class="form-group"><label>${game.i18n.localize(
        "REVEALLOC.NameLabel"
      )}</label><input type="text" name="name" autofocus style="text-transform: capitalize;" /></div>`,
      ok: {
        label: game.i18n.localize("REVEALLOC.Reveal"),
        icon: "fa-solid fa-check",
        callback: (_event, button) => {
          const input = button.form.elements.namedItem("name");
          return input instanceof HTMLInputElement ? toTitleCase(input.value.trim()) : "";
        }
      }
    });
  } catch (err) {
    // Erro de verdade ao montar/abrir o diálogo (diferente de "cancelou", que resolve
    // com null em vez de lançar) — loga e avisa em vez de sumir silenciosamente.
    console.error(`${MODULE_ID} | reveal-location | falha ao abrir o diálogo:`, err);
    ui.notifications?.error(`Golaarion | Revelar local: ${err.message}`);
    return;
  }
  console.log(`${MODULE_ID} | reveal-location | nome recebido do diálogo:`, name);
  if (!name) return;

  const api = game.modules.get(MODULE_ID)?.api;
  if (!api?.showAnnouncement) {
    console.error(`${MODULE_ID} | reveal-location | API showAnnouncement indisponível`);
    ui.notifications?.error(game.i18n.localize("REVEALLOC.ApiMissing"));
    return;
  }
  api.showAnnouncement(name);
}
