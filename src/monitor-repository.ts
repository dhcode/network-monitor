import { LogEntry, Monitor } from './monitor';
import { Subscription } from 'rxjs';
import * as v8 from 'v8';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { timedLog } from './utils';

const monitors: { [url: string]: MonitorRepo } = {};

fs.mkdir('cache', err => {});

export class MonitorRepo {
  monitor: Monitor;

  eventLimit = 10000;

  events: LogEntry[] = [];

  private sub: Subscription = null;

  constructor(url: string, io: any) {
    this.monitor = new Monitor(url, 30000);
    this.sub = this.monitor.events.subscribe(event => {
      this.events.push(event);
      // console.log('event', event);
      if (this.events.length > this.eventLimit) {
        this.events.shift();
      }
      io.to(url).emit('event', event);
    });
  }

  async start() {
    await this.loadData();
    await this.monitor.start();
    timedLog('Started monitor:', this.monitor.url.toString());
  }

  destroy() {
    this.monitor.stop();
    this.sub.unsubscribe();
  }

  getEvents(start: Date, end: Date): LogEntry[] {
    return this.events.filter(e => e.end > start && e.end <= end);
  }

  getCacheId() {
    const hash = crypto.createHash('sha256');
    hash.update(this.monitor.url.toString());
    return hash.digest('hex').slice(0, 20);
  }

  storeData() {
    fs.writeFile(
      'cache/' + this.getCacheId(),
      (v8 as any).serialize(this.events),
      err => {
        if (err) {
          timedLog('Error writing cache', err);
        } else {
          timedLog(
            'stored ' + this.monitor.url.toString() + ' ' + this.events.length
          );
        }
      }
    );
  }

  loadData() {
    return new Promise((resolve, reject) => {
      fs.readFile('cache/' + this.getCacheId(), (err, data) => {
        if (!err && data) {
          const events = (v8 as any).deserialize(data);
          timedLog('loaded events ', events.length);
          this.events = events;
        }
        resolve();
      });
    });
  }
}

export function getMonitor(url: string, io: any): MonitorRepo {
  if (monitors[url]) {
    return monitors[url];
  }
  monitors[url] = new MonitorRepo(url, io);
  monitors[url].start();
  return monitors[url];
}

export function stopMonitor(url: string) {
  const mon = monitors[url];
  if (mon) {
    mon.storeData();
    mon.destroy();
    delete monitors[url];
    timedLog('Stopped monitor', url);
  }
}

export function startMonitors(io: any) {
  fs.readFile(
    'cache/activeMonitors.json',
    { encoding: 'utf-8' },
    (err, data) => {
      if (!err && data) {
        const urls = JSON.parse(data);
        for (const url of urls) {
          getMonitor(url, io);
        }
      }
    }
  );
}

setInterval(() => {
  const urls = [];
  for (const m of Object.values(monitors)) {
    m.storeData();
    urls.push(m.monitor.url.toString());
  }

  fs.writeFile('cache/activeMonitors.json', JSON.stringify(urls), err => {});
}, 60000);
