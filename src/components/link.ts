import {Shape} from "khnum";
import type {Router} from "../router";
import type {RouteLocationRaw} from "../types";
import {adoptUpgradedProperty, connectRouter} from "./host";

type LinkProps = {
  /** Attribute `replace`: when present, navigate with `replace` instead of `push`. */
  replace: string | null;
  /** Attribute `target`: copied to the anchor; any value other than `_self` keeps the browser behavior. */
  target: string | null;
  /** Attribute `active-class`: class for active links; default {@link DEFAULT_ACTIVE_CLASS}. */
  activeClass: string | null;
  /** Attribute `exact-active-class`: class for exact matches; default {@link DEFAULT_EXACT_ACTIVE_CLASS}. */
  exactActiveClass: string | null;
  /** Attribute `exact`: when present, the active class too requires an exact match. */
  exact: string | null;
};

/** Default class of a link whose target is the current path or one of its parents. */
export const DEFAULT_ACTIVE_CLASS = "upuaut-link-active";
/** Default class of a link whose target is exactly the current path. */
export const DEFAULT_EXACT_ACTIVE_CLASS = "upuaut-link-exact-active";

const normalize = (path: string): string =>
  (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path).toLowerCase();

/**
 * <upuaut-link to="/path">: a real <a href> that navigates through the router.
 *
 * It renders an actual anchor (wrapping the link's children) rather than a
 * clickable element, so middle-click, "open in new tab", "copy link" and
 * crawlers keep working; only a plain left click is taken over.
 *
 * Active state, as in Vue's RouterLink and React's NavLink:
 * - active: the current path is the target or below it (/users for /users/1);
 *   with the `exact` attribute, only the target itself (React's `end`)
 * - exact active: the current path is the target; also sets aria-current
 *
 * The target comes from the `to` attribute (a string) or the `to` property
 * (any RouteLocationRaw, e.g. a named route). `to` is not a khnum attribute
 * property because those are strings only; it is observed by hand below.
 */
export class UpuautLink extends Shape<LinkProps>("upuaut-link", [
  "replace",
  "target",
  "active-class",
  "exact-active-class",
  "exact",
]) {
  /** @internal Adds `to`, which is handled by hand. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "to"];
  }

  #to: RouteLocationRaw | null = null;
  #anchor: HTMLAnchorElement | undefined;
  #router: Router | undefined;
  #classes: string[] = [];

  /**
   * The target. Set by the `to` attribute (a string) or directly with any
   * location, e.g. `link.to = {name: "user", params: {id: "42"}}`.
   */
  get to(): RouteLocationRaw | null {
    return this.#to;
  }

  /** Sets the target and updates the `href` and active classes. */
  set to(to: RouteLocationRaw | null) {
    this.#to = to;
    if (this.isConnected) this.#update();
  }

  /** @internal */
  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (name === "to") this.to = newValue;
    else super.attributeChangedCallback(name, oldValue, newValue);
  }

  /** The rendered `<a>`, available once the link is connected. */
  get anchor(): HTMLAnchorElement | undefined {
    return this.#anchor;
  }

  /** @internal khnum lifecycle hook. */
  override render(): void {
    adoptUpgradedProperty(this, "to");
    if (!this.#anchor || this.#anchor.parentNode !== this) {
      const anchor = document.createElement("a");
      // Move (not copy) the author's children into the anchor, once. On
      // reconnect the anchor is already our child and is reused.
      anchor.append(...this.childNodes);
      this.replaceChildren(anchor);
      this.#anchor = anchor;
    }
    this.addEventListener("click", (event) => this.#onClick(event as MouseEvent), {}, this.#anchor);

    let unsubscribe: (() => void) | undefined;
    const stopWaiting = connectRouter(this, "UpuautLink", (router) => {
      unsubscribe?.();
      this.#router = router;
      unsubscribe = router.subscribe(() => this.#update());
      this.#update();
    });
    this.beforeDisconnect(() => {
      stopWaiting();
      unsubscribe?.();
      this.#router = undefined;
    });
    this.#update();
  }

  /** @internal */
  renderTarget(): void {
    this.#update();
  }
  /** @internal */
  renderActiveClass(): void {
    this.#update();
  }
  /** @internal */
  renderExactActiveClass(): void {
    this.#update();
  }
  /** @internal */
  renderExact(): void {
    this.#update();
  }

  #update(): void {
    const anchor = this.#anchor;
    if (!anchor) return;
    if (this.target === null) anchor.removeAttribute("target");
    else anchor.target = this.target;

    const router = this.#router;
    anchor.classList.remove(...this.#classes);
    anchor.removeAttribute("aria-current");
    this.#classes = [];
    if (!router || this.to === null) {
      anchor.removeAttribute("href");
      return;
    }
    let target: ReturnType<Router["resolve"]>;
    try {
      target = router.resolve(this.to);
    } catch (error) {
      // An unknown name or a missing param: render a dead link, not a crash.
      anchor.removeAttribute("href");
      console.error(error);
      return;
    }
    anchor.href = target.href;

    const current = normalize(router.currentRoute.path);
    const wanted = normalize(target.path);
    const exact = current === wanted;
    const below = wanted !== "/" && current.startsWith(`${wanted}/`);
    const active = exact || (this.exact === null && below);
    if (active) this.#classes.push(this.activeClass ?? DEFAULT_ACTIVE_CLASS);
    if (exact) {
      this.#classes.push(this.exactActiveClass ?? DEFAULT_EXACT_ACTIVE_CLASS);
      anchor.setAttribute("aria-current", "page");
    }
    anchor.classList.add(...this.#classes);
  }

  /**
   * Takes over the click only when the browser would navigate in this tab.
   * Modifier keys, other buttons, a target other than "_self" or a download
   * attribute mean the user wants the browser behavior, so the event is left
   * alone.
   */
  #onClick(event: MouseEvent): void {
    const router = this.#router;
    if (!router || this.to === null) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.target !== null && this.target !== "_self") return;
    if (this.hasAttribute("download")) return;
    event.preventDefault();
    const navigate = this.replace !== null ? router.replace(this.to) : router.push(this.to);
    // Errors are already reported through router.onError (or the console).
    navigate.catch(() => undefined);
  }
}
