import {mold, Shape} from "khnum";

const FEATURES: [to: string, title: string, text: string][] = [
  ["/users/1", "Nested routes", "A layout with its own <upuaut-view>; params reuse the page."],
  ["/about", "Lazy routes", "Loaded on first visit. Add a delay from the panel."],
  ["/search?q=ro", "Query", "State in ?q=…, parsed into route.query."],
  ["/posts", "Optional params", "/posts/:slug? matches the list and each post."],
  ["/files/src/components", "Splat params", "/files/:rest* captures any depth."],
  ["/docs#guards", "Hash", "Section anchors kept in route.hash."],
  ["/admin", "Guards", "Login redirect, abort, slow guard and cancellation."],
  ["/old-user/3", "Redirects", "Static and function redirects to named routes."],
];

export class HomePage extends Shape("demo-home") {
  override render(): void {
    this.replaceChildren(
      mold("h1", "Home"),
      mold(
        "p",
        {class: "lead"},
        "Upuaut is a router for web components built on khnum. Every card below opens a page "
          + "that shows one feature; the panel on the right changes how the router behaves.",
      ),
      mold(
        "div",
        {class: "features"},
        ...FEATURES.map(([to, title, text]) =>
          mold("upuaut-link", {to, class: "feature"}, mold("strong", title), mold("span", text)),
        ),
      ),
    );
  }
}
