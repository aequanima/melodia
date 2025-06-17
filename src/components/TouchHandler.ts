import { Point, InputEvent, InputType } from '../utils/types.js';

export class TouchHandler {
  private canvas: HTMLCanvasElement;
  private activeTouches = new Map<number, TouchState>();
  private callbacks = {
    onStart: [] as Array<(event: InputEvent) => void>,
    onMove: [] as Array<(event: InputEvent) => void>,
    onEnd: [] as Array<(event: InputEvent) => void>,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

    // Mouse events (for desktop compatibility)
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Pointer events (for pen support) - temporarily disabled for debugging
    // if ('onpointerdown' in this.canvas) {
    //   this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    //   this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    //   this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
    //   this.canvas.addEventListener('pointercancel', this.handlePointerUp.bind(this));
    // }

    // Prevent context menu on long press
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private getCanvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    
    // Convert to canvas coordinates (not accounting for device pixel ratio)
    // The renderer handles DPI scaling internally
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      timestamp: performance.now(),
    };
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const point = this.getCanvasPoint(touch.clientX, touch.clientY);
      
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        startPoint: point,
        currentPoint: point,
        lastTimestamp: point.timestamp,
      });

      const inputEvent: InputEvent = {
        type: InputType.TOUCH,
        point,
        isStart: true,
        isEnd: false,
        id: touch.identifier,
      };

      this.callbacks.onStart.forEach(callback => callback(inputEvent));
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchState = this.activeTouches.get(touch.identifier);
      
      if (!touchState) continue;

      const point = this.getCanvasPoint(touch.clientX, touch.clientY);
      touchState.currentPoint = point;

      const inputEvent: InputEvent = {
        type: InputType.TOUCH,
        point,
        isStart: false,
        isEnd: false,
        id: touch.identifier,
      };

      this.callbacks.onMove.forEach(callback => callback(inputEvent));
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchState = this.activeTouches.get(touch.identifier);
      
      if (!touchState) continue;

      const point = this.getCanvasPoint(touch.clientX, touch.clientY);

      const inputEvent: InputEvent = {
        type: InputType.TOUCH,
        point,
        isStart: false,
        isEnd: true,
        id: touch.identifier,
      };

      this.callbacks.onEnd.forEach(callback => callback(inputEvent));
      this.activeTouches.delete(touch.identifier);
    }
  }

  private handleMouseDown(e: MouseEvent) {
    console.log('Mouse down event:', e);
    const point = this.getCanvasPoint(e.clientX, e.clientY);
    
    this.activeTouches.set(-1, {
      id: -1,
      startPoint: point,
      currentPoint: point,
      lastTimestamp: point.timestamp,
    });

    const inputEvent: InputEvent = {
      type: InputType.MOUSE,
      point,
      isStart: true,
      isEnd: false,
      id: -1,
    };

    console.log('Triggering mouse start callbacks:', inputEvent);
    this.callbacks.onStart.forEach(callback => callback(inputEvent));
  }

  private handleMouseMove(e: MouseEvent) {
    const touchState = this.activeTouches.get(-1);
    if (!touchState) return;

    const point = this.getCanvasPoint(e.clientX, e.clientY);
    touchState.currentPoint = point;

    const inputEvent: InputEvent = {
      type: InputType.MOUSE,
      point,
      isStart: false,
      isEnd: false,
      id: -1,
    };

    this.callbacks.onMove.forEach(callback => callback(inputEvent));
  }

  private handleMouseUp(e: MouseEvent) {
    const touchState = this.activeTouches.get(-1);
    if (!touchState) return;

    const point = this.getCanvasPoint(e.clientX, e.clientY);

    const inputEvent: InputEvent = {
      type: InputType.MOUSE,
      point,
      isStart: false,
      isEnd: true,
      id: -1,
    };

    this.callbacks.onEnd.forEach(callback => callback(inputEvent));
    this.activeTouches.delete(-1);
  }

  private handlePointerDown(e: PointerEvent) {
    const point = this.getCanvasPoint(e.clientX, e.clientY);
    point.pressure = e.pressure;

    this.activeTouches.set(e.pointerId, {
      id: e.pointerId,
      startPoint: point,
      currentPoint: point,
      lastTimestamp: point.timestamp,
    });

    const inputEvent: InputEvent = {
      type: e.pointerType === 'pen' ? InputType.PEN : InputType.TOUCH,
      point,
      isStart: true,
      isEnd: false,
      id: e.pointerId,
    };

    this.callbacks.onStart.forEach(callback => callback(inputEvent));
  }

  private handlePointerMove(e: PointerEvent) {
    const touchState = this.activeTouches.get(e.pointerId);
    if (!touchState) return;

    const point = this.getCanvasPoint(e.clientX, e.clientY);
    point.pressure = e.pressure;
    touchState.currentPoint = point;

    const inputEvent: InputEvent = {
      type: e.pointerType === 'pen' ? InputType.PEN : InputType.TOUCH,
      point,
      isStart: false,
      isEnd: false,
      id: e.pointerId,
    };

    this.callbacks.onMove.forEach(callback => callback(inputEvent));
  }

  private handlePointerUp(e: PointerEvent) {
    const touchState = this.activeTouches.get(e.pointerId);
    if (!touchState) return;

    const point = this.getCanvasPoint(e.clientX, e.clientY);
    point.pressure = e.pressure;

    const inputEvent: InputEvent = {
      type: e.pointerType === 'pen' ? InputType.PEN : InputType.TOUCH,
      point,
      isStart: false,
      isEnd: true,
      id: e.pointerId,
    };

    this.callbacks.onEnd.forEach(callback => callback(inputEvent));
    this.activeTouches.delete(e.pointerId);
  }

  onStart(callback: (event: InputEvent) => void) {
    this.callbacks.onStart.push(callback);
  }

  onMove(callback: (event: InputEvent) => void) {
    this.callbacks.onMove.push(callback);
  }

  onEnd(callback: (event: InputEvent) => void) {
    this.callbacks.onEnd.push(callback);
  }

  destroy() {
    this.activeTouches.clear();
    this.callbacks.onStart = [];
    this.callbacks.onMove = [];
    this.callbacks.onEnd = [];
  }
}

interface TouchState {
  id: number;
  startPoint: Point;
  currentPoint: Point;
  lastTimestamp: number;
}