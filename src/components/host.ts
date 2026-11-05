import {UpuautError} from "../errors";
import type {Router} from "../router";

export const ROUTER_TAG = "upuaut-router";
export const VIEW_TAG = "upuaut-view";

export interface RouterHost extends Element {
  readonly router: Router | undefined;
  onRouter(cb: (router: Router) => void): () => void;
}

const parentOf = (node: Node): Node | null =>
  node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode;

export function ancestors(node: Node): Element[] {
  const out: Element[] = [];
  for (let p = parentOf(node); p; p = parentOf(p)) {
    if (p instanceof Element) out.push(p);
  }
  return out;
}

const isUpgraded = (el: Element): el is RouterHost => "onRouter" in el;

/**
 * Calls `cb` with the router of the closest `<upuaut-router>`, now and whenever it changes.
 * Waits for the host to be upgraded when its definition comes later than `node`'s.
 * Returns a function that stops listening.
 */
export function connectRouter(
  node: Element,
  caller: string,
  cb: (router: Router) => void,
): () => void {
  const host = ancestors(node).find((el) => el.localName === ROUTER_TAG);
  if (!host) throw new UpuautError(caller, `must be placed inside <${ROUTER_TAG}>`);
  if (isUpgraded(host)) return host.onRouter(cb);

  let stop: (() => void) | undefined;
  let cancelled = false;
  customElements.whenDefined(ROUTER_TAG).then(() => {
    if (cancelled || !node.isConnected || !isUpgraded(host)) return;
    stop = host.onRouter(cb);
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

export function adoptUpgradedProperty(el: object, prop: string): void {
  if (Object.prototype.hasOwnProperty.call(el, prop)) {
    const value = (el as Record<string, unknown>)[prop];
    delete (el as Record<string, unknown>)[prop];
    (el as Record<string, unknown>)[prop] = value;
  }
}
