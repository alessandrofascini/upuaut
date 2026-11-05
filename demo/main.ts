import {createRouter, createWebHistory, UpuautRouter} from "upuaut";
import {AdminPage} from "./pages/admin";
import {HomePage} from "./pages/home";
import {LoginPage} from "./pages/login";
import {NotFoundPage} from "./pages/not-found";
import {UserPage} from "./pages/user";
import {UsersPage} from "./pages/users";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: "/", name: "home", component: HomePage},
    {
      path: "/users",
      component: UsersPage,
      children: [{path: ":id", name: "user", component: UserPage}],
    },
    {path: "/about", component: () => import("./pages/about")},
    {path: "/login", component: LoginPage},
    {path: "/admin", component: AdminPage, meta: {requiresAuth: true}},
    {path: "/old-home", redirect: "/"},
    {path: "*", component: NotFoundPage},
  ],
});

router.beforeEach((to) =>
  to.meta.requiresAuth && localStorage.getItem("upuaut-demo-auth") !== "1"
    ? {path: "/login", query: {redirect: to.fullPath}}
    : undefined,
);

UpuautRouter.fire();
(document.querySelector("upuaut-router") as UpuautRouter).router = router;
