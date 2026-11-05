import {mold, Shape} from "khnum";

const USERS = [
  {id: 1, name: "Ada"},
  {id: 2, name: "Grace"},
  {id: 3, name: "Linus"},
];

export class UsersPage extends Shape("demo-users") {
  override render(): void {
    const items = USERS.map((user) =>
      mold("li", mold("upuaut-link", {to: `/users/${user.id}`}, user.name)),
    );
    this.replaceChildren(
      mold("h1", "Users"),
      mold("ul", ...items),
      document.createElement("upuaut-view"),
    );
  }
}
