export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailTemplateParams {
  appName: string;
  title: string;
  body: string;
  type?: string;
  action?: EmailAction;
}

const typeLabels: Record<string, string> = {
  ORDER_CREATED: 'Đơn hàng',
  STORE_NEW_ORDER: 'Cửa hàng',
  ORDER_CANCELLED: 'Đơn hàng',
  ORDER_PACKED: 'Giao hàng',
  ORDER_DELIVERED: 'Giao hàng',
  OUT_FOR_DELIVERY: 'Giao hàng',
  DELIVERY_FAILED: 'Cần xử lý',
  DELIVERY_FAILED_STORE: 'Cần xử lý',
  ORDER_REASSIGNED: 'Cửa hàng',
  RETURN_REQUESTED: 'Đổi trả',
  TICKET_CREATED: 'Hỗ trợ',
  TICKET_REPLY: 'Hỗ trợ',
  RESET_PASSWORD: 'Tài khoản',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function paragraphs(body: string): string {
  return body
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`,
    )
    .join('');
}

export function emailTextFallback(params: EmailTemplateParams): string {
  const lines = [params.title, '', params.body];
  if (params.action) {
    lines.push('', `${params.action.label}: ${params.action.url}`);
  }
  lines.push('', `${params.appName}`);
  return lines.join('\n');
}

export function renderEmailTemplate(params: EmailTemplateParams): string {
  const appName = escapeHtml(params.appName);
  const title = escapeHtml(params.title);
  const badge = escapeHtml(typeLabels[params.type ?? ''] ?? 'Thông báo');
  const body = paragraphs(params.body);
  const action = params.action
    ? `
        <tr>
          <td style="padding:8px 32px 30px;">
            <a href="${escapeHtml(params.action.url)}"
              style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:10px;">
              ${escapeHtml(params.action.label)}
            </a>
          </td>
        </tr>`
    : '';

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:26px 32px;background:#0f5132;">
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#bbf7d0;font-weight:700;">${appName}</div>
                <div style="margin-top:12px;font-size:28px;line-height:1.2;color:#ffffff;font-weight:800;">${title}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <span style="display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px;">${badge}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 32px 8px;">
                ${body}
              </td>
            </tr>
            ${action}
            <tr>
              <td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                  Đây là email tự động từ ${appName}. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ bộ phận hỗ trợ.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
