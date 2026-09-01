import { prisma } from '@agent-sauda/database';
import type {
  AnalyticsDateRangeQuery,
  CommercialKPIOverviewResponse,
  NegotiationAnalyticsResponse,
  ApprovalPerformanceResponse,
  TopProductPerformance,
  CompleteAnalyticsDashboardResponse
} from '@agent-sauda/domain';

export class AnalyticsService {
  /**
   * Aggregates core commercial revenue and profit KPIs.
   */
  async getCommercialKPIs(
    merchantId: string,
    query: AnalyticsDateRangeQuery
  ): Promise<CommercialKPIOverviewResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    const where: any = { merchantId };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true }
    });

    const totalOrdersCount = orders.length;
    const paidOrders = orders.filter(
      (o) => o.status === 'PAID' || o.status === 'FULFILLMENT_PENDING' || o.status === 'COMPLETED'
    );
    const paidOrdersCount = paidOrders.length;
    const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;

    let grossRevenue = 0;
    let totalCost = 0;

    for (const order of paidOrders) {
      grossRevenue += order.totalAmount;
      for (const item of order.items) {
        totalCost += (item.costPrice ?? 0) * item.quantity;
      }
    }

    const netGrossProfit = Math.max(0, grossRevenue - totalCost);
    const averageMarginPercent = grossRevenue > 0 ? (netGrossProfit / grossRevenue) * 100 : 0;
    const averageOrderValue = paidOrdersCount > 0 ? grossRevenue / paidOrdersCount : 0;

    return {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      netGrossProfit: Number(netGrossProfit.toFixed(2)),
      averageMarginPercent: Number(averageMarginPercent.toFixed(2)),
      totalOrdersCount,
      paidOrdersCount,
      completedOrdersCount,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      currency: merchant?.currency || 'INR'
    };
  }

  /**
   * Calculates AI sales agent negotiation funnel and discount depth metrics.
   */
  async getNegotiationAnalytics(
    merchantId: string,
    query: AnalyticsDateRangeQuery
  ): Promise<NegotiationAnalyticsResponse> {
    const where: any = { merchantId };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const offers = await prisma.offer.findMany({ where });

    const totalOffersProposed = offers.length;
    const acceptedOffersCount = offers.filter((o) => o.status === 'ACCEPTED').length;
    const rejectedOffersCount = offers.filter((o) => o.status === 'REJECTED').length;
    const expiredOffersCount = offers.filter((o) => o.status === 'EXPIRED').length;
    const draftApprovalsCount = offers.filter((o) => o.status === 'DRAFT').length;

    const negotiationWinRatePercent =
      totalOffersProposed > 0 ? (acceptedOffersCount / totalOffersProposed) * 100 : 0;

    let totalDiscountPercentSum = 0;
    let totalDiscountsGiven = 0;

    for (const offer of offers) {
      totalDiscountPercentSum += offer.discountPercent;
      totalDiscountsGiven += offer.discountAmount;
    }

    const averageDiscountPercent =
      totalOffersProposed > 0 ? totalDiscountPercentSum / totalOffersProposed : 0;

    return {
      totalOffersProposed,
      acceptedOffersCount,
      rejectedOffersCount,
      expiredOffersCount,
      draftApprovalsCount,
      negotiationWinRatePercent: Number(negotiationWinRatePercent.toFixed(2)),
      averageDiscountPercent: Number(averageDiscountPercent.toFixed(2)),
      totalDiscountsGiven: Number(totalDiscountsGiven.toFixed(2))
    };
  }

  /**
   * Calculates manager HITL approval turnaround times and approval rates.
   */
  async getApprovalPerformance(
    merchantId: string,
    query: AnalyticsDateRangeQuery
  ): Promise<ApprovalPerformanceResponse> {
    const where: any = { merchantId };
    if (query.startDate || query.endDate) {
      where.requestedAt = {};
      if (query.startDate) where.requestedAt.gte = new Date(query.startDate);
      if (query.endDate) where.requestedAt.lte = new Date(query.endDate);
    }

    const approvals = await prisma.approval.findMany({ where });

    const totalApprovalsRequested = approvals.length;
    const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
    const rejectedCount = approvals.filter((a) => a.status === 'REJECTED').length;
    const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
    const timedOutCount = approvals.filter(
      (a) => a.resolutionNotes?.includes('TIMED_OUT') || a.resolutionNotes?.includes('expired')
    ).length;

    const approvalRatePercent =
      totalApprovalsRequested > 0 ? (approvedCount / totalApprovalsRequested) * 100 : 0;

    // Calculate average turnaround resolution time in minutes
    const resolvedApprovals = approvals.filter((a) => a.resolvedAt !== null);
    let totalResolutionMinutes = 0;

    for (const a of resolvedApprovals) {
      if (a.resolvedAt) {
        const diffMs = new Date(a.resolvedAt).getTime() - new Date(a.requestedAt).getTime();
        totalResolutionMinutes += diffMs / (1000 * 60);
      }
    }

    const averageResolutionTimeMinutes =
      resolvedApprovals.length > 0 ? totalResolutionMinutes / resolvedApprovals.length : 0;

    return {
      totalApprovalsRequested,
      approvedCount,
      rejectedCount,
      pendingCount,
      timedOutCount,
      approvalRatePercent: Number(approvalRatePercent.toFixed(2)),
      averageResolutionTimeMinutes: Number(averageResolutionTimeMinutes.toFixed(2))
    };
  }

  /**
   * Identifies top bestselling negotiated products by volume and revenue.
   */
  async getTopProducts(
    merchantId: string,
    query: AnalyticsDateRangeQuery
  ): Promise<TopProductPerformance[]> {
    const where: any = {
      merchantId,
      status: { in: ['PAID', 'FULFILLMENT_PENDING', 'COMPLETED'] }
    };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true }
    });

    const productMap = new Map<
      string,
      { productId: string; title: string; sku?: string | null; unitsSold: number; totalRevenue: number }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId) || {
          productId: item.productId,
          title: item.title,
          sku: item.sku,
          unitsSold: 0,
          totalRevenue: 0
        };

        existing.unitsSold += item.quantity;
        existing.totalRevenue += item.total;
        productMap.set(item.productId, existing);
      }
    }

    return Array.from(productMap.values())
      .map((p) => ({
        productId: p.productId,
        title: p.title,
        sku: p.sku,
        unitsSold: p.unitsSold,
        totalRevenue: Number(p.totalRevenue.toFixed(2)),
        averageAgreedPrice: Number((p.totalRevenue / p.unitsSold).toFixed(2))
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }

  /**
   * Combines all 4 analytical dimensions into a single executive dashboard payload.
   */
  async getFullDashboard(
    merchantId: string,
    query: AnalyticsDateRangeQuery
  ): Promise<CompleteAnalyticsDashboardResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    const [commercialKPIs, negotiationAnalytics, approvalPerformance, topProducts] =
      await Promise.all([
        this.getCommercialKPIs(merchantId, query),
        this.getNegotiationAnalytics(merchantId, query),
        this.getApprovalPerformance(merchantId, query),
        this.getTopProducts(merchantId, query)
      ]);

    return {
      merchantId,
      currency: merchant?.currency || 'INR',
      period: {
        startDate: query.startDate || null,
        endDate: query.endDate || null
      },
      commercialKPIs,
      negotiationAnalytics,
      approvalPerformance,
      topProducts
    };
  }
}

export const analyticsService = new AnalyticsService();
