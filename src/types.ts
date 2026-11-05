import type {Vessel} from "khnum";

export type Query = Record<string, string | string[]>;
export type Params = Record<string, string>;
export type Meta = Record<string, unknown>;

export type RouteComponent = Vessel<any> | string;
export type LazyRouteComponent = () => Promise<RouteComponent | {default: RouteComponent}>;

export interface RouteRecord {
  path: string;
  name?: string;
  component?: RouteComponent | LazyRouteComponent;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocation) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Meta;
}

export interface RouteLocation {
  path: string;
  fullPath: string;
  name?: string;
  params: Params;
  query: Query;
  hash: string;
  meta: Meta;
  matched: RouteRecord[];
}

export type RouteLocationRaw =
  | string
  | {path: string; query?: Query; hash?: string}
  | {name: string; params?: Params; query?: Query; hash?: string};

export type NavigationGuardResult = void | boolean | RouteLocationRaw;

export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation,
) => NavigationGuardResult | Promise<NavigationGuardResult>;
