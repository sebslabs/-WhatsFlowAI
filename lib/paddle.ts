import { Paddle, Environment } from '@paddle/paddle-node-sdk';

if (!process.env.PADDLE_API_KEY) {
  console.warn('⚠️ Warning: PADDLE_API_KEY environment variable is missing.');
}

export const paddle = new Paddle(process.env.PADDLE_API_KEY || '', {
  environment: (process.env.PADDLE_ENVIRONMENT as Environment) || Environment.sandbox,
});
