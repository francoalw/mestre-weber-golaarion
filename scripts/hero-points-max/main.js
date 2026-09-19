const MODULE_ID = "mestre-weber-golaarion";
const SETTING_MAX_HERO_POINTS = "maxHeroPoints";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_MAX_HERO_POINTS, {
    name: "Pontos Heroicos (máximo)",
    hint: "Máximo de Pontos Heróicos dos personagens (não-Míticos). Padrão do sistema é 3; aqui pode escolher de 1 a 10. Requer recarregar o mundo para valer para fichas já abertas.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 10, step: 1 },
    default: 5,
    requiresReload: true
  });
});

Hooks.once("setup", () => {
  const CharacterPF2e = CONFIG.PF2E?.Actor?.documentClasses?.character;
  if (!CharacterPF2e) {
    console.warn(`${MODULE_ID} | Classe de personagem do PF2e não encontrada; o sistema pode ser incompatível.`);
    return;
  }

  const original = CharacterPF2e.prototype.prepareBaseData;
  CharacterPF2e.prototype.prepareBaseData = function (...args) {
    original.call(this, ...args);
    // Personagens Míticos usam Pontos Míticos em vez de Pontos Heróicos (max fica 0 nesse caso).
    const heroPoints = this.system.resources?.heroPoints;
    if (heroPoints && heroPoints.max > 0) heroPoints.max = game.settings.get(MODULE_ID, SETTING_MAX_HERO_POINTS);
  };

  console.log(`${MODULE_ID} | Máximo de Pontos Heróicos configurável via Configurações do Mundo`);

  // A coleção game.actors já é montada (e cada ator já passa por prepareData) antes do
  // hook "setup" disparar, então os personagens carregam com o max original do sistema.
  // Força um recálculo assim que os atores estiverem disponíveis para refletir o valor
  // configurado já no primeiro acesso, sem precisar interagir com a ficha antes.
  Hooks.once("ready", () => {
    for (const actor of game.actors ?? []) {
      if (actor instanceof CharacterPF2e) actor.reset();
    }
  });
});
