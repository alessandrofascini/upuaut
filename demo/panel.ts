import {mold, Shape} from "khnum";
import type {RouteLocation, Router, UpuautRouter} from "upuaut";
import {addLog, clearLog, onLog} from "./log";
import {
  AUTH_KEY,
  isLoggedIn,
  onSettings,
  settings,
  updateSettings,
  type DemoSettings,
  type HistoryMode,
} from "./settings";

const ROUTE_NAMES = ["home", "users", "user", "post", "files", "search", "docs", "admin", "nope"];

const card = (title: string, ...children: (Node | string)[]): HTMLElement =>
  mold("section", {class: "card"}, mold("h3", title), ...children);

const parsePairs = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(/[&,]/)
      .map((pair) => pair.trim().split("="))
      .filter(([key]) => key)
      .map(([key, value = ""]) => [key.trim(), value.trim()]),
  );

/**
 * <demo-panel>: live controls for the demo router. It must sit inside
 * <upuaut-router>; it follows router swaps through onRouter().
 */
export class DemoPanel extends Shape("demo-panel") {
  #router: Router | undefined;

  override render(): void {
    const host = this.closest("upuaut-router") as UpuautRouter;
    const inspector = mold("pre", {class: "inspector"});
    const showRoute = (route: RouteLocation): void => {
      inspector.textContent = JSON.stringify(
        {
          path: route.path,
          fullPath: route.fullPath,
          name: route.name ?? null,
          params: route.params,
          query: route.query,
          hash: route.hash,
          meta: route.meta,
          matched: route.matched.map((r) => r.name ?? r.path),
        },
        null,
        2,
      );
    };

    this.replaceChildren(
      this.#historyCard(),
      this.#guardsCard(),
      this.#navigateCard(),
      card("Current route", inspector),
      this.#logCard(),
    );

    const stop = host.onRouter((router) => {
      this.#router = router;
      showRoute(router.currentRoute);
    });
    this.addEventListener(
      "upuaut-navigated",
      (event) => showRoute((event as Event & {newVal: RouteLocation}).newVal),
      {},
      host,
    );
    this.beforeDisconnect(stop);
  }

  #run(action: (router: Router) => unknown): void {
    const router = this.#router;
    if (!router) return;
    try {
      Promise.resolve(action(router)).catch((err: unknown) => addLog("error", String(err)));
    } catch (err) {
      addLog("error", String(err));
    }
  }

  #historyCard(): HTMLElement {
    const modes: HistoryMode[] = ["web", "hash", "memory"];
    const buttons = modes.map((mode) => {
      const button = mold("button", {type: "button", "data-mode": mode}, mode);
      this.addEventListener("click", () => updateSettings({history: mode}), {}, button);
      return button;
    });
    const sync = (): void => {
      for (const button of buttons) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === settings.history));
      }
    };
    sync();
    this.beforeDisconnect(onSettings(sync));
    return card(
      "History",
      mold("div", {class: "segmented"}, ...buttons),
      mold("p", {class: "hint"}, "Memory history keeps the URL bar still."),
    );
  }

  #guardsCard(): HTMLElement {
    const toggle = (key: "requireLogin" | "blockNavigation", label: string): HTMLElement => {
      const input = mold<HTMLInputElement>("input", {type: "checkbox"});
      input.checked = settings[key];
      this.addEventListener("change", () => updateSettings({[key]: input.checked}), {}, input);
      return mold("label", {class: "toggle"}, input, label);
    };
    const slider = (key: "guardDelay" | "lazyDelay", label: string): HTMLElement => {
      const value = mold("output", `${settings[key]} ms`);
      const input = mold<HTMLInputElement>("input", {
        type: "range",
        min: "0",
        max: "2000",
        step: "250",
        value: String(settings[key]),
      });
      this.addEventListener(
        "input",
        () => {
          updateSettings({[key]: Number(input.value)} as Partial<DemoSettings>);
          value.textContent = `${input.value} ms`;
        },
        {},
        input,
      );
      return mold("label", {class: "slider"}, mold("span", label), input, value);
    };

    const authState = mold("span", {class: "badge"});
    const authButton = mold("button", {type: "button"});
    const syncAuth = (): void => {
      authState.textContent = isLoggedIn() ? "logged in" : "logged out";
      authState.dataset.kind = isLoggedIn() ? "ok" : "failure";
      authButton.textContent = isLoggedIn() ? "Log out" : "Log in";
    };
    this.addEventListener(
      "click",
      () => {
        if (isLoggedIn()) localStorage.removeItem(AUTH_KEY);
        else localStorage.setItem(AUTH_KEY, "1");
        syncAuth();
      },
      {},
      authButton,
    );
    this.addEventListener("storage", syncAuth, {}, window);
    this.addEventListener("upuaut-navigated", syncAuth, {}, this.closest("upuaut-router")!);
    syncAuth();

    return card(
      "Guards",
      toggle("requireLogin", "Require login for /admin (redirect)"),
      toggle("blockNavigation", "Block every navigation (abort)"),
      slider("guardDelay", "Slow guard — click twice to cancel"),
      slider("lazyDelay", "Lazy /about load delay"),
      mold("div", {class: "row"}, authState, authButton),
    );
  }

  #navigateCard(): HTMLElement {
    const pathInput = mold<HTMLInputElement>("input", {value: "/search?q=ro#results"});
    const preview = mold("p", {class: "hint mono"});
    const updatePreview = (): void => {
      const router = this.#router;
      if (!router) return;
      try {
        const loc = router.resolve(pathInput.value);
        preview.textContent = `href ${loc.href} · ${loc.name ?? "no name"}`;
      } catch (err) {
        preview.textContent = String(err);
      }
    };
    this.addEventListener("input", updatePreview, {}, pathInput);
    queueMicrotask(updatePreview);

    const button = (label: string, action: (router: Router) => unknown): HTMLElement => {
      const el = mold("button", {type: "button"}, label);
      this.addEventListener("click", () => this.#run(action), {}, el);
      return el;
    };

    const nameSelect = mold<HTMLSelectElement>(
      "select",
      ...ROUTE_NAMES.map((name) => mold("option", {value: name}, name)),
    );
    nameSelect.value = "user";
    const paramsInput = mold<HTMLInputElement>("input", {value: "id=2", placeholder: "id=2"});
    const queryInput = mold<HTMLInputElement>("input", {placeholder: "tab=info"});

    return card(
      "Navigate",
      mold("label", {class: "field"}, mold("span", "Path"), pathInput),
      preview,
      mold(
        "div",
        {class: "row"},
        button("push", (r) => r.push(pathInput.value)),
        button("replace", (r) => r.replace(pathInput.value)),
      ),
      mold("label", {class: "field"}, mold("span", "Name"), nameSelect),
      mold("label", {class: "field"}, mold("span", "Params"), paramsInput),
      mold("label", {class: "field"}, mold("span", "Query"), queryInput),
      mold(
        "div",
        {class: "row"},
        button("push by name", (r) =>
          r.push({
            name: nameSelect.value,
            params: parsePairs(paramsInput.value),
            query: parsePairs(queryInput.value),
          }),
        ),
      ),
      mold(
        "div",
        {class: "row"},
        button("← back", (r) => r.back()),
        button("forward →", (r) => r.forward()),
        button("go(-2)", (r) => r.go(-2)),
      ),
    );
  }

  #logCard(): HTMLElement {
    const list = mold("ol", {class: "log"});
    this.beforeDisconnect(
      onLog((entries) => {
        list.replaceChildren(
          ...entries.map((entry) =>
            mold(
              "li",
              mold("time", entry.time),
              mold("span", {class: "badge", "data-kind": entry.kind}, entry.kind),
              mold("span", entry.text),
            ),
          ),
        );
      }),
    );
    const clear = mold("button", {type: "button", class: "ghost"}, "clear");
    this.addEventListener("click", clearLog, {}, clear);
    return card("Navigation log (afterEach)", clear, list);
  }
}
