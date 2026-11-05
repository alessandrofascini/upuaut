import {mold, Shape} from "khnum";

export default class AboutPage extends Shape("demo-about") {
  override render(): void {
    this.replaceChildren(mold("h1", "About (lazy loaded)"));
  }
}
