import {mold, Shape} from "khnum";
import type {UpuautLink} from "upuaut";

const USERS = [
  {id: 1, name: "Ada"},
  {id: 2, name: "Grace"},
  {id: 3, name: "Linus"},
];

export class UsersPage extends Shape("demo-users") {
  override render(): void {
    // Named-route targets go through the `to` property (attributes are strings).
    const items = USERS.map((user) => {
      const link = mold<UpuautLink>("upuaut-link", user.name);
      link.to = {name: "user", params: {id: String(user.id)}};
      return mold("li", link);
    });
    this.replaceChildren(
      mold("h1", "Users"),
      mold("ul", ...items),
      document.createElement("upuaut-view"),
    );
  }
}
