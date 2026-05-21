import { AIService } from './src/services/ai.service.js';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

console.log("--- Diagnostic Check ---");
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);
console.log("GROQ_API_KEY snippet:", process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 8) + "..." : "MISSING");

async function run() {
  try {
    console.log("\nTesting Direct Groq Instantiation...");
    const groq = new OpenAI({
       apiKey: process.env.GROQ_API_KEY || '',
       baseURL: 'https://api.groq.com/openai/v1',
    });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Say success!' }],
      max_tokens: 10
    });
    console.log("✅ Groq API Response Successful:", response.choices[0]?.message?.content);
  } catch (err) {
    console.error("❌ Groq Execution Failed:", err.message);
    if (err.response) {
       console.error("Response Status:", err.status);
       console.error("Response Body:", await err.response.text());
    }
  }
}

run();
