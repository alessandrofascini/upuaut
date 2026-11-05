import {mold} from "khnum";
import {RoutedPage} from "../util";

const SECTIONS = [
  [
    "matching",
    "Matching",
    "Static segments beat params, params beat optional params, and those beat splats.",
  ],
  [
    "guards",
    "Guards",
    "beforeEach, beforeEnter and afterEach. Return false to abort, a location to redirect.",
  ],
  ["history", "History", "Web, hash and memory history. Switch them live from the panel."],
  ["links", "Links", "Real anchors with active classes and aria-current."],
] as const;

export class DocsPage extends RoutedPage("demo-docs") {
  override render(): void {
    const toc = SECTIONS.map(([id, title]) =>
      mold("li", mold("upuaut-link", {to: `/docs#${id}`}, title)),
    );
    const sections = SECTIONS.map(([id, title, text]) =>
      mold("section", {id, class: "doc-section"}, mold("h2", title), mold("p", text)),
    );
    this.replaceChildren(
      mold("h1", "Docs"),
      mold("p", {class: "hint"}, "Hash links: the router keeps #section in the location."),
      mold("ul", {class: "toc"}, ...toc),
      ...sections,
    );
    // Scrolling is left to the app (no scrollBehavior in v1).
    const hash = this.route?.hash;
    if (hash) requestAnimationFrame(() => this.querySelector(hash)?.scrollIntoView());
  }
}
