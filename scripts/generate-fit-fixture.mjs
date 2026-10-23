#!/usr/bin/env node
import { Encoder } from '@garmin/fitsdk';
import fs from 'fs';

const startTime = new Date('2026-10-19T10:00:00Z');
const baseTimestamp = Math.floor(startTime.getTime() / 1000) - 631065600;

const messages = [
  {
    recordHeader: {
      localMessageType: 0,
      messageType: 'definition'
    },
    name: 'fileId',
    fields: [
      { name: 'type', value: 4 },
      { name: 'manufacturer', value: 1 },
      { name: 'product', value: 1 },
      { name: 'timeCreated', value: baseTimestamp }
    ]
  }
];

const baseLat = 37.7749;
const baseLon = -122.4194;

for (let i = 0; i <= 180; i++) {
  const timestamp = baseTimestamp + i * 10;
  const lat = baseLat + (i * 0.0001);
  const lon = baseLon + (i * 0.00005);
  const distance = i * 27.78;
  
  messages.push({
    recordHeader: {
      localMessageType: 1,
      messageType: i === 0 ? 'definition' : 'data'
    },
    name: 'record',
    fields: [
      { name: 'timestamp', value: timestamp },
      { name: 'positionLat', value: Math.round(lat * (Math.pow(2, 31) / 180)) },
      { name: 'positionLong', value: Math.round(lon * (Math.pow(2, 31) / 180)) },
      { name: 'distance', value: distance },
      { name: 'altitude', value: 10 + Math.sin(i * 0.1) * 5 }
    ]
  });
}

messages.push({
  recordHeader: {
    localMessageType: 2,
    messageType: 'definition'
  },
  name: 'session',
  fields: [
    { name: 'timestamp', value: baseTimestamp + 1800 },
    { name: 'startTime', value: baseTimestamp },
    { name: 'totalElapsedTime', value: 1800 },
    { name: 'totalTimerTime', value: 1800 },
    { name: 'totalDistance', value: 5000 },
    { name: 'sport', value: 1 },
    { name: 'totalAscent', value: 100 }
  ]
});

const encoder = new Encoder();
const fitBytes = encoder.encodeRecords(messages);

fs.mkdirSync('src/__tests__/fixtures', { recursive: true });
fs.writeFileSync('src/__tests__/fixtures/synthetic-run.fit', Buffer.from(fitBytes));

console.log('Generated synthetic FIT file at src/__tests__/fixtures/synthetic-run.fit');
console.log(`- Distance: 5000m (5km)`);
console.log(`- Duration: 1800s (30min)`);
console.log(`- Points: 181`);
console.log(`- Start: ${startTime.toISOString()}`);
