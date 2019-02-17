import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MonitorComponent } from './monitor/monitor.component';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from './chart/chart.component';
import { SocketIoModule } from 'ngx-socket-io';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent, MonitorComponent, ChartComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    SocketIoModule.forRoot({
      url: environment.socketUrl
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
