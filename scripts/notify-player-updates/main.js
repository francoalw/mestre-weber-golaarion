const MODULE_ID = "mestre-weber-golaarion";
const SPELL_SLOT_RANKS = Array.from({ length: 10 }, (_, i) => i + 1); // slot1..slot10; slot0 (truques) é ignorado
const TRACKED_CREATE_DELETE_TYPES = new Set(["feat", "condition"]);

let weberSocket;

// Cada arquivo do módulo registra seus próprios handlers no mesmo socket compartilhado.
Hooks.once("socketlib.ready", () => {
  weberSocket = socketlib.registerModule(MODULE_ID);
  weberSocket.register("mwWhisperToGM", receiveWhisperRequest);
});

// Roda só no cliente do Mestre (via socketlib.executeAsGM), pra garantir que a mensagem
// tenha o Mestre como autor e fique invisível para o jogador que disparou a mudança —
// se o próprio cliente do jogador criasse a ChatMessage, ele apareceria como autor e
// enxergaria o próprio "sussurro".
function receiveWhisperRequest({ actorId, lines }) {
  if (!lines || lines.length === 0) return;

  const whisper = game.users.filter((u) => u.isGM).map((u) => u.id);
  if (whisper.length === 0) return;

  const actor = game.actors.get(actorId);
  ChatMessage.create({
    content: lines.join("<br>"),
    whisper,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined
  });
}

function requestWhisper(actor, lines) {
  const filtered = (lines ?? []).filter(Boolean);
  if (filtered.length === 0) return;
  if (!weberSocket) return;

  // Falha (ex.: nenhum Mestre conectado no momento) não deve gerar erro visível pro
  // jogador — a atualização da ficha já aconteceu normalmente de qualquer forma.
  weberSocket.executeAsGM("mwWhisperToGM", { actorId: actor.id, lines: filtered })
    .catch((err) => console.warn(`${MODULE_ID} | Não foi possível avisar o Mestre sobre a mudança de ficha.`, err));
}

function changingUserIsPlayer(userId) {
  const user = game.users.get(userId);
  return !!user && !user.isGM;
}

// --- Vida, pontos de heroísmo e pontos de foco -----------------------------

function describeHp(actor, changes) {
  const newValue = foundry.utils.getProperty(changes, "system.attributes.hp.value");
  if (newValue === undefined) return null;

  const oldValue = actor.system.attributes.hp.value;
  const diff = newValue - oldValue;
  if (diff === 0) return null;

  const max = foundry.utils.getProperty(changes, "system.attributes.hp.max") ?? actor.system.attributes.hp.max;
  const key = diff > 0 ? "NOTIFYUPDATES.HpRecovered" : "NOTIFYUPDATES.HpLost";
  return game.i18n.format(key, { name: actor.name, amount: Math.abs(diff), value: newValue, max });
}

function describeHeroPoints(actor, changes) {
  const newValue = foundry.utils.getProperty(changes, "system.resources.heroPoints.value");
  if (newValue === undefined) return null;

  const oldValue = actor.system.resources.heroPoints.value;
  const diff = newValue - oldValue;
  if (diff === 0) return null;

  const key = diff > 0 ? "NOTIFYUPDATES.HeroPointsGained" : "NOTIFYUPDATES.HeroPointsSpent";
  return game.i18n.format(key, { name: actor.name, amount: Math.abs(diff), value: newValue });
}

function describeFocus(actor, changes) {
  const newValue = foundry.utils.getProperty(changes, "system.resources.focus.value");
  if (newValue === undefined) return null;

  const oldValue = actor.system.resources.focus?.value ?? 0;
  const diff = newValue - oldValue;
  if (diff === 0) return null;

  const max = foundry.utils.getProperty(changes, "system.resources.focus.max") ?? actor.system.resources.focus?.max ?? 0;
  const key = diff > 0 ? "NOTIFYUPDATES.FocusGained" : "NOTIFYUPDATES.FocusSpent";
  return game.i18n.format(key, { name: actor.name, amount: Math.abs(diff), value: newValue, max });
}

Hooks.on("preUpdateActor", (actor, changes, _options, userId) => {
  if (actor.type !== "character") return;
  if (!changingUserIsPlayer(userId)) return;

  const lines = [describeHp(actor, changes), describeHeroPoints(actor, changes), describeFocus(actor, changes)];
  requestWhisper(actor, lines);
});

// --- Slots de magia e condições com valor (ex: enfraquecido 2) ------------

function describeSpellSlots(item, changes) {
  const slotChanges = foundry.utils.getProperty(changes, "system.slots");
  if (!slotChanges) return [];

  const recovered = [];
  const spent = [];
  for (const rank of SPELL_SLOT_RANKS) {
    const newValue = slotChanges[`slot${rank}`]?.value;
    if (newValue === undefined) continue;

    const oldValue = item.system.slots[`slot${rank}`]?.value ?? 0;
    const diff = newValue - oldValue;
    if (diff === 0) continue;
    (diff > 0 ? recovered : spent).push({ rank, amount: Math.abs(diff) });
  }

  const describeGroup = (group, key) => {
    if (group.length === 0) return null;
    const details = group
      .map(({ rank, amount }) => game.i18n.format(
        amount === 1 ? "NOTIFYUPDATES.SpellSlotRankSingular" : "NOTIFYUPDATES.SpellSlotRankPlural",
        { amount, rank }
      ))
      .join(", ");
    return game.i18n.format(key, { name: item.actor.name, details, item: item.name });
  };

  return [
    describeGroup(recovered, "NOTIFYUPDATES.SpellSlotsRecovered"),
    describeGroup(spent, "NOTIFYUPDATES.SpellSlotsSpent")
  ];
}

function describeConditionValue(item, changes) {
  const newValue = foundry.utils.getProperty(changes, "system.value.value");
  if (newValue === undefined) return null;

  const oldValue = item.system.value?.value;
  if (newValue === oldValue) return null;

  return game.i18n.format("NOTIFYUPDATES.ConditionValueChanged", {
    name: item.actor.name,
    condition: item.name,
    value: newValue
  });
}

Hooks.on("preUpdateItem", (item, changes, _options, userId) => {
  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!changingUserIsPlayer(userId)) return;

  if (item.type === "spellcastingEntry") {
    requestWhisper(actor, describeSpellSlots(item, changes));
  } else if (item.type === "condition") {
    requestWhisper(actor, [describeConditionValue(item, changes)]);
  }
});

// --- Talentos e condições ganhas/perdidas ----------------------------------

function describeItemGained(item) {
  if (item.type === "feat") {
    return game.i18n.format("NOTIFYUPDATES.FeatGained", { name: item.actor.name, feat: item.name });
  }

  const value = item.system.value?.isValued ? item.system.value.value : null;
  return value === null
    ? game.i18n.format("NOTIFYUPDATES.ConditionGained", { name: item.actor.name, condition: item.name })
    : game.i18n.format("NOTIFYUPDATES.ConditionGainedValued", { name: item.actor.name, condition: item.name, value });
}

function describeItemLost(item) {
  if (item.type === "feat") {
    return game.i18n.format("NOTIFYUPDATES.FeatLost", { name: item.actor.name, feat: item.name });
  }
  return game.i18n.format("NOTIFYUPDATES.ConditionLost", { name: item.actor.name, condition: item.name });
}

Hooks.on("preCreateItem", (item, _data, _options, userId) => {
  if (!TRACKED_CREATE_DELETE_TYPES.has(item.type)) return;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!changingUserIsPlayer(userId)) return;

  requestWhisper(actor, [describeItemGained(item)]);
});

Hooks.on("preDeleteItem", (item, _options, userId) => {
  if (!TRACKED_CREATE_DELETE_TYPES.has(item.type)) return;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!changingUserIsPlayer(userId)) return;

  requestWhisper(actor, [describeItemLost(item)]);
});
