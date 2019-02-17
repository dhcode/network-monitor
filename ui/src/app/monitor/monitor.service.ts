import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  events = this.socket.fromEvent<any>('event').pipe(
    map(e => {
      if (e.responseStatus >= 400 && !e.error) {
        e.error = 'HTTP Status ' + e.responseStatus;
      }
    })
  );

  constructor(private socket: Socket) {}

  start(url: string) {
    this.socket.emit('start', { url: url }, result => {
      console.log('result', result);
    });
  }

  stop(url: string) {
    this.socket.emit('stop', { url: url }, result => {
      console.log('stop result', result);
    });
  }

  pause(url: string) {
    this.socket.emit('pause', { url: url }, result => {
      console.log('pause result', result);
    });
  }

  getEvents(url: string, time = 3600): Promise<any[]> {
    return new Promise(resolve => {
      this.socket.emit(
        'getEvents',
        {
          url: url,
          start: new Date(new Date().getTime() - time * 1000).toISOString(),
          end: new Date().toISOString()
        },
        result => {
          console.log('getEvents result', result);
          for (const e of result.events) {
            if (e.responseStatus >= 400 && !e.error) {
              e.error = 'HTTP Status ' + e.responseStatus;
            }
          }
          resolve(result.events);
        }
      );
    });
  }
}
