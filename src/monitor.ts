import * as util from 'util';
import * as dns from 'dns';
import * as ping from 'net-ping';
import { traceIp } from './trace-route';
import { Subject } from 'rxjs';
import * as net from 'net';
import * as tls from 'tls';
import { ConnectionOptions, PeerCertificate } from 'tls';
import * as http from 'http';
import * as https from 'https';
import { RequestOptions } from 'http';

const resolveHost = util.promisify(dns.resolve);

export interface LogEntry {
  start: Date;
  end: Date;
  error: string;
}

export interface DnsLogEntry extends LogEntry {
  type: 'dns';
  target: string;
  records: string[];
}

export interface TraceLogEntry extends LogEntry {
  type: 'trace';
  target: string;
  traces: { source?: string; error?: string; ttl: number; ms: number }[];
}

export interface HttpLogEntry extends LogEntry {
  type: 'http';
  host: string;
  protocol: string;
  url: string;
  sslConnected: Date;
  sslAuthorized: boolean;
  peerCertificate: PeerCertificate;
  path: string;
  method: string;
  socketConnected: Date;
  requestSent: Date;
  responseStatus: number;
  requestHeaders: any;
  responseStart: Date;
  responseHeaders: string[];
  responseBody: Buffer[];
  responseSize: number;
}

export class Monitor {
  private ip: string;
  url: URL;
  running = false;

  private timeouts = {
    dns: null,
    trace: null,
    http: null
  };

  public events = new Subject<LogEntry>();

  constructor(url: string, public interval = 10000) {
    this.url = new URL(url);
  }

  async start() {
    this.running = true;

    // wait for first dns check
    await this.runDnsCheck();
    await this.runTrace();
    await this.runHttp();
  }

  async testHttp() {
    const dnsResult = await this.checkDns();
    console.log('dns', dnsResult);
    return await this.checkHttp();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timeouts.dns);
    clearTimeout(this.timeouts.trace);
    clearTimeout(this.timeouts.http);
  }

  private async runDnsCheck() {
    const result = await this.checkDns();
    this.events.next(result);

    const duration = result.end.getTime() - result.start.getTime();

    this.timeouts.dns = setTimeout(
      () => this.runDnsCheck(),
      Math.max(this.interval - duration, 100)
    );
    return result;
  }

  private checkDns(): Promise<DnsLogEntry> {
    const entry: DnsLogEntry = {
      type: 'dns',
      start: new Date(),
      end: null,
      target: this.url.hostname,
      records: null,
      error: null
    };
    return resolveHost(this.url.hostname)
      .then(addresses => {
        entry.end = new Date();
        entry.records = addresses;
        this.ip = addresses[0];

        return entry;
      })
      .catch(reason => {
        entry.end = new Date();
        entry.error = reason.toString();

        return entry;
      });
  }

  private async runTrace() {
    const result = await this.checkTrace();
    this.events.next(result);

    const duration = result.end.getTime() - result.start.getTime();

    this.timeouts.trace = setTimeout(
      () => this.runTrace(),
      Math.max(this.interval - duration, 100)
    );
  }

  private checkTrace(): Promise<TraceLogEntry> {
    const entry: TraceLogEntry = {
      type: 'trace',
      start: new Date(),
      end: null,
      target: this.ip,
      traces: [],
      error: null
    };
    const options = {
      ttl: 24,
      maxHopTimeouts: 5
    };
    return traceIp(this.ip, options, (error, target, ttl, sent, rcvd) => {
      const ms = rcvd - sent;
      if (error) {
        if (error instanceof ping.TimeExceededError) {
          entry.traces.push({
            source: error.source,
            ttl: ttl,
            ms: ms
          });
        } else {
          entry.traces.push({
            error: error.toString(),
            ttl: ttl,
            ms: ms
          });
        }
      } else {
        entry.traces.push({
          source: target,
          ttl: ttl,
          ms: ms
        });
      }
    })
      .then(() => {
        entry.end = new Date();
        return entry;
      })
      .catch(reason => {
        entry.end = new Date();
        entry.error = reason.toString();

        return entry;
      });
  }

  private async runHttp() {
    const result = await this.checkHttp();
    this.events.next(result);

    const duration = result.end.getTime() - result.start.getTime();

    this.timeouts.http = setTimeout(
      () => this.runHttp(),
      Math.max(this.interval - duration, 100)
    );
  }

  private checkHttp(): Promise<HttpLogEntry> {
    const createConnection = (options: any, callback: () => void) => {
      // console.log('createConnection', options);
      if (options.protocol === 'https:') {
        const socket = tls.connect(
          {
            host: options.host,
            port: options.port,
            timeout: options.timeout,
            servername: this.url.hostname
          } as ConnectionOptions,
          callback
        );
        socket.on('connect', () => {
          entry.socketConnected = new Date();
        });
        socket.on('secureConnect', () => {
          entry.sslConnected = new Date();
          entry.sslAuthorized = socket.authorized;
          entry.peerCertificate = socket.getPeerCertificate();
        });
        return socket;
      }
      if (options.protocol === 'http:') {
        const socket = net.createConnection(
          {
            host: options.host,
            port: options.port,
            timeout: options.timeout
          },
          callback
        );
        socket.on('connect', () => {
          entry.socketConnected = new Date();
        });
        return socket;
      }
      return null;
    };

    const requestOptions = {
      protocol: this.url.protocol,
      host: this.ip,
      port: this.url.port || this.url.protocol === 'https:' ? 443 : 80,
      method: 'GET',
      path: this.url.pathname + this.url.search,
      timeout: 5000,
      createConnection: createConnection,
      setHost: false,
      headers: {
        Host: this.url.hostname
      }
    };

    const entry: HttpLogEntry = {
      type: 'http',
      start: new Date(),
      end: null,
      url: this.url.toString(),
      host: requestOptions.host + ':' + requestOptions.port,
      protocol: requestOptions.protocol,
      sslConnected: null,
      sslAuthorized: null,
      peerCertificate: null,
      path: requestOptions.path,
      method: requestOptions.method,
      socketConnected: null,
      requestSent: null,
      error: null,
      requestHeaders: null,
      responseStatus: null,
      responseStart: null,
      responseHeaders: null,
      responseBody: null,
      responseSize: null
    };

    return new Promise(resolve => {
      const req = (requestOptions.protocol === 'https:' ? https : http).request(
        (requestOptions as any) as RequestOptions,
        res => {
          // console.log('response start', res.statusCode);
          entry.responseStart = new Date();
          entry.responseStatus = res.statusCode;
          entry.responseHeaders = res.rawHeaders.reduce(
            (headers, value, index) => {
              if (index % 2 === 0) {
                headers.push(value);
              } else {
                headers[headers.length - 1] += ': ' + value;
              }
              return headers;
            },
            []
          );

          entry.responseBody = [];
          entry.responseSize = 0;

          res.on('data', chunk => {
            entry.responseBody.push(chunk);
            entry.responseSize += chunk.length;
          });
          res.on('end', () => {
            entry.end = new Date();
            resolve(entry);
          });
          res.on('error', err => {
            entry.error = err.toString();
            entry.end = new Date();
            resolve(entry);
          });
        }
      );

      entry.requestHeaders = req.getHeaders();

      req.on('error', err => {
        entry.error = err.toString();
        entry.end = new Date();
        resolve(entry);
      });

      req.end(() => {
        // console.log('request sent');
        entry.requestSent = new Date();
      });
    });
  }
}
