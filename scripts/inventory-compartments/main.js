import { MODULE_ID } from "./compartments.js";
import { onRenderInventory } from "./render.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing inventory-compartments`);
});

for (const sheetHook of ["renderCharacterSheetPF2e", "renderNPCSheetPF2e", "renderLootSheetPF2e"]) {
  Hooks.on(sheetHook, onRenderInventory);
}
