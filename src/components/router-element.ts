import {ChangedEvent, Shape} from "khnum";
import type {Router} from "../router";
import type {RouteLocation} from "../types";
import {adoptUpgradedProperty, ROUTER_TAG, type RouterHost} from "./host";
import {UpuautLink} from "./link";
import {UpuautView} from "./view";

export const NavigatedEvent = ChangedEvent<RouteLocation>("upuaut-navigated", {bubbles: true});

export class UpuautRouter
  extends Shape(ROUTER_TAG, [], [UpuautView, UpuautLink])
  implements RouterHost
{
  #router: Router | undefined;
  #unsubscribe: (() => void) | undefined;
  #waiters = new Set<(router: Router) => void>();

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

  onRouter(cb: (router: Router) => void): () => void {
    this.#waiters.add(cb);
    if (this.#router) cb(this.#router);
    return () => {
      this.#waiters.delete(cb);
    };
  }

  override render(): void {
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
