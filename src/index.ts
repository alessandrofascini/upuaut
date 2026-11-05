export {createRouter, START_LOCATION} from "./router";
export type {AfterEachHook, NavigationResult, Router, RouterOptions, RouteListener} from "./router";

export {createHashHistory, createMemoryHistory, createWebHistory} from "./history";
export type {HistoryListener, RouterHistory} from "./history";

export {UpuautError, isNavigationFailure} from "./errors";
export type {NavigationFailure, NavigationFailureType} from "./errors";

export {parseQuery, stringifyQuery} from "./query";

export {UpuautRouter, NavigatedEvent} from "./components/router-element";
export {UpuautView} from "./components/view";
export {UpuautLink, DEFAULT_ACTIVE_CLASS, DEFAULT_EXACT_ACTIVE_CLASS} from "./components/link";

export type {
  LazyRouteComponent,
  Meta,
  NavigationGuard,
  NavigationGuardResult,
  Params,
  Query,
  RouteComponent,
  RouteLocation,
  RouteLocationRaw,
  RouteRecord,
} from "./types";
