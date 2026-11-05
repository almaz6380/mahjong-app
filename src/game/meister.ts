import { LEVEL_ORDER } from './levelOrder';

// Ab hier beginnen die endlosen Meister-Level (figureForLevel in figures.ts).
// Bewusst aus der Länge der erzeugten Liste statt über meisterAb(): Das
// bräuchte den ganzen Figuren-Generator schon auf der Startseite.
export const MEISTER_AB = LEVEL_ORDER.length + 1;

export const istMeister = (level: number) => level >= MEISTER_AB;
