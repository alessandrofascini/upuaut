import {mold} from "khnum";
import {routerOf, RoutedPage} from "../util";

const WORDS = ["khnum", "upuaut", "router", "guard", "history", "redirect", "lazy", "query"];

export class SearchPage extends RoutedPage("demo-search") {
  override render(): void {
    const raw = this.route?.query.q;
    const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";
    const input = mold<HTMLInputElement>("input", {name: "q", value: q, placeholder: "Search…"});
    const form = mold("form", {class: "inline-form"}, input, mold("button", "Search"));
    this.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        void routerOf(this)?.push({path: "/search", query: input.value ? {q: input.value} : {}});
      },
      {},
      form,
    );
    const hits = WORDS.filter((word) => q !== "" && word.includes(q.toLowerCase()));
    this.replaceChildren(
      mold("h1", "Search"),
      mold("p", {class: "hint"}, "The query lives in the URL: ?q=…"),
      form,
      q === ""
        ? mold("p", "Type a word, e.g. “ro”.")
        : mold("ul", ...hits.map((hit) => mold("li", hit))),
    );
  }
}
