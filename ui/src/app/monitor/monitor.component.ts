import { Component, OnDestroy, OnInit } from '@angular/core';
import { MonitorService } from './monitor.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-monitor',
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit, OnDestroy {
  url: string = 'https://p-stats.com';

  runningUrl: string;

  monitoring = false;

  events = [];

  displayEvents = [];

  typeFilter = null;

  timeFilter = 3600;

  filterErrors = false;

  timeFilters = [
    { time: 3600, label: '1h' },
    { time: 3600 * 2, label: '2h' },
    { time: 3600 * 4, label: '4h' },
    { time: 3600 * 12, label: '12h' },
    { time: 86400, label: '24h' },
    { time: 86400 * 2, label: '48h' }
  ];

  destroy = new Subject();

  errorDetailsActive = null;
  errorDetails = null;

  traceLayout = {
    height: 400,
    showlegend: false,
    yaxis: {
      automargin: true,
      type: 'category'
    },
    xaxis: {
      range: null
    },
    margin: {
      t: 10,
      b: 50
    }
  };

  traceData = [];
  traceStats = [];

  httpLayout = {
    height: 200,
    margin: {
      t: 10,
      b: 50
    },
    yaxis: {
      title: {
        text: 'Duration'
      },
      ticksuffix: 'ms'
    },
    xaxis: {
      range: null
    }
  };
  httpData = [];

  constructor(
    private monitorService: MonitorService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    const storedUrl = window.localStorage.getItem('url');
    if (window.localStorage.getItem('url')) {
      this.url = storedUrl;
    }

    this.route.queryParams
      .pipe(takeUntil(this.destroy))
      .subscribe(queryParams => {
        if (queryParams.url) {
          this.url = queryParams.url;
          this.startMonitor();
        }
      });
  }

  ngOnInit() {
    this.monitorService.events
      .pipe(takeUntil(this.destroy))
      .subscribe(event => {
        console.log('event', event);
        this.events.push(event);
        this.setEvents();
        if (event.type === 'trace') {
          this.updateTraceStats();
        }
        if (event.type === 'http') {
          this.updateHttpStats();
        }
        this.updateChartsLayouts();
      });
  }

  ngOnDestroy(): void {
    this.destroy.complete();
  }

  submitUrl() {
    this.router.navigate([], {
      queryParams: {
        url: this.url
      }
    });
  }

  pauseUrl() {
    this.monitorService.pause(this.url);
  }

  async startMonitor() {
    window.localStorage.setItem('url', this.url);
    if (this.runningUrl) {
      this.monitorService.stop(this.runningUrl);
    }
    this.runningUrl = this.url;

    this.events = await this.monitorService.getEvents(
      this.url,
      this.timeFilter
    );
    this.setEvents();
    this.updateChartsLayouts();
    this.updateTraceStats();
    this.updateHttpStats();
    this.monitoring = true;
  }

  setTypeFilter(type: string) {
    this.typeFilter = type;
    this.setEvents();
  }

  setTimeFilter(time: number) {
    this.timeFilter = time;
    this.startMonitor();
  }

  setErrorFilter(filterErrors: boolean) {
    this.filterErrors = filterErrors;
    this.setEvents();
  }

  setEvents() {
    const filter = rangeFilter(this.getChartRange());
    this.displayEvents = this.events
      .filter(
        e => (this.typeFilter && e.type === this.typeFilter) || !this.typeFilter
      )
      .filter(e => (this.filterErrors && e.error) || !this.filterErrors)
      .filter(filter)
      .reverse();
  }

  getDuration(e): number {
    return new Date(e.end).getTime() - new Date(e.start).getTime();
  }

  openErrorDetails(e) {
    this.errorDetailsActive = e;
    this.errorDetails = JSON.stringify(e, null, 2);
  }

  getChartRange() {
    const round = 30000;
    const start =
      Math.ceil((new Date().getTime() - this.timeFilter * 1000) / round) *
      round;
    return [
      new Date(start).toISOString(),
      new Date(start + this.timeFilter * 1000).toISOString()
    ];
  }

  updateChartsLayouts() {
    this.traceLayout.xaxis.range = this.getChartRange();
    this.httpLayout.xaxis.range = this.getChartRange();
  }

  async updateTraceStats() {
    const filter = rangeFilter(this.getChartRange());
    this.traceData = [];
    this.traceStats = [];
    for (const e of this.events.filter(e => e.type === 'trace' && filter(e))) {
      this.updateTraceStatsByEvent(e);
    }

    this.traceData.sort((a, b) => {
      return a.ttl - b.ttl;
    });
    for (const hop of this.traceStats) {
      for (const source of hop.sources) {
        source.host = await this.monitorService
          .resolveHost(source.ip)
          .catch(e => '');
      }
    }
    console.log('traceStats', this.traceStats);

    // console.log('traceData', this.traceData);
  }

  updateTraceStatsByEvent(e) {
    for (const t of e.traces) {
      const label = `${t.ttl}: ${t.source || t.error}`;
      let trace = this.traceData.find(et => et.name === label);
      let traceStats = this.traceStats.find(et => et.ttl === t.ttl);
      if (!trace) {
        trace = {
          sourceIp: t.source,
          ttl: t.ttl,
          name: label,
          mode: 'markers',
          x: [],
          y: [],
          hovertext: [],
          hoverinfo: 'x+text',
          marker: {
            size: [],
            color: t.error ? '#cb0015' : '#0087e2'
          }
        };
        this.traceData.push(trace);
      }
      if (!traceStats) {
        traceStats = {
          ttl: t.ttl,
          sources: [],
          errors: 0
        };
        this.traceStats.push(traceStats);
      }
      if (t.source && !traceStats.sources.find(s => s.ip === t.source)) {
        traceStats.sources.push({ ip: t.source, host: null });
      }
      if (!t.source) {
        traceStats.errors++;
      }

      trace.x.push(e.start);
      trace.hovertext.push(t.ms + ' ms');
      trace.y.push(label);
      trace.marker.size.push(5 + Math.log2(1 + t.ms / 2000) * 20);
    }
  }

  updateHttpStats() {
    this.httpData = [];
    const okTrace = {
      name: 'OK',
      type: 'bar',
      x: [],
      y: [],
      marker: {
        color: '#0087e2'
      }
    };
    const errorTrace = {
      name: 'Error',
      type: 'bar',
      x: [],
      y: [],
      marker: {
        color: '#cb0015'
      }
    };
    this.httpData.push(okTrace);
    this.httpData.push(errorTrace);
    const filter = rangeFilter(this.getChartRange());
    for (const e of this.events.filter(e => e.type === 'http' && filter(e))) {
      const dur = this.getDuration(e);
      if (!e.error) {
        okTrace.x.push(e.start);
        okTrace.y.push(dur);
      } else {
        errorTrace.x.push(e.start);
        errorTrace.y.push(dur);
      }
    }
  }
}

function rangeFilter(range) {
  return e => {
    return e.start > range[0] && e.end <= range[1];
  };
}
