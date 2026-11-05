import {mold, Shape} from "khnum";
import {UpuautError} from "../errors";
import {isLazyComponent, type Router} from "../router";
import type {RouteLocation, RouteRecord} from "../types";
import {ancestors, connectRouter, VIEW_TAG} from "./host";

/**
 * <upuaut-view>: renders the component of the matched record at its depth.
 *
 * The depth is the number of <upuaut-view> ancestors. The top view renders
 * matched[0]; a view inside that page renders matched[1], and so on. Nested
 * routes need no configuration beyond placing views inside pages.
 *
 * The rendered element receives the current location as its `route`
 * property.
 */
export class UpuautView extends Shape<{
  /** Attribute `name`: reserved for named views (not used in v1). */
  name: string | null;
}>(VIEW_TAG, ["name"]) {
  #record: RouteRecord | undefined;
  #child: Element | undefined;

  /** Number of `<upuaut-view>` ancestors: the index in `route.matched` this view renders. */
  get depth(): number {
    return ancestors(this).filter((el) => el.localName === VIEW_TAG).length;
  }

  /** @internal khnum lifecycle hook. */
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
    // A parent view may have just removed us from the DOM during the same
    // round of subscriber calls; a detached view must do nothing.
    if (!this.isConnected) return;
    const record = route.matched[this.depth];
    const component = record?.component;
    if (record === undefined || component === undefined || isLazyComponent(component)) {
      this.#record = undefined;
      this.#child = undefined;
      this.replaceChildren();
      return;
    }
    // Same record, new params (/users/1 -> /users/2): keep the element and only
    // hand it the new route, like Vue Router does. Recreating it would lose
    // its state and force a full render.
    if (record !== this.#record || !this.#child) {
      let child: Element;
      if (typeof component === "string") {
        child = document.createElement(component);
      } else if ("fire" in component) {
        component.fire();
        child = mold(component);
      } else {
        // A plain class: the app registered it, so the registry knows its tag.
        const tag = customElements.getName(component);
        if (tag === null) {
          throw new UpuautError(
            "UpuautView",
            `${component.name || "component"} is not registered with customElements.define()`,
          );
        }
        child = document.createElement(tag);
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
