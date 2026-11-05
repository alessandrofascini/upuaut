import {mold, Shape} from "khnum";
import type {UpuautRouter} from "upuaut";

export class LoginPage extends Shape("demo-login") {
  override render(): void {
    const button = mold("button", "Log in");
    this.addEventListener(
      "click",
      () => {
        localStorage.setItem("upuaut-demo-auth", "1");
        const router = (this.closest("upuaut-router") as UpuautRouter).router;
        if (!router) return;
        const redirect = router.currentRoute.query.redirect;
        void router.replace(typeof redirect === "string" ? redirect : "/");
      },
      {},
      button,
    );
    this.replaceChildren(button);
  }
}
