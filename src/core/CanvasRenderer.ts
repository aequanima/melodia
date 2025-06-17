import { AudioPath, Point, PathStyle } from '../utils/types.js';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private devicePixelRatio: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    this.setupCanvas();
    this.setupResizeHandler();
  }

  private setupCanvas() {
    this.resize();
    
    // Set up canvas for high DPI displays
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
    
    // Set initial drawing styles
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
  }

  private setupResizeHandler() {
    const resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    resizeObserver.observe(this.canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    
    // Set actual canvas size based on device pixel ratio
    this.canvas.width = rect.width * this.devicePixelRatio;
    this.canvas.height = rect.height * this.devicePixelRatio;
    
    // Scale context for high DPI
    this.context.scale(this.devicePixelRatio, this.devicePixelRatio);
    
    // Set CSS size
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.context.clearRect(0, 0, rect.width, rect.height);
  }

  drawPath(path: AudioPath, isActive: boolean = false) {
    if (path.points.length < 2) {
      this.drawSinglePoint(path.points[0], path.style, isActive);
      return;
    }

    this.context.save();
    
    // Apply path style
    this.context.strokeStyle = path.style.strokeColor;
    this.context.lineWidth = path.style.strokeWidth;
    
    // Add glow effect if active or has glow intensity
    if (isActive || path.style.glowIntensity > 0) {
      this.context.shadowColor = path.style.strokeColor;
      this.context.shadowBlur = path.style.glowIntensity * 20;
    }

    // Draw the path using smooth curves
    this.context.beginPath();
    this.context.moveTo(path.points[0].x, path.points[0].y);

    for (let i = 1; i < path.points.length - 1; i++) {
      const currentPoint = path.points[i];
      const nextPoint = path.points[i + 1];
      
      // Calculate control point for smooth curves
      const controlX = (currentPoint.x + nextPoint.x) / 2;
      const controlY = (currentPoint.y + nextPoint.y) / 2;
      
      this.context.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
    }

    // Draw to the last point
    if (path.points.length > 1) {
      const lastPoint = path.points[path.points.length - 1];
      this.context.lineTo(lastPoint.x, lastPoint.y);
    }

    this.context.stroke();
    this.context.restore();
  }

  drawSinglePoint(point: Point, style: PathStyle, isActive: boolean = false) {
    this.context.save();
    
    this.context.fillStyle = style.strokeColor;
    
    if (isActive || style.glowIntensity > 0) {
      this.context.shadowColor = style.strokeColor;
      this.context.shadowBlur = style.glowIntensity * 15;
    }

    this.context.beginPath();
    this.context.arc(point.x, point.y, style.strokeWidth / 2, 0, Math.PI * 2);
    this.context.fill();
    
    this.context.restore();
  }

  drawActivePoint(point: Point, intensity: number = 1) {
    this.context.save();
    
    // Pulsing red dot for recording
    const alpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
    this.context.fillStyle = `rgba(255, 68, 68, ${alpha * intensity})`;
    this.context.shadowColor = '#ff4444';
    this.context.shadowBlur = 20 * intensity;
    
    this.context.beginPath();
    this.context.arc(point.x, point.y, 8, 0, Math.PI * 2);
    this.context.fill();
    
    this.context.restore();
  }

  drawPlaybackIndicator(point: Point, intensity: number = 1) {
    this.context.save();
    
    // Bright white/blue indicator for playback
    const alpha = 0.8 * intensity;
    this.context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    this.context.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
    this.context.lineWidth = 2;
    this.context.shadowColor = '#64c8ff';
    this.context.shadowBlur = 15 * intensity;
    
    this.context.beginPath();
    this.context.arc(point.x, point.y, 6, 0, Math.PI * 2);
    this.context.fill();
    this.context.stroke();
    
    this.context.restore();
  }

  drawAllPaths(paths: AudioPath[], activePaths: Set<string>) {
    this.clear();
    
    // Draw all paths
    paths.forEach(path => {
      const isActive = activePaths.has(path.id);
      this.drawPath(path, isActive);
    });
  }

  // Utility method to get canvas data URL for export
  toDataURL(type: string = 'image/png', quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  // Get canvas dimensions
  getCanvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  // Animation helpers
  startAnimationLoop(callback: (timestamp: number) => void) {
    const animate = (timestamp: number) => {
      callback(timestamp);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}