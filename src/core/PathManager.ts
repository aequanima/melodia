import { AudioPath, PathPoint, PathStyle, Rectangle, Point } from '../utils/types.js';

export class PathManager {
  private paths = new Map<string, AudioPath>();
  private activePaths = new Set<string>();
  private pathCounter = 0;

  constructor() {}

  startRecording(point: Point): string {
    const pathId = `path-${++this.pathCounter}`;
    
    const pathPoint: PathPoint = {
      ...point,
      timestamp: performance.now(),
    };

    const newPath: AudioPath = {
      id: pathId,
      points: [pathPoint],
      style: this.getDefaultStyle(),
      boundingBox: this.createBoundingBox(pathPoint),
      createdAt: Date.now(),
    };

    this.paths.set(pathId, newPath);
    this.activePaths.add(pathId);

    return pathId;
  }

  addPoint(pathId: string, point: Point): void {
    const path = this.paths.get(pathId);
    if (!path) return;

    const pathPoint: PathPoint = {
      ...point,
      timestamp: performance.now(),
    };

    path.points.push(pathPoint);
    this.updateBoundingBox(path, pathPoint);
  }

  endRecording(pathId: string): void {
    this.activePaths.delete(pathId);
  }

  getPath(pathId: string): AudioPath | undefined {
    return this.paths.get(pathId);
  }

  getAllPaths(): AudioPath[] {
    return Array.from(this.paths.values());
  }

  getActivePaths(): AudioPath[] {
    return Array.from(this.activePaths).map(id => this.paths.get(id)!).filter(Boolean);
  }

  deletePath(pathId: string): void {
    this.paths.delete(pathId);
    this.activePaths.delete(pathId);
  }

  clearAllPaths(): void {
    this.paths.clear();
    this.activePaths.clear();
    this.pathCounter = 0;
  }

  isRecording(pathId?: string): boolean {
    if (pathId) {
      return this.activePaths.has(pathId);
    }
    return this.activePaths.size > 0;
  }

  attachAudioData(pathId: string, audioData: ArrayBuffer): void {
    const path = this.paths.get(pathId);
    if (!path) return;

    // Calculate original speed based on path length and recording duration
    const pathLength = this.calculatePathLength(path);
    const recordingDuration = this.getRecordingDuration(path);
    const originalSpeed = pathLength / recordingDuration;

    path.audioData = {
      buffer: audioData,
      format: 'webm',
      sampleRate: 44100, // Will be updated with actual sample rate
      duration: recordingDuration / 1000, // Convert to seconds
      metadata: {
        recordedAt: path.createdAt,
        originalSpeed,
      },
    };
  }

  private getDefaultStyle(): PathStyle {
    return {
      strokeWidth: 3,
      strokeColor: '#ffffff',
      glowIntensity: 0.5,
    };
  }

  private createBoundingBox(point: PathPoint): Rectangle {
    return {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    };
  }

  private updateBoundingBox(path: AudioPath, point: PathPoint): void {
    const box = path.boundingBox;
    
    if (point.x < box.x) {
      box.width += box.x - point.x;
      box.x = point.x;
    } else if (point.x > box.x + box.width) {
      box.width = point.x - box.x;
    }

    if (point.y < box.y) {
      box.height += box.y - point.y;
      box.y = point.y;
    } else if (point.y > box.y + box.height) {
      box.height = point.y - box.y;
    }
  }

  private calculatePathLength(path: AudioPath): number {
    let length = 0;
    
    for (let i = 1; i < path.points.length; i++) {
      const prev = path.points[i - 1];
      const curr = path.points[i];
      
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    
    return length;
  }

  private getRecordingDuration(path: AudioPath): number {
    if (path.points.length < 2) return 0;
    
    const start = path.points[0].timestamp;
    const end = path.points[path.points.length - 1].timestamp;
    return end - start;
  }

  // Utility methods for path queries
  findPathAtPoint(point: Point, tolerance: number = 10): string | null {
    for (const [pathId, path] of this.paths) {
      if (this.isPointNearPath(point, path, tolerance)) {
        return pathId;
      }
    }
    return null;
  }

  findNearestPointOnPath(clickPoint: Point, pathId: string): { point: Point; progress: number } | null {
    const path = this.paths.get(pathId);
    if (!path) return null;

    let nearestPoint = path.points[0];
    let minDistance = this.distanceToPoint(clickPoint, nearestPoint);
    let nearestProgress = 0;

    // Calculate total path length for progress calculation
    const totalLength = this.calculatePathLength(path);
    let accumulatedLength = 0;

    // Check all path segments to find the closest point
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      const closestPoint = this.closestPointOnLineSegment(clickPoint, p1, p2);
      const distance = this.distanceToPoint(clickPoint, closestPoint);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = closestPoint;
        
        // Calculate progress along the path (0 to 1)
        const segmentLength = this.distanceToPoint(p1, p2);
        const pointToSegmentStart = this.distanceToPoint(p1, closestPoint);
        const progressInSegment = segmentLength > 0 ? pointToSegmentStart / segmentLength : 0;
        
        nearestProgress = totalLength > 0 ? (accumulatedLength + progressInSegment * segmentLength) / totalLength : 0;
      }
      
      // Accumulate length for next iteration
      accumulatedLength += this.distanceToPoint(p1, p2);
    }

    return { point: nearestPoint, progress: Math.max(0, Math.min(1, nearestProgress)) };
  }

  private distanceToPoint(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private closestPointOnLineSegment(point: Point, lineStart: Point, lineEnd: Point): Point {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line segment is actually a point
      return lineStart;
    }
    
    let param = dot / lenSq;

    // Clamp to line segment
    if (param < 0) param = 0;
    if (param > 1) param = 1;

    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D,
      timestamp: performance.now(),
    };
  }

  private isPointNearPath(point: Point, path: AudioPath, tolerance: number): boolean {
    // Check if point is within bounding box first (quick rejection)
    const box = path.boundingBox;
    if (point.x < box.x - tolerance || 
        point.x > box.x + box.width + tolerance ||
        point.y < box.y - tolerance || 
        point.y > box.y + box.height + tolerance) {
      return false;
    }

    // Check distance to path segments (more accurate than just points)
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      const distance = this.distanceToLineSegment(point, p1, p2);
      if (distance <= tolerance) {
        return true;
      }
    }

    // Also check distance to individual points for single-point paths
    if (path.points.length === 1) {
      const pathPoint = path.points[0];
      const dx = point.x - pathPoint.x;
      const dy = point.y - pathPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= tolerance) {
        return true;
      }
    }

    return false;
  }

  private distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line segment is actually a point
      return Math.sqrt(A * A + B * B);
    }
    
    let param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}