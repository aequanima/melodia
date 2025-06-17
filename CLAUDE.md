# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Melodia is a web application that allows users (particularly young children in speech therapy) to create musical drawings by recording audio while drawing paths, then playing back the audio by tracing along those paths with variable speed and direction.

## Architecture

This is a vanilla JavaScript/TypeScript web application designed to be a PWA with no framework dependencies for maximum performance and minimal bundle size.

### Planned Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+) with TypeScript
- **Graphics**: HTML5 Canvas API, WebGL (Three.js or raw) for effects
- **Audio**: Web Audio API, AudioWorklet, MediaRecorder API
- **Storage**: IndexedDB for local storage
- **Build**: Vite for development and building
- **PWA**: Service Worker, Web App Manifest

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

## Key Technical Requirements

### Audio Processing
- Use Web Audio API for real-time audio recording and playback
- Variable speed playback based on finger movement speed
- Support for reverse playback
- Real-time audio effects (reverb, delay, distortion, pitch shift)
- Use AudioWorklet for custom audio processing

### Visual Design
- "Liquid glass" UI with backdrop-filter and transparency effects
- High contrast mode support for accessibility
- Canvas-based drawing with WebGL effects for glow and particles
- Frequency-responsive visual feedback during recording
- Multi-path support with different colors and styles

### Touch & Interaction
- Multi-touch support for simultaneous path playback
- Pressure-sensitive input support where available
- Minimum 44x44px touch targets for accessibility
- Smart overlap detection to prevent path conflicts

### Accessibility
- High contrast mode with WCAG AAA compliance
- Large touch targets for motor accessibility
- Visual alternatives for audio content
- Reduced motion options
- Screen reader support

### Performance
- Use requestAnimationFrame for smooth animations
- Implement dirty rectangle optimization for canvas rendering
- Audio buffer pooling for memory efficiency
- Touch event debouncing
- WebGL for complex visual effects

## Development Notes

- No external dependencies beyond essential build tools
- All data stored locally using IndexedDB
- PWA features for offline functionality and installation
- TypeScript for type safety throughout
- Focus on accessibility and usability for children with speech therapy needs
- Liquid glass aesthetic with CSS custom properties and backdrop-filter

## Implementation Phases

The architecture document outlines a 12-week implementation plan:
1. Core Foundation (Canvas, touch handling, basic audio)
2. Audio Engine (Web Audio API, variable speed playback)
3. Visual Polish (liquid glass UI, WebGL effects)
4. Advanced Features (multi-touch, audio filters, undo/redo)
5. Accessibility & PWA (high contrast, offline support)
6. Testing & Optimization (performance, cross-browser)