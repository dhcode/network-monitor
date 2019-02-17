import * as Koa from 'koa';
import * as compress from 'koa-compress';
import * as serve from 'koa-static';
import * as logger from 'koa-logger';
import * as route from 'koa-route';
import * as IO from 'koa-socket-2';
import { getMonitor } from './monitor-repository';

const app = new Koa();
const io = new IO();

io.attach(app);

app.use(logger());

io.on('start', (ctx, data) => {
  console.log('start', data);
  if (data.url) {
    const url = new URL(data.url).toString();
    const mon = getMonitor(url, io);
    ctx.socket.join(url);
    ctx.acknowledge({ joined: url });
  }
});
io.on('stop', (ctx, data) => {
  if (data.url) {
    const url = new URL(data.url).toString();
    ctx.socket.leave(url);
    ctx.acknowledge({ left: url });
  }
});

io.on('getEvents', (ctx, data) => {
  console.log('getEvents', data);
  if (data.url && data.start && data.end) {
    const url = new URL(data.url).toString();
    const mon = getMonitor(url, io);
    const events = mon.getEvents(new Date(data.start), new Date(data.end));
    ctx.socket.join(url);
    ctx.acknowledge({ events: events });
  }
});

app.use(serve('ui/dist/ui'));
app.use(compress());

const port = parseInt(process.env.PORT || '3000');

app.listen(port, () => {
  console.log('listening on http://localhost:' + port);
});
