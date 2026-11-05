import {mold, Shape} from "khnum";
import type {RouteLocation} from "upuaut";

export class NotFoundPage extends Shape("demo-not-found") {
  #route: RouteLocation | undefined;

  get route(): RouteLocation | undefined {
    return this.#route;
  }

  set route(route: RouteLocation | undefined) {
    this.#route = route;
    if (this.isConnected) this.render();
  }

  override render(): void {
    this.replaceChildren(
      mold("h1", "404"),
      mold("p", `No page at ${this.#route?.path ?? "this address"}.`),
    );
  }
}
