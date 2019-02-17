import { LogEntry, Monitor } from './monitor';
import { Subscription } from 'rxjs';

const monitors: { [url: string]: MonitorRepo } = {};

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
    this.monitor.start();
  }

  destroy() {
    this.monitor.stop();
    this.sub.unsubscribe();
  }

  getEvents(start: Date, end: Date): LogEntry[] {
    return this.events.filter(e => e.end > start && e.end <= end);
  }
}

export function getMonitor(url: string, io: any): MonitorRepo {
  if (monitors[url]) {
    return monitors[url];
  }

  return (monitors[url] = new MonitorRepo(url, io));
}
