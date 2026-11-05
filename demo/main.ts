import {UpuautRouter, type Router} from "upuaut";
import "./style.css";
import {addLog} from "./log";
import {DemoPanel} from "./panel";
import {applyPalette} from "./palette";
import {createDemoRouter} from "./router";
import {onSettings, settings} from "./settings";

const initialLocation = (): string => {
  const {pathname, search, hash} = window.location;
  return hash.startsWith("#/") ? hash.slice(1) : `${pathname}${search}${hash}`;
};

applyPalette(settings.palette);

UpuautRouter.fire();
DemoPanel.fire();

const host = document.querySelector("upuaut-router") as UpuautRouter;
let router: Router = createDemoRouter(settings.history, initialLocation());
host.router = router;

// Swapping the router at runtime: the old one stops listening, and every
// view and link follows the new one through <upuaut-router>.
onSettings((next, changed) => {
  if (changed.includes("palette")) applyPalette(next.palette);
  if (!changed.includes("history")) return;
  const at = router.currentRoute.fullPath;
  router.stop();
  router.history.destroy();
  router = createDemoRouter(next.history, at);
  host.router = router;
  addLog("info", `history → ${next.history}`);
});
