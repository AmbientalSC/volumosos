export interface PhotoRecord {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
}

export interface PendingRecord {
  base64: string;
  address: string;
  timestamp: Date;
  // Coordenadas para geocoding reverso posterior (quando houver rede)
  latitude?: number;
  longitude?: number;
}
