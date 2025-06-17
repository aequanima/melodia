# Singing Fingers Clone - Application Architecture Plan

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Application Architecture](#application-architecture)
4. [Core Components](#core-components)
5. [Audio Architecture](#audio-architecture)
6. [Visual Design System](#visual-design-system)
7. [User Interface Components](#user-interface-components)
8. [Data Models](#data-models)
9. [Implementation Phases](#implementation-phases)
10. [Accessibility Considerations](#accessibility-considerations)

## Project Overview

### Vision
A modern, accessible web application that allows users (particularly young children in speech therapy) to create musical drawings by recording audio while drawing paths, then playing back the audio by tracing along those paths with variable speed and direction.

### Key Features
- **Multi-path Drawing**: Support for multiple separate audio-visual paths on a single canvas
- **Variable Playback**: Speed-sensitive playback with forward/reverse capabilities
- **Multi-touch Support**: Simultaneous playback of multiple paths
- **Liquid Glass UI**: Accessible, high-contrast interface with magical visual feedback
- **Audio Processing**: Real-time effects and filters during playback
- **Export Capabilities**: Save creations as audio/visual files

### Design Principles (Don Norman)
- **Visibility**: Clear visual indicators for recording/playback states
- **Feedback**: Immediate audio and visual responses to user actions
- **Constraints**: Smart detection prevents accidental overlapping recordings
- **Mapping**: Natural gesture-to-sound relationships
- **Affordances**: Touch targets sized appropriately for young children
- **Consistency**: Predictable interactions throughout the app

## Technical Stack

### Core Technologies
```javascript
// Frontend Framework
- Vanilla JavaScript (ES6+) with TypeScript for type safety
- No framework dependencies for maximum performance and minimal bundle size

// Graphics & Animation
- HTML5 Canvas API for drawing
- WebGL (via Three.js or raw) for particle effects and glow
- CSS Custom Properties for liquid glass UI elements
- SVG filters for glass distortion effects

// Audio
- Web Audio API for recording and playback
- AudioWorklet for custom audio processing
- MediaRecorder API for audio capture

// Storage & PWA
- IndexedDB for local storage of recordings
- Service Worker for offline functionality
- Web App Manifest for installability

// Build Tools
- Vite for development and building
- PostCSS for CSS processing
- Workbox for PWA generation
```

## Application Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Glass Menu │  │ Canvas Layer │  │ Feedback Layer  │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Application Core                          │
│  ┌───────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Path Manager  │  │Audio Engine │  │ State Manager   │  │
│  └───────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Data & Storage                            │
│  ┌───────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  IndexedDB    │  │ Audio Store │  │ Settings Store  │  │
│  └───────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure
```
src/
├── core/
│   ├── AudioEngine.ts         # Web Audio API wrapper
│   ├── PathManager.ts         # Path recording/playback logic
│   ├── CanvasRenderer.ts      # Drawing and visual effects
│   └── StateManager.ts        # Application state
├── components/
│   ├── GlassMenu.ts          # Liquid glass UI components
│   ├── ColorPalette.ts       # Color selection
│   ├── AudioFilters.ts       # Effect controls
│   └── TouchHandler.ts       # Multi-touch management
├── utils/
│   ├── AudioProcessor.ts     # Audio worklet processors
│   ├── VisualEffects.ts     # WebGL shaders and effects
│   ├── PathMath.ts          # Path calculations
│   └── Storage.ts           # IndexedDB operations
├── styles/
│   ├── glass-ui.css         # Liquid glass styles
│   ├── animations.css       # Keyframe animations
│   └── accessibility.css    # High contrast modes
└── workers/
    ├── audio.worker.ts      # Audio processing worker
    └── export.worker.ts     # Export functionality
```

## Core Components

### 1. PathManager
```typescript
interface PathManager {
  paths: Map<string, AudioPath>;
  activePaths: Set<string>;
  
  // Recording
  startRecording(point: Point): string;
  addPoint(pathId: string, point: Point): void;
  endRecording(pathId: string): void;
  
  // Playback
  startPlayback(pathId: string, startPoint: Point): PlaybackHandle;
  updatePlayback(handle: PlaybackHandle, point: Point): void;
  stopPlayback(handle: PlaybackHandle): void;
  
  // Path operations
  deletePath(pathId: string): void;
  clearAllPaths(): void;
  undo(): void;
  redo(): void;
}
```

### 2. AudioEngine
```typescript
interface AudioEngine {
  context: AudioContext;
  recorder: MediaRecorder;
  
  // Recording
  startRecording(): Promise<RecordingHandle>;
  stopRecording(handle: RecordingHandle): Promise<AudioBuffer>;
  
  // Playback
  createPlaybackNode(buffer: AudioBuffer): PlaybackNode;
  setPlaybackRate(node: PlaybackNode, rate: number): void;
  setPlaybackDirection(node: PlaybackNode, reverse: boolean): void;
  
  // Effects
  addFilter(node: PlaybackNode, filter: AudioFilter): void;
  removeFilter(node: PlaybackNode, filterId: string): void;
  
  // Analysis
  getFrequencyData(node: PlaybackNode): Float32Array;
  getVolumeLevel(node: PlaybackNode): number;
}
```

### 3. CanvasRenderer
```typescript
interface CanvasRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  webglContext?: WebGLRenderingContext;
  
  // Drawing
  drawPath(path: AudioPath, style: PathStyle): void;
  drawActivePoint(point: Point, intensity: number): void;
  
  // Effects
  addGlowEffect(path: AudioPath, color: Color): void;
  animatePlayback(path: AudioPath, progress: number): void;
  
  // Canvas operations
  clear(): void;
  resize(): void;
  toDataURL(): string;
}
```

## Audio Architecture

### Audio Processing Pipeline
```
Microphone Input
    │
    ├─→ MediaRecorder (for storage)
    │
    └─→ AnalyserNode (for visualization)
            │
            └─→ Frequency/Volume Data → Visual Feedback

Playback Chain:
AudioBufferSource → PlaybackRateNode → FilterChain → GainNode → Output
                          │                 │
                          │                 └─→ Reverb
                          │                 └─→ Delay
                          │                 └─→ Distortion
                          │
                          └─→ Variable based on finger speed
```

### Audio Storage Format
```typescript
interface AudioData {
  buffer: ArrayBuffer;        // Raw audio data
  format: 'webm' | 'mp3';    // Audio format
  sampleRate: number;        // Sample rate
  duration: number;          // Duration in seconds
  metadata: {
    recordedAt: number;      // Timestamp
    originalSpeed: number;   // mm/s during recording
  };
}
```

## Visual Design System

### Liquid Glass Components
```css
/* Base Glass Container */
.glass-container {
  --glass-blur: 12px;
  --glass-tint: rgba(255, 255, 255, 0.1);
  --glass-shadow: inset 0 0 20px -5px rgba(255, 255, 255, 0.7);
  --glass-border: 1px solid rgba(255, 255, 255, 0.2);
  
  backdrop-filter: blur(var(--glass-blur));
  background: var(--glass-tint);
  box-shadow: var(--glass-shadow);
  border: var(--glass-border);
  border-radius: 16px;
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  .glass-container {
    --glass-tint: rgba(0, 0, 0, 0.8);
    --glass-border: 2px solid white;
    backdrop-filter: none;
  }
}
```

### Path Visualization States
```typescript
enum PathState {
  IDLE = 'idle',              // Default state
  RECORDING = 'recording',    // Pulsing red glow
  PLAYING = 'playing',        // Animated gradient
  HOVER = 'hover'            // Subtle highlight
}

interface PathStyle {
  strokeWidth: number;        // Based on volume
  strokeColor: Color;        // Based on frequency
  glowIntensity: number;     // Based on playback state
  particleEmission: number;  // Magical effect density
}
```

### Visual Effects
1. **Recording Feedback**
   - Pulsing red dot at recording point
   - Growing path with volume-based width
   - Frequency-based color shifting

2. **Playback Effects**
   - Traveling light along path
   - Particle emission at playback point
   - Ripple effects on touch
   - Path glow intensity based on volume

3. **Magical Enhancements**
   - Sparkle particles on high frequencies
   - Color trails during fast playback
   - Morphing path width with audio envelope

## User Interface Components

### Main UI Layout
```
┌─────────────────────────────────────────────────────┐
│  ┌──────┐                                    ┌────┐ │
│  │ Menu │                                    │Help│ │
│  └──────┘                                    └────┘ │
│                                                     │
│              Canvas Area (Full Screen)              │
│                                                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │         Active Recording Indicator           │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Glass Menu Components
1. **Main Menu**
   - Clear Canvas
   - Undo/Redo
   - Save/Export
   - Settings

2. **Audio Filters Panel**
   - Reverb (Hall, Room, Spring)
   - Delay (Time, Feedback)
   - Pitch Shift
   - Distortion

3. **Color Palette**
   - Preset colors for different moods
   - Custom color picker
   - Automatic frequency mapping

4. **Settings Panel**
   - Minimum dwell time
   - Touch sensitivity
   - Visual effects intensity
   - Accessibility options

### Touch Interaction States
```typescript
interface TouchState {
  id: number;
  startPoint: Point;
  currentPoint: Point;
  velocity: number;
  state: 'recording' | 'playing' | 'idle';
  associatedPath?: string;
  playbackHandle?: PlaybackHandle;
}
```

## Data Models

### Core Data Structures
```typescript
// Path data model
interface AudioPath {
  id: string;
  points: PathPoint[];
  audioData: AudioData;
  style: PathStyle;
  boundingBox: Rectangle;
  createdAt: number;
}

// Path point with timing
interface PathPoint {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;  // For pressure-sensitive devices
}

// Playback handle
interface PlaybackHandle {
  id: string;
  pathId: string;
  startTime: number;
  currentPosition: number;
  playbackRate: number;
  isReversed: boolean;
  audioNode: AudioBufferSourceNode;
}

// Application state
interface AppState {
  paths: Map<string, AudioPath>;
  activeTouches: Map<number, TouchState>;
  isRecording: boolean;
  selectedFilters: Set<AudioFilter>;
  settings: UserSettings;
  history: HistoryStack;
}
```

### Storage Schema
```typescript
// IndexedDB schema
interface StorageSchema {
  paths: {
    key: string;
    value: SerializedPath;
    indexes: ['createdAt'];
  };
  audio: {
    key: string;
    value: AudioData;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
}
```

## Implementation Phases

### Phase 1: Core Foundation (Week 1-2)
- [ ] Set up project structure and build tools
- [ ] Implement basic Canvas drawing
- [ ] Create touch event handling system
- [ ] Build path data structures
- [ ] Implement basic audio recording

### Phase 2: Audio Engine (Week 3-4)
- [ ] Implement Web Audio API integration
- [ ] Create playback system with variable speed
- [ ] Add reverse playback capability
- [ ] Implement audio-to-visual mapping
- [ ] Build audio storage system

### Phase 3: Visual Polish (Week 5-6)
- [ ] Implement liquid glass UI components
- [ ] Add WebGL effects for glow and particles
- [ ] Create smooth animations and transitions
- [ ] Implement color/frequency mapping
- [ ] Add visual feedback systems

### Phase 4: Advanced Features (Week 7-8)
- [ ] Implement multi-touch support
- [ ] Add audio filters and effects
- [ ] Create undo/redo system
- [ ] Build export functionality
- [ ] Implement settings persistence

### Phase 5: Accessibility & PWA (Week 9-10)
- [ ] Add high contrast mode
- [ ] Implement keyboard navigation
- [ ] Create screen reader support
- [ ] Build offline functionality
- [ ] Add installation prompt

### Phase 6: Testing & Optimization (Week 11-12)
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] User testing with SLPs
- [ ] Bug fixes and polish
- [ ] Documentation

## Accessibility Considerations

### Visual Accessibility
1. **High Contrast Mode**
   - Automatic detection via `prefers-contrast`
   - Manual toggle in settings
   - Ensures WCAG AAA compliance

2. **Visual Indicators**
   - Large, clear touch targets (min 44x44px)
   - Multiple feedback channels (color + motion)
   - Clear state indicators

3. **Customization**
   - Adjustable visual effect intensity
   - Color blind friendly palettes
   - Reduced motion options

### Motor Accessibility
1. **Touch Accommodations**
   - Adjustable dwell time
   - Touch tolerance zones
   - Gesture alternatives
   - No time-based interactions

2. **Input Flexibility**
   - Support for stylus input
   - Keyboard navigation fallback
   - Single-touch alternatives

### Cognitive Accessibility
1. **Simplicity**
   - Clear, intuitive interactions
   - Consistent behavior
   - Immediate feedback
   - No hidden gestures

2. **Error Prevention**
   - Confirmation for destructive actions
   - Easy undo/redo
   - Clear boundaries between paths
   - Smart overlap detection

### Auditory Accessibility
1. **Visual Alternatives**
   - Visual waveform display
   - Frequency visualization
   - Recording indicators
   - Playback progress

## Performance Considerations

### Optimization Strategies
1. **Canvas Rendering**
   - Use `requestAnimationFrame` for smooth animations
   - Implement dirty rectangle optimization
   - Layer static and dynamic content
   - Use WebGL for complex effects

2. **Audio Processing**
   - Use AudioWorklet for real-time processing
   - Implement audio buffer pooling
   - Lazy load audio effects
   - Optimize sample rate conversion

3. **Memory Management**
   - Limit maximum recording duration
   - Implement path simplification
   - Use WeakMap for temporary data
   - Clean up audio buffers

4. **Touch Performance**
   - Debounce touch events
   - Use pointer events API
   - Implement touch prediction
   - Optimize hit detection

## Security Considerations

1. **Permissions**
   - Request microphone access gracefully
   - Handle permission denial
   - Provide clear usage explanation

2. **Data Privacy**
   - All data stored locally
   - No external API calls
   - Clear data management options

3. **Content Security**
   - Implement CSP headers
   - Sanitize export filenames
   - Validate audio formats

## Future Enhancements

1. **Collaboration Features**
   - Share creations via URL
   - Collaborative drawing sessions
   - Cloud backup option

2. **Advanced Audio**
   - MIDI instrument support
   - Advanced synthesis options
   - Audio import capability

3. **Educational Tools**
   - Guided tutorials
   - Progress tracking for therapy
   - Preset activities

4. **Platform Extensions**
   - Native app wrappers
   - Desktop application
   - Integration with therapy software