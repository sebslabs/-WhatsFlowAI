import https from 'https';

export class EmailService {
  private static NOTIFICATION_EMAIL = 'hello@sebslabs.com';

  static async sendTicketAlert(ticket: { 
    title: string; 
    description?: string; 
    priority?: string; 
    id: string;
  }, userEmail?: string) {
    
    console.log(`[EmailService] DISPATCHING EMAIL ALERT FOR TICKET ${ticket.id} TO ${this.NOTIFICATION_EMAIL}`);

    // Standard Transactional Email JSON Payload
    const payload = JSON.stringify({
      to: this.NOTIFICATION_EMAIL,
      subject: `[WhatsFlow Alert] New Support Ticket: ${ticket.title}`,
      html: `
        <h3>New Support Ticket Raised</h3>
        <hr />
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>User Email:</strong> ${userEmail || 'System/Unknown'}</p>
        <p><strong>Priority:</strong> ${ticket.priority || 'Medium'}</p>
        <p><strong>Subject:</strong> ${ticket.title}</p>
        <p><strong>Description:</strong></p>
        <blockquote style="background: #f4f4f4; padding: 10px;">${ticket.description || 'No description provided.'}</blockquote>
        <hr />
        <p><i>This is an automated notification from your SaaS backend.</i></p>
      `
    });

    // Implementation outline for direct HTTP Post to Resend/SendGrid using zero external dependencies (native node `https`)
    const apiKey = process.env.EMAIL_API_KEY;
    if (!apiKey) {
      console.warn(`[EmailService] Warning: EMAIL_API_KEY is not set in environment. Logging payload locally.`);
      console.log(`[EMAIL DUMP]:`, payload);
      return;
    }

    // Example integration block using zero dependencies:
    return new Promise((resolve, reject) => {
      // Example: api.resend.com endpoint or equivalent
      const req = https.request(
        {
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode < 300) {
              console.log(`[EmailService] Email successfully sent via API.`);
              resolve(true);
            } else {
              console.error(`[EmailService] Failed to send email: ${data}`);
              resolve(false);
            }
          });
        }
      );
      req.on('error', (e) => {
        console.error('[EmailService] HTTP Error:', e);
        resolve(false);
      });
      req.write(payload);
      req.end();
    });
  }
}
