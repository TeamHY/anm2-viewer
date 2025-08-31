export interface Anm2Info {
  createdBy: string;
  createdOn: string;
  version: string;
  fps: number;
}

export interface Anm2Spritesheet {
  path: string;
  id: number;
}

export interface Anm2Layer {
  name: string;
  id: number;
  spritesheetId: number;
}

export interface Anm2Null {
  name: string;
  id: number;
}

export interface Anm2Frame {
  xPosition: number;
  yPosition: number;
  xPivot?: number;
  yPivot?: number;
  xCrop?: number;
  yCrop?: number;
  width?: number;
  height?: number;
  xScale: number;
  yScale: number;
  delay: number;
  visible: boolean;
  redTint: number;
  greenTint: number;
  blueTint: number;
  alphaTint: number;
  redOffset: number;
  greenOffset: number;
  blueOffset: number;
  rotation: number;
  interpolated: boolean;
}

export interface Anm2LayerAnimation {
  layerId: number;
  visible: boolean;
  frames: Anm2Frame[];
}

export interface Anm2NullAnimation {
  nullId: number;
  visible: boolean;
  frames: Anm2Frame[];
}

export interface Anm2Animation {
  name: string;
  frameNum: number;
  loop: boolean;
  rootAnimation: Anm2Frame;
  layerAnimations: Anm2LayerAnimation[];
  nullAnimations: Anm2NullAnimation[];
}

export interface Anm2Content {
  spritesheets: Anm2Spritesheet[];
  layers: Anm2Layer[];
  nulls: Anm2Null[];
}

export interface Anm2Data {
  info: Anm2Info;
  content: Anm2Content;
  animations: Anm2Animation[];
  defaultAnimation: string;
}
