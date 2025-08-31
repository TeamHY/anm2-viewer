import type { Anm2Renderer } from "../renderer/Anm2Renderer";
import type { Anm2Frame } from "./anm2";

export type AnimationState = {
  anm2Path: string;
  renderer: Anm2Renderer | null;
  availableAnimations: string[];
  currentAnimation: string;
  selectedLayerId: number | null;
  selectedSpritesheetId: number | null;
  selectedFrames: Set<string>;
  currentFrame: number;
  setAnimation: (name: string) => void;
  setSelectedLayer: (layerId: number | null) => void;
  setSelectedFrames: (frames: Set<string>) => void;
  getCurrentFrameData: () => Anm2Frame | null;
  getSelectedLayerName: () => string;
};

export interface LayerState {
  layerId: number;
  layerName: string;
  spritesheetId?: number;
  visible: boolean;
  isNullLayer: boolean;
  originalNullId?: number;
  currentFrame: Anm2Frame | null;
}

export interface SelectedKeyframe {
  layerId: number;
  frame: number;
}
