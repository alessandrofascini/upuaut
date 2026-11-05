import {Shape} from "khnum";
import type {RouteLocation, Router, UpuautRouter} from "upuaut";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function routerOf(el: Element): Router | undefined {
  return (el.closest("upuaut-router") as UpuautRouter | null)?.router;
}

/**
 * A page that re-renders when <upuaut-view> hands it a new `route`, which
 * happens when only the params, query or hash change.
 */
export function RoutedPage(tagName: string) {
  return class extends Shape(tagName) {
    #route: RouteLocation | undefined;

    get route(): RouteLocation | undefined {
      return this.#route;
    }

    set route(route: RouteLocation | undefined) {
      this.#route = route;
      if (this.isConnected) this.render();
    }
  };
}
