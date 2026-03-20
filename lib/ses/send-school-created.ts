import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient, fromEmail } from './config';

interface SendSchoolCreatedEmailParams {
  to: string;
  schoolName: string;
  isNewUser: boolean;
  appUrl: string;
}

export async function sendSchoolCreatedEmail({
  to,
  schoolName,
  isNewUser,
  appUrl,
}: SendSchoolCreatedEmailParams): Promise<void> {
  if (!fromEmail) {
    console.warn('AWS_SES_FROM_EMAIL is not configured, skipping school created email');
    return;
  }

  const subject = `You've been added as owner of ${schoolName} on DocQ Mint`;

  const actionText = isNewUser
    ? `Sign up at the link below to access your school organization:`
    : `Log in to DocQ Mint to access your school organization:`;

  const buttonLabel = isNewUser ? 'Create Your Account' : 'Go to Dashboard';

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to ${schoolName}!</h2>
      <p>A school organization has been created for you on <strong>DocQ Mint</strong>.</p>
      <p>You are the <strong>owner</strong> of <strong>${schoolName}</strong>.</p>
      <p>${actionText}</p>
      <p style="margin: 24px 0;">
        <a href="${appUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          ${buttonLabel}
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser: ${appUrl}</p>
    </div>
  `;

  const textBody = `Welcome to ${schoolName}!\n\nA school organization has been created for you on DocQ Mint. You are the owner of ${schoolName}.\n\n${actionText}\n${appUrl}`;

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
