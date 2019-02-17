import { pingHost, traceHost } from './src/trace-route';
import { Monitor } from './src/monitor';

const command = process.argv[2];
const commands: any = {};
commands.ping = function(host) {
  return pingHost(host);
};

commands.trace = function(host) {
  return traceHost(host);
};

commands.monitor = function(url) {
  const monitor = new Monitor(url);
  monitor.events.subscribe(entry => {
    console.log('event', entry);
  });

  monitor.start();
};

commands.testUrl = function(url) {
  return new URL(url);
};

commands.testHttp = function(url) {
  const monitor = new Monitor(url);
  return monitor.testHttp();
};

if (commands[command]) {
  const ret = commands[command](...process.argv.slice(3));
  if (ret instanceof Promise) {
    ret
      .then(result => {
        console.log(result);
      })
      .catch(err => {
        console.error(err);
      });
  } else {
    console.log(ret);
  }
} else {
  console.log('Choose command: \n  ' + Object.keys(commands).join('\n  '));
}
