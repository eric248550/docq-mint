import { SESClient, SESClientConfig } from '@aws-sdk/client-ses';

// SES Configuration - Server-side only
const sesConfig: SESClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

export const fromEmail = process.env.AWS_SES_FROM_EMAIL || '';

// Create SES Client - Server-side only
export const sesClient = new SESClient(sesConfig);
