(function() {
  'use strict';

  class Anm2PreviewRenderer {
    constructor(canvasId, anm2Data) {
      this.canvas = document.getElementById(canvasId);
      this.anm2Data = anm2Data;
      this.app = null;
      this.container = null;
      this.layerContainers = new Map();
      this.layerSprites = new Map();
      this.nullContainers = new Map();
      this.nullGraphics = new Map();
      this.spritesheets = new Map();
      
      this.currentAnimation = anm2Data.defaultAnimation;
      this.currentFrame = 0;
      this.isPlaying = false;
      this.animationSpeed = 1;
      this.frameTimer = 0;
      this.lastTime = 0;
      
      this.initializePixi();
    }

    async initializePixi() {
      try {
        // 컨테이너 크기에 맞게 캔버스 크기 설정
        const canvasContainer = this.canvas.parentElement;
        const containerWidth = canvasContainer ? canvasContainer.clientWidth : 800;
        const containerHeight = canvasContainer ? canvasContainer.clientHeight : 600;

        this.app = new PIXI.Application();
        await this.app.init({
          canvas: this.canvas,
          width: Math.max(containerWidth, 400),
          height: Math.max(containerHeight, 300),
          backgroundColor: 0x000000,  // 투명 배경을 위해 검은색으로 설정
          backgroundAlpha: 0,         // 배경을 완전히 투명하게
          antialias: true
        });

        this.container = new PIXI.Container();
        this.container.position.set(this.app.renderer.width / 2, this.app.renderer.height / 2);
        this.app.stage.addChild(this.container);

        await this.loadSpritesheets();
        this.initializeLayers();
        this.initializeNulls();
        this.updateFrame();
        
        this.app.ticker.add(() => this.update());
        
        console.log('PIXI application initialized successfully');
      } catch (error) {
        console.error('Failed to initialize PIXI:', error);
        this.showError('PIXI 초기화 실패: ' + error.message);
      }
    }

    async loadSpritesheets() {
      // 익스텐션에서 전달받은 스프라이트시트 데이터 사용
      const spritesheetDataArray = window.spritesheetData || [];
      const spritesheetMap = new Map(spritesheetDataArray);

      for (const spritesheet of this.anm2Data.content.spritesheets) {
        try {
          const dataUrl = spritesheetMap.get(spritesheet.id);
          
          if (dataUrl) {
            // base64 데이터에서 텍스처 생성
            const texture = await PIXI.Assets.load(dataUrl);
            texture.source.scaleMode = 'nearest';
            
            this.spritesheets.set(spritesheet.id, {
              texture: texture,
              path: spritesheet.path
            });
            
            console.log(`Loaded spritesheet: ${spritesheet.path}`);
          } else {
            // 데이터가 없으면 대체 텍스처 생성
            console.warn(`No data for spritesheet: ${spritesheet.path}`);
            const missingTexture = this.createMissingTexture();
            this.spritesheets.set(spritesheet.id, {
              texture: missingTexture,
              path: spritesheet.path
            });
          }
        } catch (error) {
          console.error(`Failed to load spritesheet ${spritesheet.path}:`, error);
          // 오류 시 대체 텍스처 사용
          const missingTexture = this.createMissingTexture();
          this.spritesheets.set(spritesheet.id, {
            texture: missingTexture,
            path: spritesheet.path
          });
        }
      }
    }

    createMissingTexture(width = 256, height = 256) {
      // 누락된 텍스처를 위한 체크무늬 패턴 생성
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const tileSize = 16;
        for (let y = 0; y < height; y += tileSize) {
          for (let x = 0; x < width; x += tileSize) {
            const isEven = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
            ctx.fillStyle = isEven ? '#ff69b4' : '#ff1493';
            ctx.fillRect(x, y, tileSize, tileSize);
          }
        }
        
        // 중앙에 "?" 표시
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', width / 2, height / 2);
      }
      
      const texture = PIXI.Texture.from(canvas);
      texture.source.scaleMode = 'nearest';
      return texture;
    }

    initializeLayers() {
      const sortedLayers = [...this.anm2Data.content.layers].sort((a, b) => a.id - b.id);

      for (const layer of sortedLayers) {
        const layerContainer = new PIXI.Container();
        layerContainer.name = layer.name;
        this.layerContainers.set(layer.id, layerContainer);
        this.container.addChild(layerContainer);

        const sprite = new PIXI.Sprite();
        sprite.name = `layer_${layer.id}`;
        this.layerSprites.set(layer.id, sprite);
        layerContainer.addChild(sprite);
      }
    }

    initializeNulls() {
      for (const nullItem of this.anm2Data.content.nulls) {
        const nullContainer = new PIXI.Container();
        nullContainer.name = nullItem.name;
        this.nullContainers.set(nullItem.id, nullContainer);
        this.container.addChild(nullContainer);

        const crosshairGraphics = new PIXI.Graphics();
        crosshairGraphics.name = `null_${nullItem.id}`;
        this.nullGraphics.set(nullItem.id, crosshairGraphics);
        nullContainer.addChild(crosshairGraphics);
      }
    }

    drawCrosshair(graphics, frame) {
      graphics.clear();

      if (!frame.visible) return;

      const crosshairSize = 15;
      const lineWidth = 2;

      graphics
        .moveTo(-crosshairSize, 0)
        .lineTo(crosshairSize, 0)
        .moveTo(0, -crosshairSize)
        .lineTo(0, crosshairSize)
        .stroke({ width: lineWidth, color: 0xff0000 });
    }

    play(animationName) {
      if (animationName && animationName !== this.currentAnimation) {
        this.setAnimation(animationName);
      }
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.updateControls();
    }

    pause() {
      this.isPlaying = false;
      this.updateControls();
    }

    stop() {
      this.isPlaying = false;
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.updateFrame();
      this.updateControls();
    }

    setAnimation(animationName) {
      const animation = this.anm2Data.animations.find(anim => anim.name === animationName);
      if (!animation) {
        console.warn(`Animation not found: ${animationName}`);
        return;
      }

      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.frameTimer = 0;

      if (animation.frameNum === 1 && !animation.loop) {
        this.isPlaying = false;
      }

      this.updateFrame();
      this.updateControls();
    }

    setSpeed(speed) {
      this.animationSpeed = speed;
      this.updateControls();
    }

    setCurrentFrame(frame) {
      const animation = this.getCurrentAnimation();
      if (!animation) return;

      this.currentFrame = Math.max(0, Math.min(frame, animation.frameNum - 1));
      this.frameTimer = 0;
      this.updateFrame();
      this.updateControls();
    }

    getCurrentAnimation() {
      return this.anm2Data.animations.find(anim => anim.name === this.currentAnimation);
    }

    update() {
      if (!this.isPlaying) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      const animation = this.getCurrentAnimation();
      if (!animation) return;

      const targetFrameTime = 1 / this.anm2Data.info.fps;
      this.frameTimer += deltaTime * this.animationSpeed;

      if (this.frameTimer >= targetFrameTime) {
        this.nextFrame();
        this.frameTimer = 0;
      }
    }

    nextFrame() {
      const animation = this.getCurrentAnimation();
      if (!animation) return;

      this.currentFrame++;

      if (this.currentFrame >= animation.frameNum) {
        if (animation.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = animation.frameNum - 1;
          this.isPlaying = false;
          if (animation.frameNum === 1) {
            this.currentFrame = 0;
          }
        }
      }

      this.updateFrame();
      this.updateControls();
    }

    updateFrame() {
      const animation = this.getCurrentAnimation();
      if (!animation) return;

      for (const layerAnim of animation.layerAnimations) {
        this.updateLayerFrame(layerAnim);
      }

      for (const nullAnim of animation.nullAnimations) {
        this.updateNullFrame(nullAnim);
      }
    }


    lerp(a, b, t) {
      return a + (b - a) * t;
    }

    lerpColor(color1, color2, t) {
      return Math.round(this.lerp(color1, color2, t));
    }

    interpolateFrame(currentFrame, nextFrame, t) {
      return {
        xPosition: this.lerp(currentFrame.xPosition, nextFrame.xPosition, t),
        yPosition: this.lerp(currentFrame.yPosition, nextFrame.yPosition, t),
        xPivot: currentFrame.xPivot,
        yPivot: currentFrame.yPivot,
        xCrop: currentFrame.xCrop,
        yCrop: currentFrame.yCrop,
        width: currentFrame.width,
        height: currentFrame.height,
        xScale: this.lerp(currentFrame.xScale, nextFrame.xScale, t),
        yScale: this.lerp(currentFrame.yScale, nextFrame.yScale, t),
        delay: currentFrame.delay,
        visible: currentFrame.visible,
        redTint: this.lerpColor(currentFrame.redTint, nextFrame.redTint, t),
        greenTint: this.lerpColor(currentFrame.greenTint, nextFrame.greenTint, t),
        blueTint: this.lerpColor(currentFrame.blueTint, nextFrame.blueTint, t),
        alphaTint: this.lerpColor(currentFrame.alphaTint, nextFrame.alphaTint, t),
        redOffset: this.lerpColor(currentFrame.redOffset, nextFrame.redOffset, t),
        greenOffset: this.lerpColor(currentFrame.greenOffset, nextFrame.greenOffset, t),
        blueOffset: this.lerpColor(currentFrame.blueOffset, nextFrame.blueOffset, t),
        rotation: this.lerp(currentFrame.rotation, nextFrame.rotation, t),
        interpolated: currentFrame.interpolated
      };
    }

    findCurrentAndNextFrame(frames) {
      if (frames.length === 0) return null;

      if (frames.length === 1) {
        return {
          currentFrame: frames[0],
          nextFrame: null,
          frameProgress: 0,
          frameIndex: 0
        };
      }

      let totalDelay = 0;

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const frameEnd = totalDelay + frame.delay;

        if (this.currentFrame < frameEnd) {
          const frameProgress = (this.currentFrame - totalDelay) / frame.delay;
          const nextFrame = i + 1 < frames.length ? frames[i + 1] : null;

          return {
            currentFrame: frame,
            nextFrame,
            frameProgress: Math.max(0, Math.min(1, frameProgress)),
            frameIndex: i
          };
        }

        totalDelay = frameEnd;
      }

      return {
        currentFrame: frames[frames.length - 1],
        nextFrame: null,
        frameProgress: 1,
        frameIndex: frames.length - 1
      };
    }

    updateLayerFrame(layerAnim) {
      const sprite = this.layerSprites.get(layerAnim.layerId);
      const container = this.layerContainers.get(layerAnim.layerId);

      if (!sprite || !container) return;

      container.visible = layerAnim.visible;

      if (!layerAnim.visible || layerAnim.frames.length === 0) {
        sprite.visible = false;
        return;
      }

      const frameInfo = this.findCurrentAndNextFrame(layerAnim.frames);
      if (!frameInfo) return;

      const { currentFrame, nextFrame, frameProgress } = frameInfo;

      let targetFrame;
      if (currentFrame.interpolated && nextFrame && frameProgress > 0) {
        targetFrame = this.interpolateFrame(currentFrame, nextFrame, frameProgress);
      } else {
        targetFrame = currentFrame;
      }

      this.applyFrameToSprite(sprite, targetFrame, layerAnim.layerId);
    }

    updateNullFrame(nullAnim) {
      const graphics = this.nullGraphics.get(nullAnim.nullId);
      const container = this.nullContainers.get(nullAnim.nullId);

      if (!graphics || !container) return;

      container.visible = nullAnim.visible;

      if (!nullAnim.visible || nullAnim.frames.length === 0) {
        graphics.visible = false;
        return;
      }

      const frameInfo = this.findCurrentAndNextFrame(nullAnim.frames);
      if (!frameInfo) return;

      const { currentFrame, nextFrame, frameProgress } = frameInfo;

      let targetFrame;
      if (currentFrame.interpolated && nextFrame && frameProgress > 0) {
        targetFrame = this.interpolateFrame(currentFrame, nextFrame, frameProgress);
      } else {
        targetFrame = currentFrame;
      }

      this.applyFrameToNull(graphics, container, targetFrame);
    }

    applyFrameToNull(graphics, container, frame) {
      container.x = frame.xPosition;
      container.y = frame.yPosition;
      container.scale.set(frame.xScale / 100, frame.yScale / 100);
      container.rotation = (frame.rotation * Math.PI) / 180;
      graphics.visible = frame.visible;
      container.alpha = frame.alphaTint / 255;

      this.drawCrosshair(graphics, frame);

      const tint = (frame.redTint << 16) | (frame.greenTint << 8) | frame.blueTint;
      graphics.tint = tint;
    }

    applyFrameToSprite(sprite, frame, layerId) {
      const layer = this.getLayerById(layerId);
      if (!layer) return;

      const spritesheetData = this.spritesheets.get(layer.spritesheetId);
      if (spritesheetData && 
          frame.xCrop !== undefined && 
          frame.yCrop !== undefined && 
          frame.width !== undefined && 
          frame.height !== undefined) {
        
        // 크롭된 텍스처 생성
        try {
          const croppedTexture = new PIXI.Texture({
            source: spritesheetData.texture.source,
            frame: new PIXI.Rectangle(frame.xCrop, frame.yCrop, frame.width, frame.height)
          });
          sprite.texture = croppedTexture;
        } catch (error) {
          console.warn('Failed to create cropped texture, using full texture:', error);
          sprite.texture = spritesheetData.texture;
        }
      } else if (spritesheetData) {
        // 크롭 정보가 없으면 전체 텍스처 사용
        sprite.texture = spritesheetData.texture;
      }

      sprite.x = frame.xPosition;
      sprite.y = frame.yPosition;

      if (frame.xPivot !== undefined && 
          frame.yPivot !== undefined && 
          frame.width !== undefined && 
          frame.height !== undefined) {
        sprite.anchor.set(frame.xPivot / frame.width, frame.yPivot / frame.height);
      }

      sprite.scale.set(frame.xScale / 100, frame.yScale / 100);
      sprite.rotation = (frame.rotation * Math.PI) / 180;
      sprite.visible = frame.visible;

      const tint = (frame.redTint << 16) | (frame.greenTint << 8) | frame.blueTint;
      sprite.tint = tint;
      sprite.alpha = frame.alphaTint / 255;
    }

    getLayerById(layerId) {
      return this.anm2Data.content.layers.find(l => l.id === layerId);
    }

    updateControls() {
      const animation = this.getCurrentAnimation();
      if (!animation) return;

      // Update frame display
      const frameDisplay = document.getElementById('frame-display');
      const frameSlider = document.getElementById('frame-slider');
      const currentAnimationEl = document.getElementById('current-animation');
      const loopStatusEl = document.getElementById('loop-status');
      const totalFramesEl = document.getElementById('total-frames');

      if (frameDisplay) frameDisplay.textContent = `${this.currentFrame} / ${animation.frameNum}`;
      if (frameSlider) {
        frameSlider.max = animation.frameNum - 1;
        frameSlider.value = this.currentFrame;
      }
      if (currentAnimationEl) currentAnimationEl.textContent = this.currentAnimation;
      if (loopStatusEl) loopStatusEl.textContent = animation.loop ? '예' : '아니오';
      if (totalFramesEl) totalFramesEl.textContent = animation.frameNum;

      // Update button states
      const playBtn = document.getElementById('play-btn');
      const pauseBtn = document.getElementById('pause-btn');
      
      if (playBtn) playBtn.disabled = this.isPlaying;
      if (pauseBtn) pauseBtn.disabled = !this.isPlaying;
    }

    showError(message) {
      const canvasContainer = document.querySelector('.canvas-container');
      if (canvasContainer) {
        canvasContainer.innerHTML = `
          <div class="error">
            <h3>오류</h3>
            <p>${message}</p>
          </div>
        `;
      }
    }

    resize(width, height) {
      if (this.app) {
        this.app.renderer.resize(width, height);
        this.container.position.set(this.app.renderer.width / 2, this.app.renderer.height / 2);
      }
    }

    dispose() {
      if (this.app) {
        this.app.destroy(true);
      }
    }
  }

  // Initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.anm2Data) {
      console.error('ANM2 data not found');
      return;
    }

    const renderer = new Anm2PreviewRenderer('preview-canvas', window.anm2Data);
    
    // Set up event listeners
    const animationSelect = document.getElementById('animation-select');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const frameSlider = document.getElementById('frame-slider');
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    if (animationSelect) {
      animationSelect.addEventListener('change', (e) => {
        renderer.setAnimation(e.target.value);
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        renderer.play();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        renderer.pause();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        renderer.stop();
      });
    }

    if (frameSlider) {
      frameSlider.addEventListener('input', (e) => {
        renderer.setCurrentFrame(parseInt(e.target.value));
      });
    }

    if (speedSlider && speedDisplay) {
      speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        renderer.setSpeed(speed);
        speedDisplay.textContent = `${speed.toFixed(1)}x`;
      });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      const canvas = document.getElementById('preview-canvas');
      if (canvas) {
        renderer.resize(canvas.clientWidth, canvas.clientHeight);
      }
    });

    // Store renderer reference for potential cleanup
    window.anm2Renderer = renderer;
  });
})();
