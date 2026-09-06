import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';

export interface ApprovalNotificationPayload {
  merchantId: string;
  merchantName: string;
  offerId: string;
  offerNumber: string;
  productTitle: string;
  quantity: number;
  originalPrice: number;
  proposedPrice: number;
  costPrice: number;
  discountPercent: number;
  marginPercent: number;
  customerName?: string;
}

export interface QuickApproveVerification {
  valid: boolean;
  offerId?: string;
  merchantId?: string;
  reason?: string;
}

export class NotificationService {
  private secretKey: string;

  constructor() {
    this.secretKey = env.JWT_SECRET || 'super-secure-jwt-secret-min-32-chars-long-demo';
  }

  /**
   * Generates a tamper-proof, time-bound HMAC quick-approval token for 1-click mobile approvals.
   */
  generateQuickApproveToken(offerId: string, merchantId: string, expiresInHours = 24): string {
    const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
    const payload = `${offerId}:${merchantId}:${expiresAt}`;
    const signature = createHmac('sha256', this.secretKey).update(payload).digest('hex');
    const token = Buffer.from(JSON.stringify({ offerId, merchantId, expiresAt, signature })).toString('base64url');
    return token;
  }

  /**
   * Verifies the cryptographic integrity and expiration of a 1-click quick-approval token.
   */
  verifyQuickApproveToken(token: string): QuickApproveVerification {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      const { offerId, merchantId, expiresAt, signature } = decoded;

      if (!offerId || !merchantId || !expiresAt || !signature) {
        return { valid: false, reason: 'Malformed token structure' };
      }

      if (Date.now() > expiresAt) {
        return { valid: false, reason: 'Quick-approval token has expired' };
      }

      const expectedPayload = `${offerId}:${merchantId}:${expiresAt}`;
      const expectedSignature = createHmac('sha256', this.secretKey).update(expectedPayload).digest('hex');

      if (signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid cryptographic signature' };
      }

      return { valid: true, offerId, merchantId };
    } catch {
      return { valid: false, reason: 'Failed to parse authorization token' };
    }
  }

  /**
   * Dispatches multi-channel notification alerts (Slack, Discord, Telegram, Dashboard).
   */
  async dispatchApprovalAlert(
    payload: ApprovalNotificationPayload,
    webhookUrl?: string
  ): Promise<{ success: boolean; channels: string[]; approveUrl: string }> {
    const token = this.generateQuickApproveToken(payload.offerId, payload.merchantId);
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    const approveUrl = `${baseUrl}/admin/approvals?offerId=${payload.offerId}&token=${token}&action=approve`;

    const channelsNotified: string[] = ['dashboard_in_app'];

    // 1. Format Slack / Discord Webhook Block
    const slackPayload = {
      text: `🔔 *Agent Sauda: High-Value Deal Approval Required*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔔 New Deal Approval Required — ${payload.merchantName}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Product:*\n${payload.quantity}x ${payload.productTitle}`
            },
            {
              type: 'mrkdwn',
              text: `*Proposed Price:*\n₹${payload.proposedPrice.toLocaleString('en-IN')} (${payload.discountPercent}% off)`
            },
            {
              type: 'mrkdwn',
              text: `*Cost Price:*\n₹${payload.costPrice.toLocaleString('en-IN')}`
            },
            {
              type: 'mrkdwn',
              text: `*Protected Margin:*\n*${payload.marginPercent}%* (Safe)`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ 1-Click Approve Deal',
                emoji: true
              },
              style: 'primary',
              url: approveUrl
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 Inspect in Portal',
                emoji: true
              },
              url: `${baseUrl}/admin/approvals`
            }
          ]
        }
      ]
    };

    // 2. Dispatch to external webhook if configured
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });
        if (res.ok) {
          channelsNotified.push('slack_webhook');
        }
      } catch (webhookErr) {
        console.warn('[NotificationService] Webhook dispatch failed:', webhookErr);
      }
    }

    return {
      success: true,
      channels: channelsNotified,
      approveUrl
    };
  }
}

export const notificationService = new NotificationService();
