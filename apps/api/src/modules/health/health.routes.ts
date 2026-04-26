/**
 * Health module — wiring.
 *
 * Builds the controller with its dependencies injected (so tests can
 * pass mocks) and exposes the Express router.
 */

import { Router } from "express";
import { buildHealthController, type HealthControllerDeps } from "./health.controller.js";

export function buildHealthRouter(deps: HealthControllerDeps): Router {
  const router = Router();
  const controller = buildHealthController(deps);

  router.get("/health", controller.liveness);
  router.get("/ready", controller.readiness);

  return router;
}
