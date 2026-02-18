import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient, fromEmail } from './config';

interface SendInviteEmailParams {
  to: string;
  schoolName: string;
  role: string;
  inviteUrl: string;
}

export async function sendInviteEmail({
  to,
  schoolName,
  role,
  inviteUrl,
}: SendInviteEmailParams): Promise<void> {
  if (!fromEmail) {
    console.warn('AWS_SES_FROM_EMAIL is not configured, skipping invite email');
    return;
  }

  const subject = `You've been invited to join ${schoolName} on DocQ Mint`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You're Invited!</h2>
      <p>You've been invited to join <strong>${schoolName}</strong> as a <strong>${role}</strong> on DocQ Mint.</p>
      <p>Click the button below to accept your invitation:</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Join ${schoolName}
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser: ${inviteUrl}</p>
      <p style="color: #6b7280; font-size: 14px;">This invite link expires in 7 days.</p>
    </div>
  `;

  const textBody = `You've been invited to join ${schoolName} as a ${role} on DocQ Mint.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invite link expires in 7 days.`;

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: htmlBody },
        Text: { Data: textBody },
      },
    },
  });

  await sesClient.send(command);
}
