export interface PhotoRecord {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: Date;
}

export interface PendingRecord {
  base64: string;
  address: string;
  timestamp: Date;
}
