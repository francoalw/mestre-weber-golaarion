/**
 * Maps each action slug added by the "PF2e Skill Actions" module to the
 * skill that actually governs it in the Core Rulebook. The source module
 * lumps many of these into a single "untrained" bucket (since they don't
 * require training to attempt), which is a different concept from "has no
 * governing skill" — this map restores the real skill for grouping.
 */
export const SKILL_ACTION_MAP = {
  // Acrobatics
  balance: "acrobatics",
  "tumble-through": "acrobatics",
  "maneuver-in-flight": "acrobatics",
  squeeze: "acrobatics",

  // Arcana
  "borrow-an-arcane-spell": "arcana",

  // Athletics
  climb: "athletics",
  "force-open": "athletics",
  grapple: "athletics",
  "high-jump": "athletics",
  "long-jump": "athletics",
  reposition: "athletics",
  shove: "athletics",
  swim: "athletics",
  trip: "athletics",
  disarm: "athletics",

  // Crafting
  craft: "crafting",
  "identify-alchemy": "crafting",
  repair: "crafting",

  // Deception
  feint: "deception",
  "create-a-diversion": "deception",
  impersonate: "deception",

  // Diplomacy
  "gather-information": "diplomacy",
  "make-an-impression": "diplomacy",
  request: "diplomacy",

  // Intimidation
  coerce: "intimidation",
  demoralize: "intimidation",

  // Medicine
  "administer-first-aid": "medicine",
  "treat-disease": "medicine",
  "treat-poison": "medicine",
  "treat-wounds": "medicine",

  // Nature
  "command-an-animal": "nature",

  // Performance
  perform: "performance",

  // Society
  "create-forgery": "society",

  // Stealth
  "avoid-notice": "stealth",
  "conceal-an-object": "stealth",
  hide: "stealth",
  sneak: "stealth",

  // Survival
  "cover-tracks": "survival",
  track: "survival",
  "sense-direction": "survival",
  subsist: "survival",

  // Thievery
  "disable-a-device": "thievery",
  "pick-a-lock": "thievery",
  "palm-an-object": "thievery",
  steal: "thievery",

  // Perception (exploration activities; not part of actor.system.skills)
  investigate: "perception",
  scout: "perception",
  search: "perception",

  // No single governing skill, or usable with several skills depending on
  // the character/situation (e.g. Recall Knowledge, Decipher Writing).
  "long-term-rest": "general",
  retraining: "general",
  "follow-the-expert": "general",
  hustle: "general",
  defend: "general",
  "detect-magic": "general",
  "repeat-a-spell": "general",
  "recall-knowledge": "general",
  "earn-income": "general",
  "decipher-writing": "general",
  "identify-magic": "general",
  "learn-a-spell": "general",
  "tap-ley-line": "general"
};

export const SKILL_ORDER = [
  "acrobatics",
  "arcana",
  "athletics",
  "crafting",
  "deception",
  "diplomacy",
  "intimidation",
  "medicine",
  "nature",
  "occultism",
  "performance",
  "religion",
  "society",
  "stealth",
  "survival",
  "thievery",
  "perception",
  "general"
];

export const SKILL_ICONS = {
  acrobatics: "fa-person-running",
  arcana: "fa-hat-wizard",
  athletics: "fa-dumbbell",
  crafting: "fa-hammer",
  deception: "fa-theater-masks",
  diplomacy: "fa-handshake",
  intimidation: "fa-face-angry",
  medicine: "fa-briefcase-medical",
  nature: "fa-leaf",
  occultism: "fa-eye",
  performance: "fa-music",
  religion: "fa-place-of-worship",
  society: "fa-landmark",
  stealth: "fa-user-ninja",
  survival: "fa-campground",
  thievery: "fa-user-secret",
  perception: "fa-eye",
  general: "fa-star"
};
