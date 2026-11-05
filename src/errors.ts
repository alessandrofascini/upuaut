import {KhnumError} from "khnum";
import type {RouteLocation} from "./types";

/*
 * Upuaut separates two kinds of "it did not work":
 *
 * - UpuautError is thrown for programming errors (unknown route name, missing
 *   param, redirect loop, a view outside a router). Fix the code.
 * - NavigationFailure is returned for expected outcomes (a guard said no, a
 *   newer navigation won, the target is the current page). Handle or ignore.
 */

/** Thrown for programming errors; see the note above. Formats as `Upuaut.<function>: <message>`. */
export class UpuautError extends KhnumError {
  constructor(functionName: string, message: string) {
    super(functionName, message);
    this.name = "UpuautError";
  }

  /** `Upuaut.<function>: <message>` */
  override toString(): string {
    return `Upuaut.${this.functionName}: ${this.message}`;
  }
}

/** Why a navigation did not complete: a guard returned `false`, a newer navigation won, or the target is the current location. */
export type NavigationFailureType = "aborted" | "cancelled" | "duplicated";

/** Returned (not thrown) by `push`/`replace` when a navigation does not complete. */
export interface NavigationFailure {
  /** Why it did not complete. */
  readonly type: NavigationFailureType;
  /** The location shown when the navigation started. */
  readonly from: RouteLocation;
  /** The location it tried to reach. */
  readonly to: RouteLocation;
}

/** True when `value` is a {@link NavigationFailure}, optionally of the given `type`. */
export function isNavigationFailure(
  value: unknown,
  type?: NavigationFailureType,
): value is NavigationFailure {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const t = (value as {type: unknown}).type;
  const known = t === "aborted" || t === "cancelled" || t === "duplicated";
  return known && (type === undefined || t === type) && "from" in value && "to" in value;
}
