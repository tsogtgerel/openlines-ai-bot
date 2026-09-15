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
  customApiKey?: string
): Promise<VibeApiResponse<T>> {
  // Fast fail if currently rate limited to prevent compounding server penalties
  const rateLimitStatus = getVibeRateLimitInfo();
  if (rateLimitStatus.isRateLimited) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Rate limit in effect for another ${rateLimitStatus.retryAfterSec}s.`,
      },
    };
  }

  const apiKey = customApiKey || getApiKey();
  const url = `${VIBE_API_URL}${path}`;

  return new Promise((resolve, reject) => {
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
}
