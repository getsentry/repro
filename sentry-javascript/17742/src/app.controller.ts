import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Route A: adds some breadcrumbs, responds successfully
  @Get("route-a")
  routeA(): string {
    return this.appService.handleRouteA();
  }

  // Route B: adds different breadcrumbs, responds successfully
  @Get("route-b")
  routeB(): string {
    return this.appService.handleRouteB();
  }

  // This route triggers an error — check if breadcrumbs from route-a/route-b leak here
  @Get("trigger-error")
  triggerError(): string {
    return this.appService.triggerError();
  }
}
