import type { Request, Response } from 'express';
import { supabase } from '../index.js';

export class LogsController {
  /**
   * Retrieve user/tenant specific API logs with simple filters.
   * GET /api/logs
   */
  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { limit = 50, offset = 0, method, status, query } = req.query;

      let builder = supabase
        .from('api_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', user.organizationId)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (method) {
        builder = builder.eq('method', String(method).toUpperCase());
      }
      
      if (status === 'success') {
        builder = builder.lt('status_code', 400);
      } else if (status === 'error') {
        builder = builder.gte('status_code', 400);
      }

      if (query) {
        builder = builder.ilike('endpoint', `%${query}%`);
      }

      const { data, count, error } = await builder;

      if (error) throw error;

      res.json({
        logs: data || [],
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (err) {
      console.error('[logs] Error retrieving records:', err);
      res.status(500).json({ error: 'Failed to fetch log entries' });
    }
  }

  /**
   * Retrieve specific log detail.
   * GET /api/logs/:id
   */
  static async getLogById(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { id } = req.params;

      const { data, error } = await supabase
        .from('api_logs')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', user.organizationId)
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve record details' });
    }
  }
}
