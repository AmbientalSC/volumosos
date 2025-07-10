import { Timestamp } from 'firebase/firestore';

export interface PhotoRecord {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: Date;
}
