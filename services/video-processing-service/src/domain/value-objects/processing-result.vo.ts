export class ProcessingResult {
  constructor(
    public readonly success: boolean,
    public readonly totalFrames: number,
    public readonly processedFrames: number,
    public readonly outputPath: string,
    public readonly outputSize: number,
    public readonly processingTime: number,
    public readonly error?: string,
  ) {}

  public isSuccessful(): boolean {
    return this.success && this.error === undefined;
  }

  public getProcessingEfficiency(): number {
    if (this.totalFrames === 0) return 0;
    return (this.processedFrames / this.totalFrames) * 100;
  }

  public getProcessingRate(): number {
    if (this.processingTime === 0) return 0;
    return this.processedFrames / (this.processingTime / 1000);
  }

  public getCompressionRatio(originalSize: number): number {
    if (originalSize === 0) return 0;
    return (1 - this.outputSize / originalSize) * 100;
  }

  public getOutputSizeInMB(): number {
    return this.outputSize / (1024 * 1024);
  }

  public getProcessingTimeInSeconds(): number {
    return this.processingTime / 1000;
  }

  public getSummary(): string {
    if (!this.success) {
      return `Processing failed: ${this.error}`;
    }

    return `Successfully processed ${this.processedFrames}/${this.totalFrames} frames in ${this.getProcessingTimeInSeconds().toFixed(2)}s`;
  }
}
