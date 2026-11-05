import {Shape} from "khnum";
import type {Router} from "../router";
import {connectRouter} from "./host";

type LinkProps = {
  to: string | null;
  replace: string | null;
  target: string | null;
  activeClass: string | null;
  exactActiveClass: string | null;
};

export const DEFAULT_ACTIVE_CLASS = "upuaut-link-active";
export const DEFAULT_EXACT_ACTIVE_CLASS = "upuaut-link-exact-active";

const normalize = (path: string): string =>
  (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path).toLowerCase();

export class UpuautLink extends Shape<LinkProps>("upuaut-link", [
  "to",
  "replace",
  "target",
  "active-class",
  "exact-active-class",
]) {
  #anchor: HTMLAnchorElement | undefined;
  #router: Router | undefined;
  #classes: string[] = [];

  get anchor(): HTMLAnchorElement | undefined {
    return this.#anchor;
  }

  override render(): void {
    if (!this.#anchor || this.#anchor.parentNode !== this) {
      const anchor = document.createElement("a");
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

  renderTo(): void {
    this.#update();
  }
  renderTarget(): void {
    this.#update();
  }
  renderActiveClass(): void {
    this.#update();
  }
  renderExactActiveClass(): void {
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
    const target = router.resolve(this.to);
    anchor.href = target.href;

    const current = normalize(router.currentRoute.path);
    const wanted = normalize(target.path);
    const exact = current === wanted;
    const active = exact || (wanted !== "/" && current.startsWith(`${wanted}/`));
    if (active) this.#classes.push(this.activeClass ?? DEFAULT_ACTIVE_CLASS);
    if (exact) {
      this.#classes.push(this.exactActiveClass ?? DEFAULT_EXACT_ACTIVE_CLASS);
      anchor.setAttribute("aria-current", "page");
    }
    anchor.classList.add(...this.#classes);
  }

  #onClick(event: MouseEvent): void {
    const router = this.#router;
    if (!router || this.to === null) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.target !== null && this.target !== "_self") return;
    if (this.hasAttribute("download")) return;
    event.preventDefault();
    const navigate = this.replace !== null ? router.replace(this.to) : router.push(this.to);
    navigate.catch((err: unknown) => console.error(err));
  }
}
