import {mold, Shape} from "khnum";
import type {RouteLocation} from "upuaut";

export class UserPage extends Shape("demo-user") {
  #route: RouteLocation | undefined;

  get route(): RouteLocation | undefined {
    return this.#route;
  }

  set route(route: RouteLocation | undefined) {
    this.#route = route;
    if (this.isConnected) this.render();
  }

  override render(): void {
    this.replaceChildren(mold("h1", `User #${this.#route?.params.id}`));
  }
}
