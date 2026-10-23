import { openDB, type IDBPDatabase } from 'idb';
import type { Activity, GearItem } from './types';

const DB_NAME = 'trail-archive';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('activities')) {
        const activityStore = db.createObjectStore('activities', { keyPath: 'id' });
        activityStore.createIndex('startTime', 'startTime');
        activityStore.createIndex('type', 'type');
        activityStore.createIndex('gear', 'gear');
      }
    }
  });
  
  return dbInstance;
}

export async function saveActivity(activity: Activity): Promise<void> {
  const db = await initDB();
  await db.put('activities', activity);
}

export async function saveActivities(activities: Activity[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('activities', 'readwrite');
  await Promise.all([
    ...activities.map(a => tx.store.put(a)),
    tx.done
  ]);
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  const db = await initDB();
  return db.get('activities', id);
}

export async function getAllActivities(): Promise<Activity[]> {
  const db = await initDB();
  return db.getAll('activities');
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('activities', id);
}

export async function clearAllActivities(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('activities', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function getActivitiesByDateRange(start: Date, end: Date): Promise<Activity[]> {
  const db = await initDB();
  const index = db.transaction('activities').store.index('startTime');
  const range = IDBKeyRange.bound(start, end);
  return index.getAll(range);
}

export async function dedupeActivities(newActivities: Activity[]): Promise<Activity[]> {
  const existing = await getAllActivities();
  const existingMap = new Map<string, Activity>();
  
  for (const activity of existing) {
    existingMap.set(activity.id, activity);
    
    const timeKey = `${activity.startTime.getTime()}-${Math.round(activity.distance * 1000)}`;
    existingMap.set(timeKey, activity);
  }
  
  const toImport: Activity[] = [];
  
  for (const activity of newActivities) {
    if (existingMap.has(activity.id)) {
      continue;
    }
    
    const timeKey = `${activity.startTime.getTime()}-${Math.round(activity.distance * 1000)}`;
    if (existingMap.has(timeKey)) {
      continue;
    }
    
    toImport.push(activity);
  }
  
  return toImport;
}

export async function getGearMileage(): Promise<GearItem[]> {
  const activities = await getAllActivities();
  const gearMap = new Map<string, GearItem>();
  
  for (const activity of activities) {
    if (!activity.gear) continue;
    
    const existing = gearMap.get(activity.gear) || {
      name: activity.gear,
      totalDistance: 0,
      activityCount: 0
    };
    
    existing.totalDistance += activity.distance;
    existing.activityCount++;
    gearMap.set(activity.gear, existing);
  }
  
  return Array.from(gearMap.values()).sort((a, b) => b.totalDistance - a.totalDistance);
}
