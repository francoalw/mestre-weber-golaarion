const MODULE_ID = "mestre-weber-golaarion";

// Roda uma vez por sessão, só pro Mestre, sussurrado — resumo do que o módulo carregou
// e como cada feature está configurada nesse mundo, pra não precisar abrir Configurações
// do Mundo toda vez que quiser conferir.
Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  printStartupSummary();
});

function printStartupSummary() {
  const items = [];

  const skillActionsModule = game.modules.get("pf2e-skill-actions");
  items.push(
    skillActionsModule?.active
      ? "<strong>Subcategorias de perícia</strong>: ativo (pf2e-skill-actions detectado)"
      : "<strong>Subcategorias de perícia</strong>: inativo — módulo pf2e-skill-actions não está ativo"
  );

  items.push("<strong>Destaque de talentos sem requisito cumprido</strong>: ativo no Buscador de Compêndio");

  items.push("<strong>Sussurro ao Mestre de mudanças de ficha</strong>: ativo");

  const nextTurnEnabled = game.settings.get(MODULE_ID, "nextTurnNotifyEnabled");
  const nextTurnVolume = game.settings.get(MODULE_ID, "nextTurnNotifyVolume");
  items.push(
    nextTurnEnabled
      ? `<strong>Notificação de turno</strong>: ativo (volume ${nextTurnVolume})`
      : "<strong>Notificação de turno</strong>: desativado"
  );

  const bookSources = game.settings.get(MODULE_ID, "bookSources") ?? { enabled: false, allowed: [] };
  items.push(
    bookSources.enabled
      ? `<strong>Livros permitidos</strong>: restrito a ${bookSources.allowed?.length ?? 0} livro(s)`
      : "<strong>Livros permitidos</strong>: sem restrição (todos os livros visíveis)"
  );

  const animation = game.settings.get(MODULE_ID, "announceDefaultAnimation");
  items.push(
    `<strong>Anúncio de tela</strong>: botão "Revelar local" na barra de cenas pronto, e disparo via API pra outros casos (animação padrão: ${animation})`
  );

  const maxHeroPoints = game.settings.get(MODULE_ID, "maxHeroPoints");
  items.push(`<strong>Máximo de Pontos Heróicos</strong>: ${maxHeroPoints}`);

  items.push("<strong>Compartimentos de Inventário</strong>: ativo (pastas virtuais na aba Inventário)");

  items.push(
    "<strong>Manobras de Atletismo como Ataques</strong>: ativo por padrão na aba Ações (pode ser desativado por personagem em Configure Character)"
  );

  items.push(
    '<strong>Terreno Difícil</strong>: botão "Desenhar Terreno Difícil" disponível na aba Região dos Controles de Cena'
  );

  const hiddenPacks = game.settings.get(MODULE_ID, "hiddenCompendiums") ?? [];
  items.push(
    hiddenPacks.length
      ? `<strong>Ocultar compêndios</strong>: ${hiddenPacks.length} compêndio(s) escondido(s) da aba Compêndios`
      : "<strong>Ocultar compêndios</strong>: nenhum compêndio escondido"
  );

  const content = `
    <div class="mw-golaarion-startup">
      <p><strong>Mestre Weber – Golaarion</strong> carregado neste mundo:</p>
      <ul>${items.map((line) => `<li>${line}</li>`).join("")}</ul>
    </div>
  `;

  ChatMessage.create({
    content,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    speaker: { alias: "Mestre Weber – Golaarion" }
  });
}
