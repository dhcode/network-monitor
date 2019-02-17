import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import Plotly from 'plotly.js/lib/index-basic';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class ChartComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer') chartContainer: ElementRef;

  @Input() trace: any;
  @Input() traces: any[];
  @Input() layout: any = {};

  private destroy = new Subject();

  error = null;

  private chart: any;

  constructor() {}

  ngOnInit() {}

  ngOnDestroy(): void {
    this.destroy.complete();
  }

  ngAfterViewInit(): void {
    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.trace || changes.traces) {
      this.updateChart();
    }
  }

  updateChart() {
    this.error = null;
    try {
      this.chart = Plotly.react(
        this.chartContainer.nativeElement,
        this.traces ? this.traces : [this.trace],
        this.layout,
        {}
      );
    } catch (e) {
      this.error = e.toString();
    }
  }
}
