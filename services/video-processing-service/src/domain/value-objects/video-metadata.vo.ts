export class VideoMetadata {
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly duration: number,
    public readonly frameRate: number,
    public readonly bitrate: number,
    public readonly codec: string,
    public readonly format: string,
  ) {}

  public getAspectRatio(): string {
    const gcd = this.calculateGCD(this.width, this.height);
    return `${this.width / gcd}:${this.height / gcd}`;
  }

  public getResolution(): string {
    return `${this.width}x${this.height}`;
  }

  public isHD(): boolean {
    return this.width >= 1280 && this.height >= 720;
  }

  public isFullHD(): boolean {
    return this.width >= 1920 && this.height >= 1080;
  }

  public is4K(): boolean {
    return this.width >= 3840 && this.height >= 2160;
  }

  private calculateGCD(a: number, b: number): number {
    return b === 0 ? a : this.calculateGCD(b, a % b);
  }

  public getSizeCategory(): string {
    if (this.is4K()) return "4K";
    if (this.isFullHD()) return "Full HD";
    if (this.isHD()) return "HD";
    return "SD";
  }
}
