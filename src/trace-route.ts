import * as ping from 'net-ping';
import * as dns from 'dns';
import * as util from 'util';
import { timedLog } from './utils';

const resolveHost = util.promisify(dns.resolve);

const options = {
  networkProtocol: ping.NetworkProtocol.IPv4,
  packetSize: 16,
  retries: 0,
  sessionId: process.pid % 65535,
  timeout: 2000,
  ttl: 24,
  maxHopTimeouts: 5
};

let session = null;

function getSession() {
  if (session) {
    return session;
  }
  session = ping.createSession(options);
  session.on('close', () => {
    timedLog('Session closed');
    session = null;
  });
  session.on('error', err => {
    timedLog('Session error', err);
  });

  return session;
}

export const pingIp = host =>
  new Promise((resolve, reject) => {
    const session = getSession();
    session.pingHost(host, (err, target, sent, rcvd) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          sent: sent,
          received: rcvd,
          duration: rcvd.getTime() - sent.getTime()
        });
      }
    });
  });

export const traceIp = (host, ttl, feedCallback) =>
  new Promise((resolve, reject) => {
    const session = getSession();
    session.traceRoute(host, ttl, feedCallback, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

export async function pingHost(host) {
  const addresses = await resolveHost(host);
  console.log(addresses);
  if (!addresses.length) {
    throw new Error('No IPs found');
  }

  return await pingIp(addresses[0]);
}

export async function traceHost(host) {
  const addresses = await resolveHost(host);
  console.log(addresses);
  if (!addresses.length) {
    throw new Error('No IPs found');
  }

  const options = {
    ttl: 24,
    maxHopTimeouts: 5
  };

  await traceIp(addresses[0], options, (error, target, ttl, sent, rcvd) => {
    const ms = rcvd - sent;
    if (error) {
      if (error instanceof ping.TimeExceededError) {
        console.log(
          target + ': ' + error.source + ' (ttl=' + ttl + ' ms=' + ms + ')'
        );
      } else {
        console.log(
          target + ': ' + error.toString() + ' (ttl=' + ttl + ' ms=' + ms + ')'
        );
      }
    } else {
      console.log(target + ': ' + target + ' (ttl=' + ttl + ' ms=' + ms + ')');
    }
  });
}
