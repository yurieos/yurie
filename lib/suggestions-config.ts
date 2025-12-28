import { 
  Atom, 
  Cpu, 
  Flask, 
  MapTrifold, 
  RocketLaunch, 
  Scroll, 
  TrendUp,
} from "@phosphor-icons/react";

export type SuggestionCategory = {
  label: string;
  highlight: string;
  prompt: string;
  items: string[];
  icon: any;
};

export const SUGGESTIONS: SuggestionCategory[] = [
  {
    label: "History",
    highlight: "Uncover",
    prompt: "Uncover",
    items: [
      "Uncover the secret society of the 'Illuminati'",
      "Uncover the fate of 'Amelia Earhart'",
      "Uncover the truth behind the 'Dancing Plague'",
      "Uncover the mystery of the 'Mary Celeste' ship",
      "Uncover the legend of the 'Library of Alexandria'",
    ],
    icon: Scroll,
  },
  {
    label: "Discovery",
    highlight: "Investigate",
    prompt: "Investigate",
    items: [
      "Investigate the accidental discovery of 'Penicillin'",
      "Investigate how 'Champagne' was invented by mistake",
      "Investigate the finding of the 'Rosetta Stone'",
      "Investigate the first observation of 'Bacteria'",
      "Investigate the excavation of 'Pompeii'",
    ],
    icon: Flask,
  },
  {
    label: "Treasure Hunting",
    highlight: "Locate",
    prompt: "Locate",
    items: [
      "Locate the legendary 'El Dorado'",
      "Locate the 'Oak Island Money Pit' treasure",
      "Locate the shipwreck of the 'Titanic'",
      "Locate the lost 'City of Atlantis'",
      "Locate the 'Holy Grail' historical traces",
    ],
    icon: MapTrifold,
  },
  {
    label: "Science",
    highlight: "Analyze",
    prompt: "Analyze",
    items: [
      "Analyze the physics of 'Time Travel' paradoxes",
      "Analyze the intelligence of 'Octopuses'",
      "Analyze the 'Schrödinger's Cat' thought experiment",
      "Analyze the properties of 'Antimatter'",
      "Analyze the 'Butterfly Effect' in chaos theory",
    ],
    icon: Atom,
  },
  {
    label: "Explore",
    highlight: "Explore",
    prompt: "Explore",
    items: [
      "Explore the concept of the 'Multiverse'",
      "Explore the possibility of 'Life on Europa'",
      "Explore the deepest part of the 'Mariana Trench'",
      "Explore the 'Dark Side of the Moon'",
      "Explore the mysterious 'Area 51' history",
    ],
    icon: RocketLaunch,
  },
  {
    label: "Finance",
    highlight: "Evaluate",
    prompt: "Evaluate",
    items: [
      "Evaluate the economics of 'Space Tourism'",
      "Evaluate the 'Tulip Mania' market crash",
      "Evaluate the value of 'NFTs' in art",
      "Evaluate the cost of building the 'Death Star'",
      "Evaluate the rise of 'Bitcoin' billionaires",
    ],
    icon: TrendUp,
  },
  {
    label: "Technology",
    highlight: "Examine",
    prompt: "Examine",
    items: [
      "Examine the realism of 'Deepfakes'",
      "Examine the future of 'Brain-Computer Interfaces'",
      "Examine the capabilities of 'Boston Dynamics' robots",
      "Examine the ethics of 'AI' in warfare",
      "Examine the tech behind 'Invisibility Cloaks'",
    ],
    icon: Cpu,
  },
];
