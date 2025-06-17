export interface Point {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
}

export interface PathPoint extends Point {
  // Additional properties for path points can be added here
}

export interface AudioPath {
  id: string;
  points: PathPoint[];
  audioData?: AudioData;
  style: PathStyle;
  boundingBox: Rectangle;
  createdAt: number;
}

export interface AudioData {
  buffer: ArrayBuffer;
  format: 'webm' | 'mp3';
  sampleRate: number;
  duration: number;
  metadata: {
    recordedAt: number;
    originalSpeed: number;
  };
}

export interface PathStyle {
  strokeWidth: number;
  strokeColor: string;
  glowIntensity: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TouchState {
  id: number;
  startPoint: Point;
  currentPoint: Point;
  velocity: number;
  state: 'recording' | 'playing' | 'idle';
  associatedPath?: string;
}

export enum InputType {
  MOUSE = 'mouse',
  TOUCH = 'touch',
  PEN = 'pen'
}

export interface InputEvent {
  type: InputType;
  point: Point;
  isStart: boolean;
  isEnd: boolean;
  id: number;
}