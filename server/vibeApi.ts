import https from 'https';

const VIBE_API_URL = 'https://vibecode.bitrix24.com';

function getApiKey(): string {
  const key = process.env.VIBE_API_KEY || '';
  if (!key) {
    throw new Error('VIBE_API_KEY is not configured in environment variables');
  }
  return key;
}

export interface VibeApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    hint?: any;
  };
  meta?: {
    total?: number;
    hasMore?: boolean;
  };
}

let rateLimitedUntil = 0;

export function getVibeRateLimitInfo(): { isRateLimited: boolean; retryAfterMs: number; retryAfterSec: number } {
  const remaining = rateLimitedUntil - Date.now();
  if (remaining > 0) {
    return { isRateLimited: true, retryAfterMs: remaining, retryAfterSec: Math.ceil(remaining / 1000) };
  }
  return { isRateLimited: false, retryAfterMs: 0, retryAfterSec: 0 };
}

export function clearVibeRateLimit(): void {
  rateLimitedUntil = 0;
}

export async function vibeRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: any,
  customApiKey?: string,
  options?: { isOutgoingMessage?: boolean; maxRetries?: number }
): Promise<VibeApiResponse<T>> {
  const isOutgoing = Boolean(options?.isOutgoingMessage);
  const maxRetries = options?.maxRetries ?? (isOutgoing ? 3 : 0);
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;

    // Fast fail non-critical requests if currently rate limited
    const rateLimitStatus = getVibeRateLimitInfo();
    if (rateLimitStatus.isRateLimited) {
      if (isOutgoing && attempt <= maxRetries) {
        const waitTime = Math.min(Math.max(rateLimitStatus.retryAfterMs, 1000), 5000);
        console.log(`[VibeApi] Outgoing message queued. Waiting ${waitTime}ms for rate limit window...`);
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Rate limit in effect for another ${rateLimitStatus.retryAfterSec}s.`,
          },
        };
      }
    }

    const apiKey = customApiKey || getApiKey();
    const url = `${VIBE_API_URL}${path}`;

    try {
      const response = await new Promise<VibeApiResponse<T>>((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = body ? JSON.stringify(body) : null;

        const headers: Record<string, string> = {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        };

        if (postData) {
          headers['Content-Type'] = 'application/json';
          headers['Content-Length'] = Buffer.byteLength(postData).toString();
        }

        const req = https.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
          },
          (res) => {
            let rawData = '';
            res.on('data', (chunk) => (rawData += chunk));
            res.on('end', () => {
              try {
                // Handle 204 No Content or empty success response
                if (res.statusCode === 204 || (!rawData && res.statusCode && res.statusCode < 300)) {
                  return resolve({ success: true, data: null as any });
                }

                const parsed = JSON.parse(rawData);

                // Check if rate limited
                if (res.statusCode === 429 || parsed.error?.code === 'RATE_LIMITED') {
                  const msg = parsed.error?.message || parsed.message || '';
                  const match = msg.match(/(\d+)\s*(?:second|sec|s)/i);
                  const retrySec = match ? parseInt(match[1], 10) : 15;
                  rateLimitedUntil = Date.now() + retrySec * 1000 + 500;
                  console.warn(`[VibeApi] Rate limit triggered. Backing off for ${retrySec} seconds.`);
                }

                if (res.statusCode && res.statusCode >= 400 && !parsed.error) {
                  resolve({
                    success: false,
                    error: {
                      code: `HTTP_${res.statusCode}`,
                      message: parsed.message || rawData || `Request failed with status ${res.statusCode}`,
                    },
                  });
                } else {
                  resolve(parsed);
                }
              } catch {
                resolve({
                  success: false,
                  error: {
                    code: `HTTP_${res.statusCode}`,
                    message: rawData || 'Invalid JSON response from VibeCode API',
                  },
                });
              }
            });
          }
        );

        req.on('error', (err) => {
          reject(err);
        });

        if (postData) {
          req.write(postData);
        }
        req.end();
      });

      // If rate limited and we have retries left for outgoing message
      if (response.error?.code === 'RATE_LIMITED' && isOutgoing && attempt <= maxRetries) {
        const retryDelay = 2000 * attempt;
        console.log(`[VibeApi] Outgoing message encountered rate limit. Retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, retryDelay));
        continue;
      }

      return response;
    } catch (err: any) {
      if (isOutgoing && attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }

  return {
    success: false,
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: 'Failed to complete request after maximum retries.',
    },
  };
}

// -------------------------------------------------------------------------
// Bitrix24 CRM Helpers
// -------------------------------------------------------------------------

export const BITRIX_PORTAL_DOMAIN = 'bsb.bitrix24.com';

export interface BitrixDealPayload {
  title: string;
  amount?: number;
  currency?: string;
  stageId?: string;
  leadId?: number | null;
  contactId?: number | null;
  companyId?: number | null;
  comments?: string;
  assignedById?: number | null;
}

export async function crmCreateDeal(payload: BitrixDealPayload) {
  return await vibeRequest<any>('POST', '/v1/deals', {
    title: payload.title,
    amount: payload.amount ?? 0,
    currency: payload.currency || 'MNT',
    stageId: payload.stageId || 'NEW',
    ...(payload.leadId ? { leadId: payload.leadId } : {}),
    ...(payload.contactId ? { contactId: payload.contactId } : {}),
    ...(payload.companyId ? { companyId: payload.companyId } : {}),
    ...(payload.comments ? { comments: payload.comments } : {}),
    ...(payload.assignedById ? { assignedById: payload.assignedById } : {}),
  });
}

export async function crmUpdateLead(leadId: number, fields: { stageId?: string; comments?: string; title?: string }) {
  return await vibeRequest<any>('PATCH', `/v1/leads/${leadId}`, fields);
}

export async function crmUpdateDeal(dealId: number, fields: { stageId?: string; comments?: string; title?: string; amount?: number }) {
  return await vibeRequest<any>('PATCH', `/v1/deals/${dealId}`, fields);
}

export async function crmCreateLead(payload: {
  title: string;
  name?: string;
  phone?: string;
  contactId?: number | null;
  comments?: string;
  statusId?: string;
  isReturnCustomer?: boolean;
  assignedById?: number | null;
}) {
  return await vibeRequest<any>('POST', '/v1/leads', {
    title: payload.title,
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.phone ? { phone: payload.phone } : {}),
    ...(payload.contactId ? { contactId: payload.contactId } : {}),
    ...(payload.comments ? { comments: payload.comments } : {}),
    ...(payload.statusId ? { stageId: payload.statusId, statusId: payload.statusId } : {}),
    ...(payload.isReturnCustomer !== undefined ? { isReturnCustomer: payload.isReturnCustomer } : {}),
    ...(payload.assignedById ? { assignedById: payload.assignedById } : {}),
  });
}

export async function crmGetLead(leadId: number) {
  return await vibeRequest<any>('GET', `/v1/leads/${leadId}`);
}

export async function crmGetDeal(dealId: number) {
  return await vibeRequest<any>('GET', `/v1/deals/${dealId}`);
}

export async function crmGetContact(contactId: number) {
  return await vibeRequest<any>('GET', `/v1/contacts/${contactId}`);
}

export async function crmSearchContacts(query: { phone?: string; name?: string; limit?: number }) {
  let path = `/v1/contacts?limit=${query.limit || 10}`;
  if (query.phone) path += `&filter[phone]=${encodeURIComponent(query.phone)}`;
  if (query.name) path += `&filter[name]=${encodeURIComponent(query.name)}`;
  return await vibeRequest<any[]>('GET', path);
}

export async function crmCreateContact(payload: {
  name: string;
  phone?: string;
  email?: string;
  comments?: string;
  sourceId?: string;
  originId?: string;
}) {
  return await vibeRequest<any>('POST', '/v1/contacts', payload);
}

export async function crmGetLeadsByContact(contactId: number) {
  return await vibeRequest<any[]>('GET', `/v1/leads?filter[contactId]=${contactId}&limit=20`);
}

export async function crmGetDealsByContact(contactId: number) {
  return await vibeRequest<any[]>('GET', `/v1/deals?filter[contactId]=${contactId}&limit=20`);
}

export async function crmGetStatuses(entityId: 'STATUS' | 'DEAL_STAGE') {
  return await vibeRequest<any[]>('GET', `/v1/statuses?filter[entityId]=${entityId}`);
}

