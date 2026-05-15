export type DirectorMode = "auto" | "director";

export type IntakeFormat = "concept" | "script" | "image" | "remix";

export interface IntakeData {
  title: string;
  logline: string;
  format: IntakeFormat;
  scriptOrIdea: string;
  genres: string[];
  tone: string;
  aspect: "16:9" | "2.39:1" | "9:16" | "1:1";
  sceneCount: number;
  castSize: 1 | 2;
  characterA: string;
  characterB: string;
  mode: DirectorMode;
}

export const DEFAULT_INTAKE: IntakeData = {
  title: "",
  logline: "",
  format: "concept",
  scriptOrIdea: "",
  genres: [],
  tone: "Cinematic",
  aspect: "2.39:1",
  sceneCount: 6,
  castSize: 1,
  characterA: "",
  characterB: "",
  mode: "director",
};