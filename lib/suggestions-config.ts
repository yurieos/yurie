import { 
  Atom, 
  Cpu, 
  Flask, 
  MapTrifold, 
  RocketLaunch, 
  Scroll, 
  TrendUp,
  Skull,
  Butterfly,
  Planet,
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
      "Uncover why Australia declared war on 'Emus' and lost in 1932",
      "Uncover the 'Cadaver Synod' where a dead Pope was put on trial",
      "Uncover the 'War of the Bucket' that killed 2,000 people over a wooden pail",
      "Uncover the 'Great Molasses Flood' that drowned Boston in 1919",
      "Uncover the 'Year Without a Summer' when volcanic ash changed history",
    ],
    icon: Scroll,
  },
  {
    label: "Discovery",
    highlight: "Investigate",
    prompt: "Investigate",
    items: [
      "Investigate the 'Antikythera Mechanism', an ancient analog computer from 100 BC",
      "Investigate how a melted chocolate bar invented the 'Microwave Oven'",
      "Investigate the 'Voynich Manuscript' written in an undeciphered language",
      "Investigate how 'Cosmic Microwave Background' was first mistaken for pigeon droppings",
      "Investigate the 'Wow! Signal' received from deep space in 1977",
    ],
    icon: Flask,
  },
  {
    label: "Treasure",
    highlight: "Locate",
    prompt: "Locate",
    items: [
      "Locate the stolen 'Amber Room' panels worth $500 million",
      "Locate 'Yamashita's Gold' hidden by Japan in WWII Philippines",
      "Locate the lost 137-carat 'Florentine Diamond' from the Medici family",
      "Locate the $17 billion 'Flor de la Mar' shipwreck in the Malacca Strait",
      "Locate the 'Treasure of Lima' worth $200 million hidden by pirates",
    ],
    icon: MapTrifold,
  },
  {
    label: "Science",
    highlight: "Analyze",
    prompt: "Analyze",
    items: [
      "Analyze the 'Mpemba Effect' where hot water freezes faster than cold",
      "Analyze how 'Tardigrades' survive the vacuum of space and radiation",
      "Analyze the 'Delayed Choice Quantum Eraser' time paradox experiment",
      "Analyze 'Ball Lightning' phenomena that physics still can't explain",
      "Analyze the 'Placebo Effect' on surgeries that were never performed",
    ],
    icon: Atom,
  },
  {
    label: "Explore",
    highlight: "Explore",
    prompt: "Explore",
    items: [
      "Explore 'Movile Cave' in Romania where life evolved in darkness for 5.5 million years",
      "Explore 'Son Doong Cave' in Vietnam with its own weather system and jungle",
      "Explore 'Lake Vostok' sealed under Antarctic ice for 15 million years",
      "Explore 'Zealandia', the submerged eighth continent beneath New Zealand",
      "Explore the 'Door to Hell' in Turkmenistan burning since 1971",
    ],
    icon: RocketLaunch,
  },
  {
    label: "Finance",
    highlight: "Evaluate",
    prompt: "Evaluate",
    items: [
      "Evaluate 'Operation Bernhard' - the Nazi plot to destroy Britain with counterfeits",
      "Evaluate the 'Railway Mania of 1845' that bankrupted a third of Britain",
      "Evaluate the 'Radium Girls' lawsuit that created worker safety laws",
      "Evaluate the 'Mississippi Bubble' that crashed France's entire economy",
      "Evaluate how 'Kipper und Wipper' currency debasement collapsed Central Europe's economy in 1622",
    ],
    icon: TrendUp,
  },
  {
    label: "Technology",
    highlight: "Examine",
    prompt: "Examine",
    items: [
      "Examine 'Xenobots', the first living robots made from frog stem cells",
      "Examine 'Neuromorphic Chips' that process information like human brains",
      "Examine 'CRISPR Gene Drives' that can modify entire wild species",
      "Examine 'Optogenetics' controlling neurons with beams of light",
      "Examine the 'Stuxnet Worm' - the first digital weapon used in warfare",
    ],
    icon: Cpu,
  },
  {
    label: "Space",
    highlight: "Decode",
    prompt: "Decode",
    items: [
      "Decode the 'Great Attractor' pulling our galaxy toward an unknown mass",
      "Decode 'Oumuamua' - the first interstellar object to visit our solar system",
      "Decode the 'Fermi Paradox' and why we haven't found alien life yet",
      "Decode 'Tabby's Star' with its unexplained 22% brightness dips",
      "Decode 'Fast Radio Bursts' flashing from billions of light years away",
    ],
    icon: Planet,
  },
  {
    label: "Nature",
    highlight: "Discover",
    prompt: "Discover",
    items: [
      "Discover the 'Immortal Jellyfish' that can reverse its own aging",
      "Discover 'Slime Molds' that can solve mazes without a brain",
      "Discover the 'Pistol Shrimp' that creates plasma hotter than the sun",
      "Discover 'Zombie Ants' controlled by parasitic fungi",
      "Discover the 'Axolotl' that can regenerate its brain and heart",
    ],
    icon: Butterfly,
  },
  {
    label: "Mysteries",
    highlight: "Solve",
    prompt: "Solve",
    items: [
      "Solve the 'Dyatlov Pass Incident' where 9 hikers died under bizarre circumstances",
      "Solve the 'Lead Masks of Vintem Hill' case from Brazil in 1966",
      "Solve the 'Tamam Shud Case' and the unidentified Somerton Man",
      "Solve the 'Hinterkaifeck Murders' where victims were killed days before discovery",
      "Solve the 'Zodiac Killer's 340 Cipher' that took 51 years to crack",
    ],
    icon: Skull,
  },
];
