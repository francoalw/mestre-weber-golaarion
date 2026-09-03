const MODULE_ID = "mestre-weber-golaarion";
const SETTING_ENABLED = "nextTurnNotifyEnabled";
const SETTING_VOLUME = "nextTurnNotifyVolume";

// Só faz sentido avisar quando a ordem de turnos não é óbvia. Com 1v1 (ou só o Mestre
// controlando um único inimigo) o próximo turno alterna sempre entre os dois, então o
// aviso é dispensável.
const MIN_PARTICIPANTS = 2;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLED, {
    name: "Notificação de turno",
    hint: "Em combates com mais de 2 participantes, avisa o jogador (notificação + som discreto) um turno antes de chegar a vez dele, assim que o turno anterior começa.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTING_VOLUME, {
    name: "Volume da notificação de turno",
    hint: "Volume do sonzinho tocado para o jogador quando o turno dele está chegando.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.35
  });
});

// Sintetizado via Web Audio API, com um único tom curto e suave, para soar como um "toc"
// discreto e não um alarme. Toca só no cliente de quem recebe o aviso.
function playTurnChime(volume) {
  try {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextImpl();
    ctx.resume?.();

    const now = ctx.currentTime;
    const duration = 0.35;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);

    setTimeout(() => ctx.close(), (duration + 0.2) * 1000);
  } catch (err) {
    console.warn(`${MODULE_ID} | Não foi possível tocar o som de notificação de turno.`, err);
  }
}

// Dispara em todos os clientes a cada mudança de turno. No momento em que o turno de
// alguém começa, calcula quem vem *depois* dele na ordem de iniciativa e avisa esse
// jogador com antecedência, pra já ir se preparando. Cada cliente decide localmente se o
// dono desse próximo combatente é ele (e não o Mestre), então só o jogador certo vê/ouve.
Hooks.on("combatTurnChange", (combat, fromState, toState) => {
  if (game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, SETTING_ENABLED)) return;
  if (fromState?.combatantId === toState.combatantId) return;

  const turns = combat.turns;
  if (turns.length <= MIN_PARTICIPANTS) return;

  // Assume que a ordem se mantém ao virar de rodada (comportamento padrão do Foundry,
  // sem reroll de iniciativa a cada round) para prever o primeiro combatente do próximo
  // round quando o turno atual é o último da rodada.
  const upNextCombatant = turns[(toState.turn + 1) % turns.length];
  const actor = upNextCombatant?.actor;
  if (!actor?.testUserPermission(game.user, "OWNER")) return;

  ui.notifications.info(game.i18n.format("NEXTTURNNOTIFY.UpNext", { name: actor.name }));
  playTurnChime(game.settings.get(MODULE_ID, SETTING_VOLUME));
});
