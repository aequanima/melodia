export class AudioEngine {
  private audioContext?: AudioContext;
  private mediaRecorder?: MediaRecorder;
  private stream?: MediaStream;
  private recordingChunks: Blob[] = [];
  private isInitialized = false;
  private permissionGranted = false;
  private activeSources = new Map<string, AudioBufferSourceNode>();
  private audioBuffers = new Map<string, AudioBuffer>();

  constructor() {}

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return this.permissionGranted;

    try {
      // Request audio context (may require user gesture)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Don't try to resume here - it requires user gesture
      // We'll resume it later when the user first interacts
      console.log('AudioContext created, state:', this.audioContext.state);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
      return false;
    }
  }

  async requestMicrophonePermission(): Promise<boolean> {
    if (this.permissionGranted && this.stream) return true;

    try {
      // Resume audio context if suspended (requires user gesture)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContext resumed');
      }

      // Request access to microphone - this will prompt for permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });

      console.log('Microphone stream obtained successfully');
      this.permissionGranted = true;
      return true;

    } catch (error) {
      console.warn('Microphone permission denied or error:', error);
      this.handlePermissionError(error as Error);
      return false;
    }
  }

  private handlePermissionError(error: Error) {
    let message = 'Unable to access microphone.';
    
    if (error.name === 'NotAllowedError') {
      message = 'Microphone access was denied. Please enable microphone permissions in your browser settings to record audio while drawing.';
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found. Please connect a microphone to record audio.';
    } else if (error.name === 'NotSupportedError') {
      message = 'Audio recording is not supported in this browser.';
    }

    // Show user-friendly error message
    this.showPermissionDialog(message);
  }

  private showPermissionDialog(message: string) {
    // Create a simple modal dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      padding: 30px;
      max-width: 400px;
      margin: 20px;
      text-align: center;
      color: white;
    `;

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = 'margin: 0 0 20px 0; line-height: 1.5;';

    const button = document.createElement('button');
    button.textContent = 'Continue without audio';
    button.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      color: white;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 14px;
    `;

    button.onclick = () => document.body.removeChild(dialog);

    content.appendChild(messageEl);
    content.appendChild(button);
    dialog.appendChild(content);
    document.body.appendChild(dialog);
  }

  async startRecording(): Promise<boolean> {
    if (!this.permissionGranted || !this.stream) {
      console.warn('Cannot start recording: no permission or stream');
      return false;
    }

    try {
      // Clear previous recording chunks
      this.recordingChunks = [];

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Record in 100ms chunks
      return true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<ArrayBuffer | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordingChunks, { 
            type: this.mediaRecorder!.mimeType 
          });
          const arrayBuffer = await blob.arrayBuffer();
          resolve(arrayBuffer);
        } catch (error) {
          console.error('Failed to process recording:', error);
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  // Simple method to play audio at a specific position and rate
  async playAudioAtPosition(audioData: ArrayBuffer, playbackId: string, position: number, rate: number = 1.0): Promise<boolean> {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return false;
    }

    try {
      // Stop any existing playback
      this.stopPlayback(playbackId);

      // Decode audio if not already cached
      let audioBuffer = this.audioBuffers.get(playbackId);
      if (!audioBuffer) {
        audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
        this.audioBuffers.set(playbackId, audioBuffer);
        console.log(`Decoded audio for ${playbackId}: ${audioBuffer.duration.toFixed(2)}s`);
      }

      // Clamp inputs
      const clampedPosition = Math.max(0, Math.min(audioBuffer.duration - 0.01, position));
      const clampedRate = Math.max(0.5, Math.min(2.0, rate));

      // Create and configure source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = clampedRate;
      source.connect(this.audioContext.destination);

      // Store reference
      this.activeSources.set(playbackId, source);

      // Clean up when ended
      source.onended = () => {
        this.activeSources.delete(playbackId);
        console.log(`Audio ended for ${playbackId}`);
      };

      // Play from position
      const remainingDuration = audioBuffer.duration - clampedPosition;
      source.start(0, clampedPosition, remainingDuration);
      
      console.log(`Playing ${playbackId} from ${clampedPosition.toFixed(2)}s at ${clampedRate.toFixed(2)}x speed`);
      return true;

    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    }
  }

  // Simple method to create a looping audio section
  async createLoop(audioData: ArrayBuffer, playbackId: string, position: number, duration: number = 0.2): Promise<boolean> {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return false;
    }

    try {
      // Stop any existing playback
      this.stopPlayback(playbackId);

      // Decode audio if not already cached
      let audioBuffer = this.audioBuffers.get(playbackId);
      if (!audioBuffer) {
        audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
        this.audioBuffers.set(playbackId, audioBuffer);
      }

      // Clamp position and duration
      const clampedPosition = Math.max(0, Math.min(audioBuffer.duration - duration, position));
      const clampedDuration = Math.min(duration, audioBuffer.duration - clampedPosition);

      if (clampedDuration < 0.05) {
        console.warn('Loop duration too short');
        return false;
      }

      // Create looping source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.loopStart = clampedPosition;
      source.loopEnd = clampedPosition + clampedDuration;
      source.connect(this.audioContext.destination);

      // Store reference
      this.activeSources.set(playbackId, source);

      // Clean up when ended
      source.onended = () => {
        this.activeSources.delete(playbackId);
        console.log(`Loop ended for ${playbackId}`);
      };

      // Start loop
      source.start(0, clampedPosition);
      
      console.log(`Started loop for ${playbackId}: ${clampedPosition.toFixed(2)}s to ${(clampedPosition + clampedDuration).toFixed(2)}s`);
      return true;

    } catch (error) {
      console.error('Failed to create loop:', error);
      return false;
    }
  }

  stopPlayback(playbackId: string): void {
    const source = this.activeSources.get(playbackId);
    if (source) {
      try {
        source.stop();
        console.log(`Stopped playback for ${playbackId}`);
      } catch (error) {
        // Source might already be stopped
      }
      this.activeSources.delete(playbackId);
    }
  }

  stopAllPlayback(): void {
    for (const [id, source] of this.activeSources) {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
    }
    this.activeSources.clear();
    console.log('Stopped all playback');
  }

  isPlaying(playbackId: string): boolean {
    return this.activeSources.has(playbackId);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  isReady(): boolean {
    return this.isInitialized && this.permissionGranted;
  }

  getAudioContext(): AudioContext | undefined {
    return this.audioContext;
  }

  // Clean up resources
  destroy() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.stopAllPlayback();
    this.audioBuffers.clear();
    
    this.mediaRecorder = undefined;
    this.stream = undefined;
    this.audioContext = undefined;
    this.recordingChunks = [];
    this.isInitialized = false;
    this.permissionGranted = false;
  }
}