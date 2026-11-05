import {ChangedEvent, Shape} from "khnum";
import type {Router} from "../router";
import type {RouteLocation} from "../types";
import {adoptUpgradedProperty, ROUTER_TAG, type RouterHost} from "./host";
import {UpuautLink} from "./link";
import {UpuautView} from "./view";

/** Dispatched by <upuaut-router> after every completed navigation. */
export const NavigatedEvent = ChangedEvent<RouteLocation>("upuaut-navigated", {bubbles: true});

/**
 * <upuaut-router>: holds the Router for its subtree.
 *
 * Views and links do not import a global router: they walk up to the closest
 * <upuaut-router> and subscribe through onRouter(). That allows more than one
 * router per page (e.g. in tests or micro-frontends).
 *
 * Firing this element fires <upuaut-view> and <upuaut-link> first (they are
 * its khnum dependencies).
 */
export class UpuautRouter
  extends Shape(ROUTER_TAG, [], [UpuautView, UpuautLink])
  implements RouterHost
{
  #router: Router | undefined;
  #unsubscribe: (() => void) | undefined;
  #waiters = new Set<(router: Router) => void>();

  /** The router for this subtree. Setting it starts the router and updates every view and link inside. */
  get router(): Router | undefined {
    return this.#router;
  }

  set router(router: Router | undefined) {
    if (router === this.#router) return;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#router = router;
    if (!router) return;
    if (this.isConnected) this.#listen(router);
    for (const cb of [...this.#waiters]) cb(router);
    router.start().catch((err: unknown) => console.error(err));
  }

  /**
   * Calls `cb` with the router now (if set) and every time it is replaced.
   * Returns a function that stops the calls.
   */
  onRouter(cb: (router: Router) => void): () => void {
    this.#waiters.add(cb);
    if (this.#router) cb(this.#router);
    return () => {
      this.#waiters.delete(cb);
    };
  }

  /** @internal khnum lifecycle hook. */
  override render(): void {
    // Code may have set `router` before this element was defined; that value
    // sits in an own property that hides our setter. Re-apply it.
    adoptUpgradedProperty(this, "router");
    if (this.#router && !this.#unsubscribe) this.#listen(this.#router);
    this.beforeDisconnect(() => {
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
    });
  }

  #listen(router: Router): void {
    this.#unsubscribe = router.subscribe((to, from) => {
      this.dispatchEvent(new NavigatedEvent(to, from));
    });
  }
}
