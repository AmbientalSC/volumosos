export interface PhotoRecord {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
}

export interface PendingRecord {
  id: string;
  base64: string;
  address: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
}
