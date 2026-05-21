import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
console.log('Loaded API Key prefix:', apiKey?.substring(0, 10));

const openrouter = new OpenAI({
  apiKey: apiKey || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    "HTTP-Referer": "https://whatsflow.ai",
    "X-Title": "WhatsFlow AI",
  }
});

async function run() {
  try {
    console.log('Sending request to OpenRouter...');
    const response = await openrouter.chat.completions.create({
      model: 'google/gemini-flash-1.5',
      messages: [
        { role: 'user', content: 'Hello, reply SUCCESS if you can read this.' },
      ],
      max_tokens: 10,
    });
    console.log('Response:', response.choices[0]?.message?.content);
  } catch (err: any) {
    console.error('OpenRouter API Call Failed!');
    console.error(err.message);
    if (err.response) {
      console.error('Status:', err.status);
      console.error('Body:', await err.response.text());
    }
  }
}

run();
