import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All dashboard endpoints require valid JWT authentication.
// Read-only operational intelligence accessible to all authenticated roles.
router.use(authenticate);

/**
 * GET /api/dashboard/overview
 * Platform-wide aggregated metrics, breakdowns, and recent activity.
 */
router.get('/overview', (req, res, next) => {
  dashboardController.getOverview(req, res, next);
});

/**
 * GET /api/dashboard/cases/:caseId
 * Consolidated single-case investigation summary view.
 */
router.get('/cases/:caseId', (req, res, next) => {
  dashboardController.getCaseInvestigation(req, res, next);
});

/**
 * GET /api/dashboard/activity
 * Normalized chronological activity timeline with filtering and pagination.
 */
router.get('/activity', (req, res, next) => {
  dashboardController.getActivityTimeline(req, res, next);
});

/**
 * GET /api/dashboard/incidents
 * Filterable incident intelligence enriched with evidence/AI counts and latest classification.
 */
router.get('/incidents', (req, res, next) => {
  dashboardController.getIncidentIntelligence(req, res, next);
});

/**
 * GET /api/dashboard/evidence
 * Filterable evidence intelligence with latest integrity status and custody state.
 */
router.get('/evidence', (req, res, next) => {
  dashboardController.getEvidenceIntelligence(req, res, next);
});

/**
 * GET /api/dashboard/ai
 * Aggregated AI intelligence, status breakdowns, average confidence, top indicators.
 */
router.get('/ai', (req, res, next) => {
  dashboardController.getAIIntelligence(req, res, next);
});

/**
 * GET /api/dashboard/alerts
 * Platform-state investigation health alerts.
 */
router.get('/alerts', (req, res, next) => {
  dashboardController.getInvestigationAlerts(req, res, next);
});

/**
 * GET /api/dashboard/search
 * Multi-entity search across cases, incidents, and evidence.
 */
router.get('/search', (req, res, next) => {
  dashboardController.searchEntities(req, res, next);
});

export default router;
