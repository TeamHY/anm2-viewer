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
      this.frameTimer = 0;
      this.lastTime = 0;
      this.zoom = 1;
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.containerOffset = { x: 0, y: 0 };
      this.isZoomInputFocused = false;
      
      this.initializePixi();
    }

    async initializePixi() {
      try {
        const canvasContainer = this.canvas.parentElement;
        const containerWidth = canvasContainer ? canvasContainer.clientWidth : 800;
        const containerHeight = canvasContainer ? canvasContainer.clientHeight : 600;

        this.app = new PIXI.Application();
        await this.app.init({
          canvas: this.canvas,
          width: Math.max(containerWidth, 400),
          height: Math.max(containerHeight, 300),
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: false
        });

        this.container = new PIXI.Container();
        this.container.position.set(this.app.renderer.width / 2, this.app.renderer.height / 2);
        this.app.stage.addChild(this.container);

        await this.loadSpritesheets();
        this.initializeLayers();
        this.initializeNulls();
        this.updateFrame();
        this.updateControls();
        this.setupZoomAndPan();
        
        this.app.ticker.add(() => this.update());
        
        console.log('PIXI application initialized successfully');
      } catch (error) {
        console.error('Failed to initialize PIXI:', error);
        this.showError('PIXI initialization failed: ' + error.message);
      }
    }

    async loadSpritesheets() {
      const spritesheetDataArray = window.spritesheetData || [];
      const spritesheetMap = new Map(spritesheetDataArray);

      for (const spritesheet of this.anm2Data.content.spritesheets) {
        try {
          const dataUrl = spritesheetMap.get(spritesheet.id);
          
          if (dataUrl) {
            const texture = await PIXI.Assets.load(dataUrl);
            texture.source.scaleMode = 'nearest';
            
            this.spritesheets.set(spritesheet.id, {
              texture: texture,
              path: spritesheet.path
            });
            
            console.log(`Loaded spritesheet: ${spritesheet.path}`);
          } else {
            console.warn(`No data for spritesheet: ${spritesheet.path}`);
            const missingTexture = this.createMissingTexture();
            this.spritesheets.set(spritesheet.id, {
              texture: missingTexture,
              path: spritesheet.path
            });
          }
        } catch (error) {
          console.error(`Failed to load spritesheet ${spritesheet.path}:`, error);
          const missingTexture = this.createMissingTexture();
          this.spritesheets.set(spritesheet.id, {
            texture: missingTexture,
            path: spritesheet.path
          });
        }
      }
    }

    createMissingTexture(width = 256, height = 256) {
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
      this.frameTimer += deltaTime;

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
          this.currentFrame = 0;
          this.isPlaying = false;
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
      const zoomInput = document.getElementById('zoom-input');

      if (frameDisplay) frameDisplay.textContent = `${this.currentFrame + 1} / ${animation.frameNum}`;
      if (frameSlider) {
        frameSlider.max = animation.frameNum - 1;
        frameSlider.value = this.currentFrame;
      }
      if (zoomInput && !this.isZoomInputFocused) zoomInput.value = `${Math.round(this.zoom * 100)}%`;

      // Update button states
      const playPauseBtn = document.getElementById('play-pause-btn');
      
      if (playPauseBtn) {
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');
        
        if (animation.frameNum === 1) {
          playPauseBtn.disabled = true;
          playPauseBtn.style.opacity = '0.5';
        } else {
          playPauseBtn.disabled = false;
          playPauseBtn.style.opacity = '1';
          
          if (this.isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
          } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
          }
        }
      }
    }

    showError(message) {
      const canvasContainer = document.querySelector('.canvas-container');
      if (canvasContainer) {
        canvasContainer.innerHTML = `
          <div class="error">
            <h3>Error</h3>
            <p>${message}</p>
          </div>
        `;
      }
    }

    setupZoomAndPan() {
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(20, this.zoom * zoomFactor));
        
        const worldMouseX = (mouseX - this.app.renderer.width / 2 - this.containerOffset.x) / this.zoom;
        const worldMouseY = (mouseY - this.app.renderer.height / 2 - this.containerOffset.y) / this.zoom;
        
        this.zoom = newZoom;
        this.container.scale.set(this.zoom);
        
        this.containerOffset.x = mouseX - this.app.renderer.width / 2 - worldMouseX * this.zoom;
        this.containerOffset.y = mouseY - this.app.renderer.height / 2 - worldMouseY * this.zoom;
        
        this.updateContainerPosition();
        this.updateControls();
      });

      this.canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.dragStart.x = e.clientX - this.containerOffset.x;
        this.dragStart.y = e.clientY - this.containerOffset.y;
        this.canvas.style.cursor = 'grabbing';
      });

      this.canvas.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          this.containerOffset.x = e.clientX - this.dragStart.x;
          this.containerOffset.y = e.clientY - this.dragStart.y;
          this.updateContainerPosition();
        }
      });

      this.canvas.addEventListener('mouseup', () => {
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
      });
    }

    updateContainerPosition() {
      this.container.position.set(
        this.app.renderer.width / 2 + this.containerOffset.x,
        this.app.renderer.height / 2 + this.containerOffset.y
      );
    }

    resetZoom() {
      this.zoom = 1;
      this.containerOffset = { x: 0, y: 0 };
      this.container.scale.set(this.zoom);
      this.updateContainerPosition();
      this.updateControls();
    }

    setZoom(zoomLevel) {
      this.zoom = Math.max(0.1, Math.min(5, zoomLevel));
      this.container.scale.set(this.zoom);
      this.updateContainerPosition();
      this.updateControls();
    }

    resize(width, height) {
      if (this.app) {
        this.app.renderer.resize(width, height);
        this.updateContainerPosition();
      }
    }

    dispose() {
      if (this.app) {
        this.app.destroy(true);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.anm2Data) {
      console.error('ANM2 data not found');
      return;
    }

    const renderer = new Anm2PreviewRenderer('preview-canvas', window.anm2Data);
    
    const animationSelect = document.getElementById('animation-select');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const frameSlider = document.getElementById('frame-slider');
    const zoomInput = document.getElementById('zoom-input');

    if (animationSelect) {
      animationSelect.addEventListener('change', (e) => {
        renderer.setAnimation(e.target.value);
      });
    }

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (renderer.isPlaying) {
          renderer.pause();
        } else {
          renderer.play();
        }
      });
    }

    if (frameSlider) {
      frameSlider.addEventListener('input', (e) => {
        renderer.setCurrentFrame(parseInt(e.target.value));
      });
    }

    if (zoomInput) {
      zoomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = e.target.value.trim();
          let zoom = parseFloat(value.replace('%', ''));
          
          if (!isNaN(zoom) && zoom > 0) {
            zoom = Math.max(10, Math.min(2000, zoom));
            renderer.setZoom(zoom / 100);
          } else {
            e.target.value = `${Math.round(renderer.zoom * 100)}%`;
          }
          e.target.blur();
        }
      });

      zoomInput.addEventListener('blur', (e) => {
        renderer.isZoomInputFocused = false;
        e.target.value = `${Math.round(renderer.zoom * 100)}%`;
      });

      zoomInput.addEventListener('focus', (e) => {
        renderer.isZoomInputFocused = true;
        e.target.select();
      });
    }

    window.addEventListener('resize', () => {
      const canvas = document.getElementById('preview-canvas');
      if (canvas) {
        renderer.resize(canvas.clientWidth, canvas.clientHeight);
      }
    });

    window.anm2Renderer = renderer;

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        renderer.resetZoom();
      } else if (e.ctrlKey && e.key === '=') {
        e.preventDefault();
        renderer.setZoom(renderer.zoom * 1.2);
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        renderer.setZoom(renderer.zoom / 1.2);
      }
    });
  });
})();
