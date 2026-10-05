import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { CreateReportRequest } from '../models/bipsy.models';

/** Reportar un negocio. Port de `ReportRepository` (gipsi_api). */
@Injectable({ providedIn: 'root' })
export class ReportRepository {
  private readonly api = inject(ApiService);

  create(req: CreateReportRequest): Promise<unknown> {
    return this.api.post('/reports', req);
  }
}
