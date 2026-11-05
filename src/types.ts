import type {Vessel} from "khnum";

/** Parsed query string. A key repeated in the URL becomes an array. */
export type Query = Record<string, string | string[]>;

/** Decoded path params, e.g. `{id: "42"}` for `/users/:id`. */
export type Params = Record<string, string>;

/** Free-form data attached to a route record, merged parent → child. */
export type Meta = Record<string, unknown>;

/**
 * What a route renders: a khnum `Vessel` (fired automatically), a custom
 * element class registered by the app, or a tag name.
 */
export type RouteComponent = Vessel<any> | CustomElementConstructor | string;

/**
 * A loader for a route component, typically `() => import("./page")`. The
 * module's `default` export is used when present. Runs at most once.
 */
export type LazyRouteComponent = () => Promise<
  | RouteComponent
  | {
      /** The component, as the default export of a module. */
      default: RouteComponent;
    }
>;

/*
 * Checklist: when you add a field to RouteRecord, also update
 * - navigate() in router.ts if the field affects navigation,
 * - the record table in docs/router.md (section 2),
 * - tests/router.test.ts.
 */
/** One entry of the route table passed to {@link createRouter}. */
export interface RouteRecord {
  /** Pattern: absolute at the top level, relative inside `children`. See the Guide. */
  path: string;
  /** Unique name for navigation by name: `router.push({name, params})`. */
  name?: string;
  /** What `<upuaut-view>` renders. Omit it to only group children. */
  component?: RouteComponent | LazyRouteComponent;
  /** Nested records, rendered by an `<upuaut-view>` inside this record's component. */
  children?: RouteRecord[];
  /** Redirect target, or a function of the matched location. Applies when this record is the leaf. */
  redirect?: RouteLocationRaw | ((to: RouteLocation) => RouteLocationRaw);
  /** Guards that run only when this record is entered (not when only its params change). */
  beforeEnter?: NavigationGuard | NavigationGuard[];
  /** Data merged into `RouteLocation.meta`. */
  meta?: Meta;
}

/** A resolved location: what the router is showing or about to show. */
export interface RouteLocation {
  /** The path only, e.g. `/users/42`. */
  path: string;
  /** Path, query and hash, e.g. `/users/42?tab=info#top`. */
  fullPath: string;
  /** Name of the matched leaf record, if it has one. */
  name?: string;
  /** Decoded path params. */
  params: Params;
  /** Parsed query string. */
  query: Query;
  /** `""` or a string starting with `#`. */
  hash: string;
  /** `meta` of every matched record, merged root → leaf. */
  meta: Meta;
  /** Matched records root → leaf; `<upuaut-view>` at depth N renders `matched[N]`. Empty when nothing matched. */
  matched: RouteRecord[];
  /** The location originally requested, when this one was reached through redirects (record or guard). */
  redirectedFrom?: RouteLocation;
}

/**
 * A navigation target: a string (`"/users/42?tab=info"`), a path object, or a
 * named route with params.
 */
export type RouteLocationRaw =
  | string
  | {
      /** Path, may include `?query` and `#hash`. */
      path: string;
      /** Merged over the query in `path`. */
      query?: Query;
      /** Overrides the hash in `path`. */
      hash?: string;
    }
  | {
      /** A route `name`. */
      name: string;
      /** Values for the route's params. */
      params?: Params;
      /** Query string values. */
      query?: Query;
      /** Hash, with or without the leading `#`. */
      hash?: string;
    };

/**
 * What a guard returns: `undefined` or `true` to continue, `false` to abort,
 * a location to redirect (replacing the history entry).
 */
export type NavigationGuardResult = void | boolean | RouteLocationRaw;

/** A navigation guard; may be async. Throwing aborts and rejects `push()`. */
export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation,
) => NavigationGuardResult | Promise<NavigationGuardResult>;
