import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly scheme: string;
  private readonly apiPublicUrl: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      config.get<string>('MAIL_FROM') ?? 'Baiol <invites@example.com>';
    this.scheme = config.get<string>('APP_SCHEME') ?? 'baiol';
    this.apiPublicUrl =
      config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000';
  }

  async sendListInvite(params: {
    to: string;
    listName: string;
    token: string;
    invitedBy: string;
  }): Promise<void> {
    const appLink = `${this.scheme}://invite/${params.token}`;
    const webLink = `${this.apiPublicUrl}/invites/${params.token}`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h2>You're invited to a grocery list</h2>
        <p>${this.escape(params.invitedBy)} shared <strong>${this.escape(params.listName)}</strong> with you on Baiol.</p>
        <p>Open the Baiol app to access the list. You do not need any extra codes.</p>
        <p><a href="${appLink}">Open in Baiol</a></p>
        <p>If the app does not open, use this link: <a href="${webLink}">${webLink}</a></p>
      </div>
    `;

    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY missing. Invite for ${params.to}: ${appLink} | ${webLink}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `${params.invitedBy} shared “${params.listName}” with you`,
      html,
    });

    if (error) {
      this.logger.error(`Failed to send invite email: ${error.message}`);
    }
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
