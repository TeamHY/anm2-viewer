import * as xml2js from 'xml2js';
import type {
  Anm2Data,
  Anm2Info,
  Anm2Content,
  Anm2Spritesheet,
  Anm2Layer,
  Anm2Null,
  Anm2Animation,
  Anm2Frame,
  Anm2LayerAnimation,
  Anm2NullAnimation
} from '../types/anm2';

export class Anm2Parser {
  static async parseFromString(xmlString: string): Promise<Anm2Data> {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true
      });

      const result = await parser.parseStringPromise(xmlString);
      
      if (!result.AnimatedActor) {
        throw new Error("Invalid anm2 file: Missing AnimatedActor element");
      }

      const animatedActor = result.AnimatedActor;

      return {
        info: this.parseInfo(animatedActor),
        content: this.parseContent(animatedActor),
        animations: this.parseAnimations(animatedActor),
        defaultAnimation: this.parseDefaultAnimation(animatedActor)
      };
    } catch (error) {
      throw new Error(`XML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async parseFromFile(file: File): Promise<Anm2Data> {
    const text = await file.text();
    return this.parseFromString(text);
  }

  static async parseFromUrl(url: string): Promise<Anm2Data> {
    const response = await fetch(url);
    const text = await response.text();
    return this.parseFromString(text);
  }

  private static parseInfo(root: any): Anm2Info {
    const info = root.Info;
    if (!info) {
      throw new Error("Info section not found");
    }

    return {
      createdBy: info.CreatedBy || "",
      createdOn: info.CreatedOn || "",
      version: info.Version || "",
      fps: parseInt(info.Fps || "30", 10)
    };
  }

  private static parseContent(root: any): Anm2Content {
    const content = root.Content;
    if (!content) {
      throw new Error("Content section not found");
    }

    return {
      spritesheets: this.parseSpritesheets(content),
      layers: this.parseLayers(content),
      nulls: this.parseNulls(content)
    };
  }

  private static parseSpritesheets(content: any): Anm2Spritesheet[] {
    const spritesheets = content.Spritesheets;
    if (!spritesheets) return [];

    const sheets = spritesheets.Spritesheet;
    if (!sheets) return [];

    const sheetArray = Array.isArray(sheets) ? sheets : [sheets];

    return sheetArray.map((sheet: any) => ({
      path: sheet.Path || "",
      id: parseInt(sheet.Id || "0", 10)
    }));
  }

  private static parseLayers(content: any): Anm2Layer[] {
    const layers = content.Layers;
    if (!layers) return [];

    const layerItems = layers.Layer;
    if (!layerItems) return [];

    const layerArray = Array.isArray(layerItems) ? layerItems : [layerItems];

    return layerArray.map((layer: any) => ({
      name: layer.Name || "",
      id: parseInt(layer.Id || "0", 10),
      spritesheetId: parseInt(layer.SpritesheetId || "0", 10)
    }));
  }

  private static parseNulls(content: any): Anm2Null[] {
    const nulls = content.Nulls;
    if (!nulls) return [];

    const nullItems = nulls.Null;
    if (!nullItems) return [];

    const nullArray = Array.isArray(nullItems) ? nullItems : [nullItems];

    return nullArray.map((nullElement: any) => ({
      name: nullElement.Name || "",
      id: parseInt(nullElement.Id || "0", 10)
    }));
  }

  private static parseDefaultAnimation(root: any): string {
    const animations = root.Animations;
    return animations?.DefaultAnimation || "";
  }

  private static parseAnimations(root: any): Anm2Animation[] {
    const animations = root.Animations;
    if (!animations) return [];

    const animItems = animations.Animation;
    if (!animItems) return [];

    const animArray = Array.isArray(animItems) ? animItems : [animItems];

    return animArray.map((anim: any) => ({
      name: anim.Name || "",
      frameNum: parseInt(anim.FrameNum || "1", 10),
      loop: anim.Loop === "true" || anim.Loop === true,
      rootAnimation: this.parseRootAnimation(anim),
      layerAnimations: this.parseLayerAnimations(anim),
      nullAnimations: this.parseNullAnimations(anim)
    }));
  }

  private static parseRootAnimation(animation: any): Anm2Frame {
    const rootAnim = animation.RootAnimation;
    if (!rootAnim || !rootAnim.Frame) {
      throw new Error("RootAnimation Frame not found");
    }
    return this.parseFrame(rootAnim.Frame);
  }

  private static parseLayerAnimations(animation: any): Anm2LayerAnimation[] {
    const layerAnimations = animation.LayerAnimations;
    if (!layerAnimations) return [];

    const layerAnimItems = layerAnimations.LayerAnimation;
    if (!layerAnimItems) return [];

    const layerAnimArray = Array.isArray(layerAnimItems) ? layerAnimItems : [layerAnimItems];

    return layerAnimArray.map((layerAnim: any) => ({
      layerId: parseInt(layerAnim.LayerId || "0", 10),
      visible: layerAnim.Visible === "true" || layerAnim.Visible === true,
      frames: this.parseFrames(layerAnim.Frame)
    }));
  }

  private static parseNullAnimations(animation: any): Anm2NullAnimation[] {
    const nullAnimations = animation.NullAnimations;
    if (!nullAnimations) return [];

    const nullAnimItems = nullAnimations.NullAnimation;
    if (!nullAnimItems) return [];

    const nullAnimArray = Array.isArray(nullAnimItems) ? nullAnimItems : [nullAnimItems];

    return nullAnimArray.map((nullAnim: any) => ({
      nullId: parseInt(nullAnim.NullId || "0", 10),
      visible: nullAnim.Visible === "true" || nullAnim.Visible === true,
      frames: this.parseFrames(nullAnim.Frame)
    }));
  }

  private static parseFrames(frameData: any): Anm2Frame[] {
    if (!frameData) return [];

    const frameArray = Array.isArray(frameData) ? frameData : [frameData];
    return frameArray.map((frame: any) => this.parseFrame(frame));
  }

  private static parseFrame(frameElement: any): Anm2Frame {
    const getValue = (name: string, defaultValue: any = 0): any =>
      frameElement[name] !== undefined ? frameElement[name] : defaultValue;

    return {
      xPosition: parseFloat(getValue("XPosition", 0)),
      yPosition: parseFloat(getValue("YPosition", 0)),
      xPivot: frameElement.XPivot !== undefined ? parseFloat(frameElement.XPivot) : undefined,
      yPivot: frameElement.YPivot !== undefined ? parseFloat(frameElement.YPivot) : undefined,
      xCrop: frameElement.XCrop !== undefined ? parseFloat(frameElement.XCrop) : undefined,
      yCrop: frameElement.YCrop !== undefined ? parseFloat(frameElement.YCrop) : undefined,
      width: frameElement.Width !== undefined ? parseFloat(frameElement.Width) : undefined,
      height: frameElement.Height !== undefined ? parseFloat(frameElement.Height) : undefined,
      xScale: parseFloat(getValue("XScale", 100)),
      yScale: parseFloat(getValue("YScale", 100)),
      delay: parseInt(getValue("Delay", 1), 10),
      visible: getValue("Visible", true) === "true" || getValue("Visible", true) === true,
      redTint: parseInt(getValue("RedTint", 255), 10),
      greenTint: parseInt(getValue("GreenTint", 255), 10),
      blueTint: parseInt(getValue("BlueTint", 255), 10),
      alphaTint: parseInt(getValue("AlphaTint", 255), 10),
      redOffset: parseInt(getValue("RedOffset", 0), 10),
      greenOffset: parseInt(getValue("GreenOffset", 0), 10),
      blueOffset: parseInt(getValue("BlueOffset", 0), 10),
      rotation: parseFloat(getValue("Rotation", 0)),
      interpolated: getValue("Interpolated", false) === "true" || getValue("Interpolated", false) === true
    };
  }
}
