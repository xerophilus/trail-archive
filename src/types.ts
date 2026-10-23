export interface Activity {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number;
  duration: number;
  elevationGain: number;
  averagePace?: number;
  gear?: string;
  route?: RoutePoint[];
  splits?: Split[];
  locked: boolean;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: Date;
}

export interface Split {
  distance: number;
  duration: number;
  pace: number;
  elevationGain?: number;
}

export interface GearItem {
  name: string;
  totalDistance: number;
  activityCount: number;
}

export interface Record {
  name: string;
  value: number;
  unit: string;
  activityId: string;
  date: Date;
}

export interface FilterState {
  name?: string;
  dateStart?: Date;
  dateEnd?: Date;
  type?: string;
}

export interface License {
  key: string;
  validUntil?: Date;
  isLifetime: boolean;
}

export type Units = 'mi' | 'km';

export interface ImportProgress {
  current: number;
  total: number;
  message: string;
}
