const REGION_BEHAVIOR_TYPE = "modifyMovementCost";
const DIFFICULT_TERRAIN_VALUE = 2;
const REGION_NAME = "Terreno Difícil";
const REGION_COLOR = "#a0522d";

let difficultTerrainModeActive = false;

// Adiciona um novo botão (toggle) na aba Controles de Região. Enquanto ativo, qualquer
// Região nova criada ao desenhar uma forma (retângulo, elipse/emanação, polígono/cone)
// recebe automaticamente o comportamento "Modificar Custo de Movimento" configurado como
// Terreno Difícil, sem precisar configurar isso manualmente depois.
Hooks.on("getSceneControlButtons", (controls) => {
  const regionsControl = controls.regions;
  if (!regionsControl) return;

  regionsControl.tools.mwGolaarionDifficultTerrain = {
    name: "mwGolaarionDifficultTerrain",
    title: "Desenhar Terreno Difícil",
    icon: "fa-solid fa-mountain",
    order: Object.keys(regionsControl.tools).length,
    toggle: true,
    active: difficultTerrainModeActive,
    visible: game.user.isGM,
    onChange: (_event, active) => {
      difficultTerrainModeActive = active;
    }
  };
});

Hooks.on("preCreateRegion", (region) => {
  if (!difficultTerrainModeActive || !game.user.isGM) return;

  region.updateSource({
    name: REGION_NAME,
    color: REGION_COLOR
  });
});

// O behavior não pode ir embutido nos dados de criação da Região (o "system" de um
// RegionBehavior só é resolvido pelo DataModel do seu "type" depois que o documento
// já existe, então behaviors passados junto com a criação da Região são descartados
// na validação). Por isso o comportamento "Modificar Custo de Movimento" é criado à
// parte, como embedded document, assim que a Região termina de ser criada.
Hooks.on("createRegion", async (region, _options, userId) => {
  if (userId !== game.user.id || !game.user.isGM) return;
  if (region.name !== REGION_NAME) return;
  if (region.behaviors.some((behavior) => behavior.type === REGION_BEHAVIOR_TYPE)) return;

  await region.createEmbeddedDocuments("RegionBehavior", [
    {
      name: REGION_NAME,
      type: REGION_BEHAVIOR_TYPE,
      system: { difficulties: { walk: DIFFICULT_TERRAIN_VALUE } }
    }
  ]);
});
