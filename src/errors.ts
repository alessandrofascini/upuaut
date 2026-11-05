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

export class UpuautError extends KhnumError {
  constructor(functionName: string, message: string) {
    super(functionName, message);
    this.name = "UpuautError";
  }

  override toString(): string {
    return `Upuaut.${this.functionName}: ${this.message}`;
  }
}

export type NavigationFailureType = "aborted" | "cancelled" | "duplicated";

export interface NavigationFailure {
  readonly type: NavigationFailureType;
  readonly from: RouteLocation;
  readonly to: RouteLocation;
}

export function isNavigationFailure(
  value: unknown,
  type?: NavigationFailureType,
): value is NavigationFailure {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const t = (value as {type: unknown}).type;
  const known = t === "aborted" || t === "cancelled" || t === "duplicated";
  return known && (type === undefined || t === type) && "from" in value && "to" in value;
}
