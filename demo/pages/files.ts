import {mold} from "khnum";
import {RoutedPage} from "../util";

const SAMPLES = ["src", "src/components", "src/components/view.ts", "docs/router.md"];

export class FilesPage extends RoutedPage("demo-files") {
  override render(): void {
    const rest = this.route?.params.rest ?? "";
    const parts = rest === "" ? [] : rest.split("/");
    const crumbs = [mold("upuaut-link", {to: "/files"}, "files")];
    parts.forEach((part, i) => {
      crumbs.push(mold("upuaut-link", {to: `/files/${parts.slice(0, i + 1).join("/")}`}, part));
    });
    this.replaceChildren(
      mold("h1", "Files"),
      mold("p", {class: "hint"}, "Splat param /files/:rest* matches any depth."),
      mold("nav", {class: "breadcrumb"}, ...crumbs),
      mold("p", "rest = ", mold("code", JSON.stringify(rest))),
      mold(
        "ul",
        ...SAMPLES.map((path) => mold("li", mold("upuaut-link", {to: `/files/${path}`}, path))),
      ),
    );
  }
}
