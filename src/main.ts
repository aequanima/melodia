import './styles/main.css';
import { TouchHandler } from './components/TouchHandler.js';
import { PathManager } from './core/PathManager.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { AudioEngine } from './core/AudioEngine.js';
import { InputEvent, Point } from './utils/types.js';

class MelodiaApp {
  private canvas: HTMLCanvasElement;
  private touchHandler: TouchHandler;
  private pathManager: PathManager;
  private renderer: CanvasRenderer;
  private audioEngine: AudioEngine;
  private recordingIndicator: HTMLElement;
  
  private currentRecordingPath: string | null = null;
  private isAppReady = false;
  private playingPaths = new Set<string>();
  private playbackIndicators = new Map<string, Point>();
  private activePlaybackPath: string | null = null;
  private lastPlaybackPoint: Point | null = null;
  private lastPlaybackTime: number = 0;
  private isMoving: boolean = false;
  private movementThreshold: number = 5; // pixels
  private lastAudioPosition: number = 0;
  private positionSmoothingFactor: number = 0.3;

  constructor() {
    console.log('MelodiaApp constructor called');
    this.canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    this.recordingIndicator = document.getElementById('recording-indicator') as HTMLElement;
    
    if (!this.canvas) {
      console.error('Canvas element not found!');
      throw new Error('Canvas element not found');
    }

    console.log('Canvas found:', this.canvas);
    console.log('Canvas dimensions:', this.canvas.clientWidth, 'x', this.canvas.clientHeight);

    // Initialize components
    this.pathManager = new PathManager();
    this.renderer = new CanvasRenderer(this.canvas);
    this.audioEngine = new AudioEngine();
    this.touchHandler = new TouchHandler(this.canvas);

    console.log('All components initialized');
    
    // Set up event handlers immediately (before async init)
    this.setupEventHandlers();
    
    this.init();
  }

  private async init() {
    try {
      // Initialize audio engine (don't block on failure)
      try {
        await this.audioEngine.initialize();
        console.log('Audio engine initialized');
      } catch (audioError) {
        console.warn('Audio engine failed to initialize, continuing without audio:', audioError);
      }
      
      // Start render loop
      this.startRenderLoop();
      
      // Request microphone permission on first user interaction
      this.setupPermissionRequest();
      
      this.isAppReady = true;
      console.log('Melodia app initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // Set ready anyway so drawing still works
      this.isAppReady = true;
    }
  }

  private setupEventHandlers() {
    console.log('Setting up event handlers...');
    
    this.touchHandler.onStart((event: InputEvent) => {
      this.handleInputStart(event);
    });

    this.touchHandler.onMove((event: InputEvent) => {
      this.handleInputMove(event);
    });

    this.touchHandler.onEnd((event: InputEvent) => {
      this.handleInputEnd(event);
    });
    
    console.log('Event handlers set up successfully');
  }

  private async handleInputStart(event: InputEvent) {
    console.log('Input start event:', event);
    
    if (!this.isAppReady) {
      console.warn('App not ready');
      return;
    }

    // Check if clicking on an existing path
    const existingPathId = this.pathManager.findPathAtPoint(event.point, 15);
    
    if (existingPathId) {
      console.log('Clicked on existing path:', existingPathId);
      await this.handlePathPlayback(existingPathId, event.point);
      return;
    }

    // Starting new path recording
    console.log('Starting new path recording');

    // Check if we need to request microphone permission
    if (!this.audioEngine.isReady()) {
      console.log('Requesting microphone permission...');
      const permissionGranted = await this.audioEngine.requestMicrophonePermission();
      if (!permissionGranted) {
        console.warn('Audio recording not available, continuing with visual-only mode');
      }
    }

    // Start recording audio if available
    let audioStarted = false;
    if (this.audioEngine.isReady()) {
      audioStarted = await this.audioEngine.startRecording();
      console.log('Audio recording started:', audioStarted);
    }

    // Start path recording
    this.currentRecordingPath = this.pathManager.startRecording(event.point);
    
    // Show recording indicator (always show for visual feedback)
    this.showRecordingIndicator();

    console.log('Started recording path:', this.currentRecordingPath);
  }

  private handleInputMove(event: InputEvent) {
    if (!this.isAppReady) {
      return;
    }

    // Handle playback interaction
    if (this.activePlaybackPath && !this.currentRecordingPath) {
      this.handlePlaybackMove(event.point);
      return;
    }

    // Handle recording
    if (this.currentRecordingPath) {
      this.pathManager.addPoint(this.currentRecordingPath, event.point);
      console.log('Added point to path:', event.point);
    }
  }

  private handlePlaybackMove(currentPoint: Point) {
    if (!this.activePlaybackPath || !this.lastPlaybackPoint) return;

    const path = this.pathManager.getPath(this.activePlaybackPath);
    if (!path || !path.audioData) return;

    // Calculate movement distance
    const distance = Math.sqrt(
      Math.pow(currentPoint.x - this.lastPlaybackPoint.x, 2) + 
      Math.pow(currentPoint.y - this.lastPlaybackPoint.y, 2)
    );

    // Check if user has moved enough to switch to scrubbing mode
    if (!this.isMoving && distance > this.movementThreshold) {
      this.isMoving = true;
      console.log('Switched to scrubbing mode');
    }

    // If not moving, don't update anything (keep looping at current position)
    if (!this.isMoving) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastPlaybackTime;
    
    if (deltaTime < 100) return; // Throttle updates
    
    // Get current position on path
    const nearestResult = this.pathManager.findNearestPointOnPath(currentPoint, this.activePlaybackPath);
    if (!nearestResult) return;

    const currentAudioPosition = nearestResult.progress * path.audioData.duration;
    const positionDiff = Math.abs(currentAudioPosition - this.lastAudioPosition);
    
    // If position changed significantly, play audio at new position
    if (positionDiff > 0.05) { // 50ms threshold
      // Calculate speed and playback rate
      const speed = deltaTime > 0 ? (distance / deltaTime) * 1000 : 0;
      const baseSpeed = 100;
      const playbackRate = Math.max(0.5, Math.min(2.0, speed / baseSpeed));
      
      this.audioEngine.playAudioAtPosition(path.audioData.buffer, this.activePlaybackPath, currentAudioPosition, playbackRate);
      this.lastAudioPosition = currentAudioPosition;
    }
    
    // Always update visual indicator
    this.playbackIndicators.set(this.activePlaybackPath, nearestResult.point);
    
    // Update tracking variables
    this.lastPlaybackPoint = currentPoint;
    this.lastPlaybackTime = currentTime;
  }

  private async handleInputEnd(event: InputEvent) {
    if (!this.isAppReady) return;

    // Handle end of interactive playback
    if (this.activePlaybackPath && !this.currentRecordingPath) {
      console.log('Ending interactive scrubbing for:', this.activePlaybackPath);
      this.audioEngine.stopPlayback(this.activePlaybackPath);
      this.playingPaths.delete(this.activePlaybackPath);
      this.playbackIndicators.delete(this.activePlaybackPath);
      this.activePlaybackPath = null;
      this.lastPlaybackPoint = null;
      this.isMoving = false;
      this.lastAudioPosition = 0;
      return;
    }

    // Handle end of recording
    if (this.currentRecordingPath) {
      // Add final point
      this.pathManager.addPoint(this.currentRecordingPath, event.point);

      // Stop audio recording
      const audioData = await this.audioEngine.stopRecording();
      if (audioData) {
        this.pathManager.attachAudioData(this.currentRecordingPath, audioData);
      }

      // End path recording
      this.pathManager.endRecording(this.currentRecordingPath);
      
      // Hide recording indicator
      this.hideRecordingIndicator();

      console.log('Finished recording path:', this.currentRecordingPath);
      this.currentRecordingPath = null;
    }
  }

  private startRenderLoop() {
    const render = () => {
      this.renderer.clear();
      
      // Get all paths and combine active/playing paths
      const allPaths = this.pathManager.getAllPaths();
      const activePaths = new Set([
        ...this.pathManager.getActivePaths().map(p => p.id),
        ...this.playingPaths
      ]);
      
      // Draw all paths
      this.renderer.drawAllPaths(allPaths, activePaths);
      
      // Draw playback indicators for playing paths
      for (const playingPathId of this.playingPaths) {
        const indicatorPoint = this.playbackIndicators.get(playingPathId);
        if (indicatorPoint) {
          this.renderer.drawPlaybackIndicator(indicatorPoint);
        }
      }
      
      // Draw recording indicator on canvas if recording
      if (this.currentRecordingPath && this.pathManager.isRecording(this.currentRecordingPath)) {
        const path = this.pathManager.getPath(this.currentRecordingPath);
        if (path && path.points.length > 0) {
          const lastPoint = path.points[path.points.length - 1];
          this.renderer.drawActivePoint(lastPoint);
        }
      }
      
      requestAnimationFrame(render);
    };
    
    requestAnimationFrame(render);
  }

  private setupPermissionRequest() {
    // Request permission on first user interaction
    const requestPermission = async () => {
      if (!this.audioEngine.isReady()) {
        await this.audioEngine.requestMicrophonePermission();
      }
      
      // Remove event listeners after first interaction
      document.removeEventListener('touchstart', requestPermission);
      document.removeEventListener('mousedown', requestPermission);
    };

    document.addEventListener('touchstart', requestPermission, { once: true });
    document.addEventListener('mousedown', requestPermission, { once: true });
  }

  private showRecordingIndicator() {
    this.recordingIndicator.classList.remove('hidden');
  }

  private hideRecordingIndicator() {
    this.recordingIndicator.classList.add('hidden');
  }

  private async handlePathPlayback(pathId: string, clickPoint: Point) {
    const path = this.pathManager.getPath(pathId);
    if (!path || !path.audioData) {
      console.log('Path has no audio data:', pathId);
      return;
    }

    // Find the nearest point on the path to where the user clicked
    const nearestResult = this.pathManager.findNearestPointOnPath(clickPoint, pathId);
    if (!nearestResult) {
      console.warn('Could not find nearest point on path');
      return;
    }

    const { point: nearestPoint, progress } = nearestResult;

    // Resume audio context if needed
    if (!this.audioEngine.isReady()) {
      const permissionGranted = await this.audioEngine.requestMicrophonePermission();
      if (!permissionGranted) {
        console.warn('Cannot play audio without audio context');
        return;
      }
    }

    // Start interactive playback
    this.activePlaybackPath = pathId;
    this.lastPlaybackPoint = nearestPoint;
    this.lastPlaybackTime = performance.now();
    this.isMoving = false;

    // Calculate position based on progress along the path
    const position = progress * path.audioData.duration;
    this.lastAudioPosition = position;

    // Start with a small loop at this position (for stationary touch)
    await this.audioEngine.createLoop(path.audioData.buffer, pathId, position, 0.2);
    
    console.log('Started playback at position:', pathId, 'at progress:', (progress * 100).toFixed(1) + '%', 'position:', position.toFixed(2) + 's');
    
    // Track that this path is playing and where
    this.playingPaths.add(pathId);
    this.playbackIndicators.set(pathId, nearestPoint);
  }

  // Public methods for potential future use
  public clearCanvas() {
    this.pathManager.clearAllPaths();
    this.renderer.clear();
  }

  public isRecording(): boolean {
    return this.pathManager.isRecording();
  }

  public destroy() {
    this.touchHandler.destroy();
    this.audioEngine.destroy();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    new MelodiaApp();
  } catch (error) {
    console.error('Failed to start Melodia app:', error);
    
    // Show error message to user
    document.body.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        text-align: center;
        color: white;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <div>
          <h1>Melodia</h1>
          <p>Failed to initialize the application.</p>
          <p style="font-size: 14px; opacity: 0.8;">Please refresh the page and try again.</p>
        </div>
      </div>
    `;
  }
});

// Handle page visibility changes to pause/resume audio context
document.addEventListener('visibilitychange', () => {
  // This will help with audio context suspension on mobile
  if (document.hidden) {
    console.log('App hidden, pausing audio context');
  } else {
    console.log('App visible, resuming audio context');
  }
});