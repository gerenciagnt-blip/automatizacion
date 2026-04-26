/**
 * Async-local request context.
 *
 * Carries the trace-id (and later, the authenticated tenant / user) across
 * the entire async chain of a single HTTP request without prop-drilling.
 *
 * Implemented with Node's `AsyncLocalStorage` (built-in since Node 16).
 *
 * USAGE:
 *   import { traceContext, getTraceId } from "./trace-context.js";
 *
 *   traceContext.run({ traceId: "abc" }, () => {
 *     // any async work below sees getTraceId() === "abc"
 *   });
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  /** Correlates logs, metrics, and downstream calls across services. */
  traceId: string;
  /** Set by the auth middleware once the JWT has been validated. */
  tenantId?: string;
  /** Set by the auth middleware once the JWT has been validated. */
  userId?: string;
}

/** The single async-local storage used by the API process. */
export const traceContext = new AsyncLocalStorage<RequestContext>();

/** Returns the active trace-id, or `undefined` if called outside a request. */
export function getTraceId(): string | undefined {
  return traceContext.getStore()?.traceId;
}

/** Returns the active tenant-id, or `undefined` if not yet authenticated. */
export function getTenantId(): string | undefined {
  return traceContext.getStore()?.tenantId;
}

/** Returns the active user-id, or `undefined` if not yet authenticated. */
export function getUserId(): string | undefined {
  return traceContext.getStore()?.userId;
}

/**
 * Mutates the *current* request context (for use by auth middleware once it
 * has resolved tenantId / userId from the JWT). No-op outside a request.
 */
export function setAuthContext(data: { tenantId: string; userId: string }): void {
  const store = traceContext.getStore();
  if (store) {
    store.tenantId = data.tenantId;
    store.userId = data.userId;
  }
}
