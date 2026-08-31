import { prisma } from '@agent-sauda/database';
import type {
  AuditEventResponse,
  ListAuditEventsQuery,
  AuditExportQuery,
  ForensicTimelineResponse,
  ActorType
} from '@agent-sauda/domain';

export class AuditService {
  /**
   * Lists merchant audit events with filtering and pagination.
   */
  async listAuditEvents(
    merchantId: string,
    query: ListAuditEventsQuery
  ): Promise<{ eventsCount: number; events: AuditEventResponse[] }> {
    const where: any = { merchantId };

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action;
    if (query.actorType) where.actorType = query.actorType;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [count, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      })
    ]);

    return {
      eventsCount: count,
      events: events.map((e) => this.formatAuditEvent(e))
    };
  }

  /**
   * Reconstructs an end-to-end forensic timeline across subsystems.
   */
  async getForensicTimeline(
    merchantId: string,
    entityType: string,
    entityId: string
  ): Promise<ForensicTimelineResponse> {
    const relatedEntityIds: string[] = [entityId];

    if (entityType.toUpperCase() === 'ORDER') {
      const order = await prisma.order.findUnique({
        where: { id: entityId },
        include: { payments: true }
      });

      if (order && order.merchantId === merchantId) {
        if (order.offerId) relatedEntityIds.push(order.offerId);
        if (order.payments) {
          for (const p of order.payments) {
            relatedEntityIds.push(p.id);
          }
        }
      }
    } else if (entityType.toUpperCase() === 'OFFER') {
      const offer = await prisma.offer.findUnique({
        where: { id: entityId }
      });

      if (offer && offer.merchantId === merchantId) {
        const order = await prisma.order.findFirst({
          where: { offerId: offer.id },
          include: { payments: true }
        });
        if (order) {
          relatedEntityIds.push(order.id);
          for (const p of order.payments) {
            relatedEntityIds.push(p.id);
          }
        }
      }
    }

    const events = await prisma.auditEvent.findMany({
      where: {
        merchantId,
        entityId: { in: relatedEntityIds }
      },
      orderBy: { createdAt: 'asc' }
    });

    return {
      entityType,
      entityId,
      merchantId,
      totalEvents: events.length,
      timeline: events.map((e) => this.formatAuditEvent(e))
    };
  }

  /**
   * Exports compliance report in JSON or RFC 4180 CSV format.
   */
  async exportAuditReport(
    merchantId: string,
    query: AuditExportQuery
  ): Promise<{ contentType: string; filename: string; data: string }> {
    const where: any = { merchantId };
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const events = await prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 5000
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (query.format === 'csv') {
      const headers = ['ID', 'Timestamp', 'EntityType', 'EntityID', 'Action', 'ActorType', 'ActorID', 'Reason', 'Metadata'];
      const rows = events.map((e) => {
        const metaStr = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : '';
        const reasonStr = e.reason ? e.reason.replace(/"/g, '""') : '';
        return [
          e.id,
          e.createdAt.toISOString(),
          e.entityType,
          e.entityId,
          e.action,
          e.actorType,
          e.actorId || '',
          `"${reasonStr}"`,
          `"${metaStr}"`
        ].join(',');
      });

      const csvData = [headers.join(','), ...rows].join('\n');

      return {
        contentType: 'text/csv',
        filename: `audit_report_${merchantId}_${timestamp}.csv`,
        data: csvData
      };
    }

    return {
      contentType: 'application/json',
      filename: `audit_report_${merchantId}_${timestamp}.json`,
      data: JSON.stringify(
        {
          merchantId,
          exportedAt: new Date().toISOString(),
          totalEvents: events.length,
          events: events.map((e) => this.formatAuditEvent(e))
        },
        null,
        2
      )
    };
  }

  /**
   * Normalizes raw database record to domain AuditEventResponse.
   */
  private formatAuditEvent(event: any): AuditEventResponse {
    return {
      id: event.id,
      merchantId: event.merchantId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actorType: event.actorType as ActorType,
      actorId: event.actorId,
      reason: event.reason,
      metadata: event.metadata as Record<string, unknown> | null,
      createdAt: event.createdAt
    };
  }
}

export const auditService = new AuditService();
