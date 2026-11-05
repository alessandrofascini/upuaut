import {mold, Shape} from "khnum";
import {isLazyComponent, type Router} from "../router";
import type {RouteLocation, RouteRecord} from "../types";
import {ancestors, connectRouter, VIEW_TAG} from "./host";

export class UpuautView extends Shape<{name: string | null}>(VIEW_TAG, ["name"]) {
  #record: RouteRecord | undefined;
  #child: Element | undefined;

  get depth(): number {
    return ancestors(this).filter((el) => el.localName === VIEW_TAG).length;
  }

  override render(): void {
    let unsubscribe: (() => void) | undefined;
    const stopWaiting = connectRouter(this, "UpuautView", (router: Router) => {
      unsubscribe?.();
      unsubscribe = router.subscribe((to) => this.#update(to));
      this.#update(router.currentRoute);
    });
    this.beforeDisconnect(() => {
      stopWaiting();
      unsubscribe?.();
      this.#record = undefined;
      this.#child = undefined;
    });
  }

  #update(route: RouteLocation): void {
    if (!this.isConnected) return;
    const record = route.matched[this.depth];
    const component = record?.component;
    if (record === undefined || component === undefined || isLazyComponent(component)) {
      this.#record = undefined;
      this.#child = undefined;
      this.replaceChildren();
      return;
    }
    if (record !== this.#record || !this.#child) {
      let child: Element;
      if (typeof component === "string") {
        child = document.createElement(component);
      } else {
        component.fire();
        child = mold(component);
      }
      this.#record = record;
      this.#child = child;
      Object.assign(child, {route});
      this.replaceChildren(child);
      return;
    }
    Object.assign(this.#child, {route});
  }
}
