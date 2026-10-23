import { unzip, gunzipSync, type Unzipped } from 'fflate';
import { parseStravaCSV } from './parsers/csv-parser';
import { parseGPX, computeSplits } from './parsers/gpx-parser';
import { parseTCX } from './parsers/tcx-parser';
import { parseFIT } from './parsers/fit-parser';
import type { Activity, ImportProgress } from './types';

interface WorkerMessage {
  type: 'import-zip' | 'import-files';
  files?: File[];
  zipFile?: File;
}

interface WorkerResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: ImportProgress;
  activities?: Activity[];
  error?: string;
}

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const { type, files, zipFile } = e.data;
  
  try {
    if (type === 'import-zip' && zipFile) {
      await handleZipImport(zipFile);
    } else if (type === 'import-files' && files) {
      await handleFileImport(files);
    }
  } catch (error) {
    postProgress({ type: 'error', error: String(error) });
  }
});

async function handleZipImport(zipFile: File): Promise<void> {
  postProgress({
    type: 'progress',
    progress: { current: 0, total: 100, message: 'Reading ZIP file...' }
  });
  
  const buffer = await zipFile.arrayBuffer();
  
  postProgress({
    type: 'progress',
    progress: { current: 10, total: 100, message: 'Extracting files...' }
  });
  
  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  
  postProgress({
    type: 'progress',
    progress: { current: 20, total: 100, message: 'Parsing activities.csv...' }
  });
  
  let activities: Activity[] = [];
  
  const csvData = unzipped['activities.csv'];
  if (csvData) {
    const csvText = new TextDecoder().decode(csvData);
    activities = parseStravaCSV(csvText);
    
    postProgress({
      type: 'progress',
      progress: { current: 40, total: 100, message: `Found ${activities.length} activities in CSV` }
    });
  }
  
  const activityFiles = Object.keys(unzipped).filter(path => path.startsWith('activities/'));
  
  postProgress({
    type: 'progress',
    progress: { current: 50, total: 100, message: `Processing ${activityFiles.length} activity files...` }
  });
  
  let processed = 0;
  const activityMap = new Map(activities.map(a => [a.id, a]));
  
  for (const path of activityFiles) {
    const fileData = unzipped[path];
    const filename = path.split('/').pop() || '';
    
    let activityId = filename.match(/(\d+)\./)?.[1];
    let dataToProcess = fileData;
    
    if (filename.endsWith('.gz')) {
      try {
        dataToProcess = gunzipSync(fileData);
        activityId = filename.match(/(\d+)\./)?.[1];
      } catch (err) {
        console.error(`Failed to decompress ${filename}:`, err);
        continue;
      }
    }
    
    let parsedActivity: Activity | null = null;
    
    if (filename.includes('.gpx')) {
      const text = new TextDecoder().decode(dataToProcess);
      parsedActivity = parseGPX(text, activityId);
    } else if (filename.includes('.tcx')) {
      const text = new TextDecoder().decode(dataToProcess);
      parsedActivity = parseTCX(text, activityId);
    } else if (filename.includes('.fit')) {
      const fitBuffer = dataToProcess.buffer.slice(
        dataToProcess.byteOffset,
        dataToProcess.byteOffset + dataToProcess.byteLength
      );
      parsedActivity = await parseFIT(fitBuffer, activityId);
    }
    
    if (parsedActivity && activityId) {
      const csvActivity = activityMap.get(activityId);
      if (csvActivity) {
        csvActivity.route = parsedActivity.route;
        if (parsedActivity.route) {
          csvActivity.splits = computeSplits(parsedActivity.route);
        }
      }
    }
    
    processed++;
    if (processed % 100 === 0) {
      const progress = 50 + Math.floor((processed / activityFiles.length) * 40);
      postProgress({
        type: 'progress',
        progress: { current: progress, total: 100, message: `Processed ${processed}/${activityFiles.length} files` }
      });
    }
  }
  
  postProgress({
    type: 'progress',
    progress: { current: 90, total: 100, message: 'Finalizing import...' }
  });
  
  postProgress({
    type: 'complete',
    activities
  });
}

async function handleFileImport(files: File[]): Promise<void> {
  const activities: Activity[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    postProgress({
      type: 'progress',
      progress: { current: i, total: files.length, message: `Processing ${file.name}...` }
    });
    
    let buffer = await file.arrayBuffer();
    let data = new Uint8Array(buffer);
    
    if (file.name.endsWith('.gz')) {
      try {
        data = gunzipSync(data);
      } catch (err) {
        console.error(`Failed to decompress ${file.name}:`, err);
        continue;
      }
    }
    
    let activity: Activity | null = null;
    
    if (file.name.includes('.gpx')) {
      const text = new TextDecoder().decode(data);
      activity = parseGPX(text);
    } else if (file.name.includes('.tcx')) {
      const text = new TextDecoder().decode(data);
      activity = parseTCX(text);
    } else if (file.name.includes('.fit')) {
      const fitBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      activity = await parseFIT(fitBuffer);
    }
    
    if (activity) {
      if (activity.route) {
        activity.splits = computeSplits(activity.route);
      }
      activities.push(activity);
    }
  }
  
  postProgress({
    type: 'complete',
    activities
  });
}

function postProgress(response: WorkerResponse): void {
  self.postMessage(response);
}

export {};
