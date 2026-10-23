import type { Activity } from '../types';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

export function parseStravaCSV(csvText: string): Activity[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const columnIndices = findColumnIndices(headers);
  
  const activities: Activity[] = [];
  let currentLine = '';
  let inMultilineField = false;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    const quoteCount = (line.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      inMultilineField = !inMultilineField;
      currentLine += line + '\n';
      if (inMultilineField) continue;
    } else if (inMultilineField) {
      currentLine += line + '\n';
      continue;
    } else {
      currentLine = line;
    }
    
    if (!currentLine.trim()) {
      currentLine = '';
      continue;
    }
    
    const fields = parseCSVLine(currentLine);
    currentLine = '';
    
    if (fields.length < columnIndices.activityDate) continue;
    
    const activity = parseActivityFromFields(fields, columnIndices);
    if (activity) {
      activities.push(activity);
    }
  }
  
  return activities;
}

interface ColumnIndices {
  activityDate: number;
  activityType: number;
  activityName: number;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTime: number;
  elevationGain: number;
  activityGear: number;
  filename: number;
  averageHeartRate: number;
  gradeAdjustedPace: number;
}

function findColumnIndices(headers: string[]): ColumnIndices {
  const indices: Partial<ColumnIndices> = {};
  
  let distanceCount = 0;
  let elapsedTimeCount = 0;
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    
    if (header === 'Activity Date') {
      indices.activityDate = i;
    } else if (header === 'Activity Type') {
      indices.activityType = i;
    } else if (header === 'Activity Name') {
      indices.activityName = i;
    } else if (header === 'Moving Time') {
      indices.movingTime = i;
    } else if (header === 'Elevation Gain') {
      indices.elevationGain = i;
    } else if (header === 'Activity Gear') {
      indices.activityGear = i;
    } else if (header === 'Filename') {
      indices.filename = i;
    } else if (header === 'Average Heart Rate') {
      indices.averageHeartRate = i;
    } else if (header === 'Grade Adjusted Pace') {
      indices.gradeAdjustedPace = i;
    } else if (header === 'Distance') {
      distanceCount++;
      if (distanceCount === 2) indices.distanceMeters = i;
    } else if (header === 'Elapsed Time') {
      elapsedTimeCount++;
      if (elapsedTimeCount === 2) indices.elapsedTimeSeconds = i;
    }
  }
  
  return indices as ColumnIndices;
}

function parseActivityFromFields(fields: string[], indices: ColumnIndices): Activity | null {
  const dateStr = fields[indices.activityDate]?.trim();
  if (!dateStr) return null;
  
  const startTime = parseStravaDate(dateStr);
  if (!startTime) return null;
  
  const filename = fields[indices.filename]?.trim() || '';
  const id = filename ? extractActivityId(filename) : `manual-${startTime.getTime()}`;
  
  const distanceMeters = parseFloat(fields[indices.distanceMeters]) || 0;
  const elapsedSeconds = parseFloat(fields[indices.elapsedTimeSeconds]) || 0;
  const movingSeconds = parseFloat(fields[indices.movingTime]) || elapsedSeconds;
  const elevationGain = parseFloat(fields[indices.elevationGain]) || 0;
  
  const distance = distanceMeters / 1000;
  const duration = movingSeconds;
  const averagePace = duration > 0 && distance > 0 ? duration / distance : undefined;
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const locked = startTime < twelveMonthsAgo;
  
  return {
    id,
    name: fields[indices.activityName]?.trim() || 'Untitled Activity',
    type: fields[indices.activityType]?.trim() || 'Unknown',
    startTime,
    distance,
    duration,
    elevationGain,
    averagePace,
    gear: fields[indices.activityGear]?.trim() || undefined,
    locked
  };
}

function parseStravaDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function extractActivityId(filename: string): string {
  const match = filename.match(/\/(\d+)\./);
  return match ? match[1] : filename;
}
