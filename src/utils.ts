import type { Units } from './types';

export function formatDistance(km: number, units: Units): string {
  if (units === 'mi') {
    const miles = km * 0.621371;
    return miles.toFixed(2);
  }
  return km.toFixed(2);
}

export function formatPace(secondsPerKm: number | undefined, units: Units): string {
  if (!secondsPerKm || secondsPerKm <= 0) return '--';
  
  let pace = secondsPerKm;
  if (units === 'mi') {
    pace = secondsPerKm * 1.60934;
  }
  
  const minutes = Math.floor(pace / 60);
  const seconds = Math.floor(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatElevation(meters: number, units: Units): string {
  if (units === 'mi') {
    const feet = meters * 3.28084;
    return Math.round(feet).toString();
  }
  return Math.round(meters).toString();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function getUnitsLabel(units: Units): { distance: string; pace: string; elevation: string } {
  if (units === 'mi') {
    return {
      distance: 'mi',
      pace: 'min/mi',
      elevation: 'ft'
    };
  }
  return {
    distance: 'km',
    pace: 'min/km',
    elevation: 'm'
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
