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

export function findRouterHost(node: Node, caller: string): RouterHost {
  const host = ancestors(node).find((el) => el.localName === ROUTER_TAG);
  if (!host || !("onRouter" in host)) {
    throw new UpuautError(caller, `must be placed inside <${ROUTER_TAG}>`);
  }
  return host as RouterHost;
}

export function adoptUpgradedProperty(el: object, prop: string): void {
  if (Object.prototype.hasOwnProperty.call(el, prop)) {
    const value = (el as Record<string, unknown>)[prop];
    delete (el as Record<string, unknown>)[prop];
    (el as Record<string, unknown>)[prop] = value;
  }
}
