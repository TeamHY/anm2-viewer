import type { Texture } from "pixi.js";

export interface SpritesheetData {
  path: string;
  dataURL: string;
  texture: Texture;
}

export type SpritesheetDataMap = Map<number, SpritesheetData>;