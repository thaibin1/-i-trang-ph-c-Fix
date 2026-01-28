export interface ImageAsset {
  id: string;
  data: string; // Base64 string
  mimeType: string;
  previewUrl: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface SwapResult {
  imageUrl: string | null;
  timestamp: number;
}
