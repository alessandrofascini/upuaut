import {mold} from "khnum";
import {RoutedPage} from "../util";

const POSTS: Record<string, string> = {
  "hello-world": "Hello, world",
  "routing-101": "Routing 101",
  "guards-in-depth": "Guards in depth",
};

export class PostsPage extends RoutedPage("demo-posts") {
  override render(): void {
    const slug = this.route?.params.slug;
    if (slug === undefined) {
      this.replaceChildren(
        mold("h1", "Posts"),
        mold("p", {class: "hint"}, "Optional param /posts/:slug? matches with and without it."),
        mold(
          "ul",
          ...Object.entries(POSTS).map(([key, title]) =>
            mold("li", mold("upuaut-link", {to: `/posts/${key}`}, title)),
          ),
        ),
      );
      return;
    }
    this.replaceChildren(
      mold("h1", POSTS[slug] ?? "Unknown post"),
      mold("p", "slug = ", mold("code", slug)),
      mold("upuaut-link", {to: "/posts"}, "← All posts"),
    );
  }
}
