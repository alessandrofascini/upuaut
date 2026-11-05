import {mold, Shape} from "khnum";
import type {UpuautRouter} from "upuaut";

export class AdminPage extends Shape("demo-admin") {
  override render(): void {
    const button = mold("button", "Log out");
    this.addEventListener(
      "click",
      () => {
        localStorage.removeItem("upuaut-demo-auth");
        const router = (this.closest("upuaut-router") as UpuautRouter).router;
        if (!router) return;
        void router.push("/");
      },
      {},
      button,
    );
    this.replaceChildren(mold("h1", "Admin"), button);
  }
}
