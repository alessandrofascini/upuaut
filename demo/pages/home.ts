import {mold, Shape} from "khnum";

export class HomePage extends Shape("demo-home") {
  override render(): void {
    this.replaceChildren(mold("h1", "Home"));
  }
}
