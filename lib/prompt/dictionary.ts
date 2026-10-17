import type { Dictionary, FlowConfig, Section } from "./engine";
import About from "@/dictonary/About.json";
import Adjectives from "@/dictonary/Adjectives.json";
import Conjunctions from "@/dictonary/Conjunctions.json";
import Do from "@/dictonary/Do.json";
import Finish from "@/dictonary/Finish.json";
import In from "@/dictonary/In.json";
import Like from "@/dictonary/Like.json";
import Start from "@/dictonary/Start.json";
import config from "@/dictonary/prompt.json";
import nouns from "@/dictonary/generators/nouns.json";

// New section files must be imported and added here.
const sections: Record<string, Section> = { About, Adjectives, Conjunctions, Do, Finish, In, Like, Start };

export const dictionary: Dictionary = {
  sections,
  // {@name} tags in templates call these instead of looking up a slot list.
  generators: {
    noun: rng => nouns[Math.floor(rng() * nouns.length)],
  },
  config: config as FlowConfig,
};
