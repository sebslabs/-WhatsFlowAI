import { Router } from 'express';
import { ScrapeController } from '../controllers/scrape.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { apiRateLimit } from '../middleware/rate-limit.middleware.js';

const router = Router();

// Apply auth + rate limit parameters globally to all scraping commands
router.use(authenticate);
router.use(apiRateLimit);

router.post('/', ScrapeController.triggerScrape);
router.get('/status/:id', ScrapeController.getJobStatus);
router.get('/history', ScrapeController.getScrapeHistory);

export default router;
