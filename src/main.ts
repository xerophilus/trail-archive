import './styles.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getAllActivities, saveActivities, dedupeActivities, getGearMileage } from './db';
import { checkLicenseStatus, saveLicense, verifyLicense } from './license';
import { computeRecords, computeYearlyStats } from './records';
import { formatDistance, formatPace, formatDuration, formatElevation, formatDate, getUnitsLabel, downloadBlob } from './utils';
import type { Activity, Units, FilterState, ImportProgress } from './types';

let currentUnits: Units = 'mi';
let currentTheme: 'light' | 'dark' = 'light';
let allActivities: Activity[] = [];
let filteredActivities: Activity[] = [];
let currentFilter: FilterState = {};
let currentTab = 'activities';
let licenseValid = false;

let importWorker: Worker | null = null;

async function init() {
  loadTheme();
  setupEventListeners();
  
  const licenseStatus = await checkLicenseStatus();
  licenseValid = licenseStatus.isValid && licenseStatus.isLifetime;
  
  allActivities = await getAllActivities();
  
  if (allActivities.length > 0) {
    showArchive();
    updateLicenseDisplay();
  } else {
    showLanding();
  }
}

function loadTheme() {
  const saved = localStorage.getItem('trail-archive-theme');
  currentTheme = (saved as 'light' | 'dark') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('trail-archive-theme', currentTheme);
}

function toggleUnits() {
  currentUnits = currentUnits === 'mi' ? 'km' : 'mi';
  const btn = document.getElementById('units-toggle');
  if (btn) btn.textContent = currentUnits;
  
  if (allActivities.length > 0) {
    renderCurrentTab();
  }
}

function setupEventListeners() {
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', toggleTheme);
  
  const unitsToggle = document.getElementById('units-toggle');
  unitsToggle?.addEventListener('click', toggleUnits);
  
  const importZone = document.getElementById('import-zone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  
  importZone?.addEventListener('click', () => fileInput?.click());
  
  importZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    importZone.classList.add('dragging');
  });
  
  importZone?.addEventListener('dragleave', () => {
    importZone.classList.remove('dragging');
  });
  
  importZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    importZone.classList.remove('dragging');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  });
  
  fileInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      handleFiles(Array.from(target.files));
    }
  });
  
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });
  
  document.getElementById('save-filter')?.addEventListener('click', saveFilter);
  document.getElementById('clear-filter')?.addEventListener('click', clearFilter);
  document.getElementById('export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('export-gpx')?.addEventListener('click', exportGPX);
  document.getElementById('export-ai')?.addEventListener('click', exportAISummary);
  
  const filterInputs = ['filter-name', 'filter-date-start', 'filter-date-end', 'filter-type'];
  filterInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyFilter);
  });
}

function showLanding() {
  document.getElementById('landing')?.removeAttribute('hidden');
  document.getElementById('archive')?.setAttribute('hidden', '');
}

function showArchive() {
  document.getElementById('landing')?.setAttribute('hidden', '');
  document.getElementById('archive')?.removeAttribute('hidden');
  applyFilter();
  renderCurrentTab();
}

async function handleFiles(files: File[]) {
  const zipFile = files.find(f => f.name.endsWith('.zip'));
  
  if (zipFile) {
    await importZip(zipFile);
  } else {
    await importLooseFiles(files);
  }
}

async function importZip(zipFile: File) {
  showImportProgress();
  
  if (!importWorker) {
    importWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  
  importWorker.onmessage = async (e) => {
    const { type, progress, activities, error } = e.data;
    
    if (type === 'progress' && progress) {
      updateProgress(progress);
    } else if (type === 'complete' && activities) {
      const toImport = await dedupeActivities(activities);
      await saveActivities(toImport);
      allActivities = await getAllActivities();
      hideImportProgress();
      showArchive();
      alert(`Imported ${toImport.length} new activities (${activities.length - toImport.length} duplicates skipped)`);
    } else if (type === 'error' && error) {
      hideImportProgress();
      alert(`Import error: ${error}`);
    }
  };
  
  importWorker.postMessage({ type: 'import-zip', zipFile });
}

async function importLooseFiles(files: File[]) {
  showImportProgress();
  
  if (!importWorker) {
    importWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  
  importWorker.onmessage = async (e) => {
    const { type, progress, activities, error } = e.data;
    
    if (type === 'progress' && progress) {
      updateProgress(progress);
    } else if (type === 'complete' && activities) {
      const toImport = await dedupeActivities(activities);
      await saveActivities(toImport);
      allActivities = await getAllActivities();
      hideImportProgress();
      showArchive();
      alert(`Imported ${toImport.length} new activities`);
    } else if (type === 'error' && error) {
      hideImportProgress();
      alert(`Import error: ${error}`);
    }
  };
  
  importWorker.postMessage({ type: 'import-files', files });
}

function showImportProgress() {
  const zone = document.querySelector('.import-zone-content') as HTMLElement;
  const progress = document.getElementById('import-progress');
  if (zone) zone.style.display = 'none';
  progress?.removeAttribute('hidden');
}

function hideImportProgress() {
  const zone = document.querySelector('.import-zone-content') as HTMLElement;
  const progress = document.getElementById('import-progress');
  if (zone) zone.style.display = 'block';
  progress?.setAttribute('hidden', '');
}

function updateProgress(progress: ImportProgress) {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const percent = Math.round((progress.current / progress.total) * 100);
  if (fill) fill.style.width = `${percent}%`;
  if (text) text.textContent = progress.message;
}

function switchTab(tabName: string) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.setAttribute('hidden', '');
  });
  
  const activeContent = document.getElementById(`tab-${tabName}`);
  activeContent?.removeAttribute('hidden');
  
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (currentTab) {
    case 'activities':
      renderActivitiesTable();
      break;
    case 'heatmap':
      renderHeatmap();
      break;
    case 'records':
      renderRecords();
      break;
    case 'gear':
      renderGear();
      break;
    case 'charts':
      renderCharts();
      break;
  }
}

function applyFilter() {
  const nameInput = document.getElementById('filter-name') as HTMLInputElement;
  const dateStartInput = document.getElementById('filter-date-start') as HTMLInputElement;
  const dateEndInput = document.getElementById('filter-date-end') as HTMLInputElement;
  const typeInput = document.getElementById('filter-type') as HTMLSelectElement;
  
  currentFilter = {
    name: nameInput?.value.toLowerCase() || undefined,
    dateStart: dateStartInput?.value ? new Date(dateStartInput.value) : undefined,
    dateEnd: dateEndInput?.value ? new Date(dateEndInput.value) : undefined,
    type: typeInput?.value || undefined
  };
  
  filteredActivities = allActivities.filter(activity => {
    if (currentFilter.name && !activity.name.toLowerCase().includes(currentFilter.name)) {
      return false;
    }
    if (currentFilter.dateStart && activity.startTime < currentFilter.dateStart) {
      return false;
    }
    if (currentFilter.dateEnd && activity.startTime > currentFilter.dateEnd) {
      return false;
    }
    if (currentFilter.type && activity.type !== currentFilter.type) {
      return false;
    }
    return true;
  });
  
  renderActivitiesTable();
}

function saveFilter() {
  const name = prompt('Filter name:');
  if (name) {
    localStorage.setItem(`trail-archive-filter-${name}`, JSON.stringify(currentFilter));
    alert('Filter saved');
  }
}

function clearFilter() {
  currentFilter = {};
  (document.getElementById('filter-name') as HTMLInputElement).value = '';
  (document.getElementById('filter-date-start') as HTMLInputElement).value = '';
  (document.getElementById('filter-date-end') as HTMLInputElement).value = '';
  (document.getElementById('filter-type') as HTMLSelectElement).value = '';
  applyFilter();
}

function renderActivitiesTable() {
  const container = document.getElementById('activities-table');
  if (!container) return;
  
  const labels = getUnitsLabel(currentUnits);
  
  const sorted = [...filteredActivities].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  
  let html = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Name</th>
          <th>Type</th>
          <th>Distance (${labels.distance})</th>
          <th>Time</th>
          <th>Pace (${labels.pace})</th>
          <th>Elevation (${labels.elevation})</th>
          <th>Gear</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const activity of sorted) {
    const locked = activity.locked && !licenseValid;
    const rowClass = locked ? 'locked-row' : '';
    const onclick = locked ? '' : `onclick="window.viewActivity('${activity.id}')"`;
    
    html += `
      <tr class="${rowClass}" ${onclick} style="${locked ? '' : 'cursor: pointer;'}">
        <td class="mono">${formatDate(activity.startTime)}</td>
        <td>${activity.name}</td>
        <td>${activity.type}</td>
        <td class="mono">${formatDistance(activity.distance, currentUnits)}</td>
        <td class="mono">${formatDuration(activity.duration)}</td>
        <td class="mono">${formatPace(activity.averagePace, currentUnits)}</td>
        <td class="mono">${formatElevation(activity.elevationGain, currentUnits)}</td>
        <td>${activity.gear || '--'}</td>
      </tr>
    `;
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

(window as any).viewActivity = async (activityId: string) => {
  const activity = allActivities.find(a => a.id === activityId);
  if (!activity) return;
  
  renderActivityDetail(activity);
};

function renderActivityDetail(activity: Activity) {
  const container = document.getElementById('activity-detail');
  if (!container) return;
  
  const labels = getUnitsLabel(currentUnits);
  
  let html = `
    <h3>${activity.name}</h3>
    <p>${formatDate(activity.startTime)} • ${activity.type}</p>
    
    <div class="activity-stats">
      <div class="stat">
        <div class="stat-label">Distance</div>
        <div class="stat-value">${formatDistance(activity.distance, currentUnits)} <span class="unit">${labels.distance}</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">Duration</div>
        <div class="stat-value">${formatDuration(activity.duration)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Pace</div>
        <div class="stat-value">${formatPace(activity.averagePace, currentUnits)} <span class="unit">${labels.pace}</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">Elevation</div>
        <div class="stat-value">${formatElevation(activity.elevationGain, currentUnits)} <span class="unit">${labels.elevation}</span></div>
      </div>
    </div>
  `;
  
  if (activity.route && activity.route.length > 0) {
    html += '<div id="activity-map" class="map" style="margin-top: 1.5rem;"></div>';
  }
  
  if (activity.splits && activity.splits.length > 0) {
    html += '<h4 style="margin-top: 2rem;">Splits</h4><table><thead><tr><th>Split</th><th>Time</th><th>Pace</th></tr></thead><tbody>';
    activity.splits.forEach((split, i) => {
      html += `<tr><td class="mono">${i + 1}</td><td class="mono">${formatDuration(split.duration)}</td><td class="mono">${formatPace(split.pace, currentUnits)}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  container.innerHTML = html;
  container.removeAttribute('hidden');
  
  if (activity.route && activity.route.length > 0) {
    setTimeout(() => renderActivityMap(activity), 100);
  }
}

function renderActivityMap(activity: Activity) {
  const mapEl = document.getElementById('activity-map');
  if (!mapEl || !activity.route) return;
  
  const map = L.map(mapEl);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  const coords: [number, number][] = activity.route.map(p => [p.lat, p.lon]);
  const polyline = L.polyline(coords, { color: '#2563eb', weight: 3 }).addTo(map);
  map.fitBounds(polyline.getBounds());
}

function renderHeatmap() {
  const mapEl = document.getElementById('heatmap');
  if (!mapEl) return;
  
  mapEl.innerHTML = '';
  
  const map = L.map(mapEl).setView([37.7749, -122.4194], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  const allRoutes = allActivities.filter(a => a.route && a.route.length > 0 && (!a.locked || licenseValid));
  
  if (allRoutes.length === 0) {
    mapEl.innerHTML = '<p style="padding: 2rem; text-align: center;">No route data available</p>';
    return;
  }
  
  const bounds: [number, number][] = [];
  
  for (const activity of allRoutes) {
    if (!activity.route) continue;
    const coords: [number, number][] = activity.route.map(p => [p.lat, p.lon]);
    L.polyline(coords, { color: '#2563eb', weight: 2, opacity: 0.3 }).addTo(map);
    bounds.push(...coords);
  }
  
  if (bounds.length > 0) {
    map.fitBounds(bounds);
  }
}

function renderRecords() {
  const container = document.getElementById('records-content');
  if (!container) return;
  
  const records = computeRecords(allActivities);
  
  if (!licenseValid && records.length === 0) {
    container.innerHTML = '<p>Unlock lifetime to see records from all time.</p>';
    return;
  }
  
  let html = '<h3>All Time Records</h3><table><thead><tr><th>Record</th><th>Value</th><th>Date</th></tr></thead><tbody>';
  
  for (const record of records) {
    let valueStr = '';
    if (record.unit === 'seconds') {
      valueStr = formatDuration(record.value);
    } else if (record.unit === 'km') {
      valueStr = `${formatDistance(record.value, currentUnits)} ${getUnitsLabel(currentUnits).distance}`;
    } else {
      valueStr = `${formatElevation(record.value, currentUnits)} ${getUnitsLabel(currentUnits).elevation}`;
    }
    
    html += `<tr><td>${record.name}</td><td class="mono">${valueStr}</td><td class="mono">${formatDate(record.date)}</td></tr>`;
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function renderGear() {
  const container = document.getElementById('gear-table');
  if (!container) return;
  
  const gear = await getGearMileage();
  const labels = getUnitsLabel(currentUnits);
  const threshold = parseFloat((document.getElementById('gear-threshold') as HTMLInputElement)?.value || '400');
  
  let html = '<table><thead><tr><th>Shoe</th><th>Distance</th><th>Activities</th><th>Status</th></tr></thead><tbody>';
  
  for (const item of gear) {
    const distance = parseFloat(formatDistance(item.totalDistance, currentUnits));
    const status = distance >= threshold ? '⚠️ Retire' : '✓ OK';
    const rowClass = distance >= threshold ? 'style="color: var(--color-danger);"' : '';
    
    html += `<tr ${rowClass}><td>${item.name}</td><td class="mono">${formatDistance(item.totalDistance, currentUnits)} ${labels.distance}</td><td class="mono">${item.activityCount}</td><td>${status}</td></tr>`;
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderCharts() {
  const container = document.getElementById('charts-content');
  if (!container) return;
  
  const yearlyStats = computeYearlyStats(allActivities);
  const labels = getUnitsLabel(currentUnits);
  
  let html = '<h3>Yearly Mileage</h3><table><thead><tr><th>Year</th><th>Distance</th><th>Activities</th></tr></thead><tbody>';
  
  const years = Array.from(yearlyStats.keys()).sort((a, b) => b - a);
  for (const year of years) {
    const stats = yearlyStats.get(year)!;
    html += `<tr><td class="mono">${year}</td><td class="mono">${formatDistance(stats.distance, currentUnits)} ${labels.distance}</td><td class="mono">${stats.count}</td></tr>`;
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function updateLicenseDisplay() {
  const container = document.getElementById('license-status');
  if (!container) return;
  
  if (licenseValid) {
    container.className = 'license-status unlocked';
    container.innerHTML = '<p>✓ Lifetime license active</p>';
  } else {
    const lockedCount = allActivities.filter(a => a.locked).length;
    if (lockedCount > 0) {
      container.className = 'license-status locked';
      container.innerHTML = `
        <p>${lockedCount} activities locked (older than 12 months)</p>
        <button class="btn-primary" onclick="window.unlockLifetime()">Unlock lifetime access</button>
      `;
    } else {
      container.innerHTML = '';
    }
  }
}

(window as any).unlockLifetime = async () => {
  const key = prompt('Enter your license key:');
  if (!key) return;
  
  const status = await verifyLicense(key);
  if (status.isValid && status.isLifetime) {
    saveLicense(key);
    licenseValid = true;
    allActivities.forEach(a => a.locked = false);
    alert('License activated! All activities unlocked.');
    updateLicenseDisplay();
    renderCurrentTab();
  } else {
    alert(`License invalid: ${status.error || 'Unknown error'}`);
  }
};

function exportCSV() {
  const labels = getUnitsLabel(currentUnits);
  let csv = `Date,Name,Type,Distance (${labels.distance}),Duration,Pace (${labels.pace}),Elevation (${labels.elevation}),Gear\n`;
  
  for (const activity of filteredActivities) {
    csv += `${formatDate(activity.startTime)},"${activity.name}",${activity.type},${formatDistance(activity.distance, currentUnits)},${formatDuration(activity.duration)},${formatPace(activity.averagePace, currentUnits)},${formatElevation(activity.elevationGain, currentUnits)},${activity.gear || ''}\n`;
  }
  
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'trail-archive-export.csv');
}

function exportGPX() {
  alert('GPX export: Feature stubbed for v1');
}

function exportAISummary() {
  const labels = getUnitsLabel(currentUnits);
  const summary = {
    totalActivities: filteredActivities.length,
    totalDistance: filteredActivities.reduce((sum, a) => sum + a.distance, 0),
    totalDuration: filteredActivities.reduce((sum, a) => sum + a.duration, 0),
    totalElevation: filteredActivities.reduce((sum, a) => sum + a.elevationGain, 0),
    records: computeRecords(allActivities),
    yearlyStats: Object.fromEntries(computeYearlyStats(allActivities))
  };
  
  const markdown = `# Training Summary

**Total Activities:** ${summary.totalActivities}
**Total Distance:** ${formatDistance(summary.totalDistance, currentUnits)} ${labels.distance}
**Total Time:** ${formatDuration(summary.totalDuration)}
**Total Elevation:** ${formatElevation(summary.totalElevation, currentUnits)} ${labels.elevation}

## Records
${summary.records.map(r => `- ${r.name}: ${r.unit === 'seconds' ? formatDuration(r.value) : r.value}`).join('\n')}

## Yearly Stats
${Object.entries(summary.yearlyStats).map(([year, stats]: [string, any]) => 
  `- ${year}: ${formatDistance(stats.distance, currentUnits)} ${labels.distance} (${stats.count} activities)`
).join('\n')}
`;
  
  const blob = new Blob([markdown], { type: 'text/markdown' });
  downloadBlob(blob, 'trail-archive-summary.md');
}

init();
