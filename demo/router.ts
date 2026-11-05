import {
  createHashHistory,
  createMemoryHistory,
  createRouter,
  createWebHistory,
  START_LOCATION,
  type Router,
  type RouterHistory,
} from "upuaut";
import {addLog} from "./log";
import {AdminPage} from "./pages/admin";
import {DocsPage} from "./pages/docs";
import {FilesPage} from "./pages/files";
import {HomePage} from "./pages/home";
import {LoginPage} from "./pages/login";
import {NotFoundPage} from "./pages/not-found";
import {PostsPage} from "./pages/posts";
import {SearchPage} from "./pages/search";
import {UserPage} from "./pages/user";
import {UsersPage} from "./pages/users";
import {isLoggedIn, settings, type HistoryMode} from "./settings";
import {sleep} from "./util";

/**
 * Creates the history for `mode`, starting at `initial`. Web and hash history
 * read the browser URL, so the URL is rewritten first: switching from hash to
 * web must not leave "/#/users" behind.
 */
function makeHistory(mode: HistoryMode, initial: string): RouterHistory {
  if (mode === "memory") return createMemoryHistory(initial);
  const url = mode === "hash" ? `/#${initial}` : initial;
  window.history.replaceState(null, "", url);
  return mode === "hash" ? createHashHistory() : createWebHistory();
}

export function createDemoRouter(mode: HistoryMode, initial: string): Router {
  const router = createRouter({
    history: makeHistory(mode, initial),
    routes: [
      {path: "/", name: "home", component: HomePage},
      {
        path: "/users",
        name: "users",
        component: UsersPage,
        children: [{path: ":id", name: "user", component: UserPage}],
      },
      {
        path: "/about",
        name: "about",
        component: async () => {
          await sleep(settings.lazyDelay);
          return import("./pages/about");
        },
      },
      {path: "/search", name: "search", component: SearchPage},
      {path: "/posts/:slug?", name: "post", component: PostsPage},
      {path: "/files/:rest*", name: "files", component: FilesPage},
      {path: "/docs", name: "docs", component: DocsPage},
      {path: "/login", name: "login", component: LoginPage},
      {path: "/admin", name: "admin", component: AdminPage, meta: {requiresAuth: true}},
      {path: "/old-home", redirect: "/"},
      {path: "/old-user/:id", redirect: (to) => ({name: "user", params: to.params})},
      {path: "*", name: "not-found", component: NotFoundPage},
    ],
  });

  // Order matters: the slow guard runs first, so a quick second click cancels
  // the pending navigation before the other guards see it.
  router.beforeEach(async () => {
    if (settings.guardDelay > 0) await sleep(settings.guardDelay);
  });
  router.beforeEach((_to, from) => !(settings.blockNavigation && from !== START_LOCATION));
  router.beforeEach((to) =>
    settings.requireLogin && to.meta.requiresAuth && !isLoggedIn()
      ? {path: "/login", query: {redirect: to.fullPath}}
      : undefined,
  );

  router.afterEach((to, from, failure) => {
    if (failure) addLog("failure", `${failure.type}: ${from.fullPath} → ${to.fullPath}`);
    else addLog("ok", `${from === START_LOCATION ? "start" : from.fullPath} → ${to.fullPath}`);
  });
  return router;
}
