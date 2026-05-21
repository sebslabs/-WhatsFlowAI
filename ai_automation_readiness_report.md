# WhatsFlow AI — AI Automation Readiness Blueprint
### Complete Step-by-Step Action Plan to Fully Activate Your AI Conversational Engine

To fully activate and run 100% automated AI conversational workflows in WhatsFlow AI, several API endpoints, background queues, and vector structures need to be configured. 

Below is the exact step-by-step blueprint detailing **what you need to prepare, configure, and retrieve on your side**.

---

## 🗺️ High-Level AI Automation Flow

```mermaid
graph LR
    Incoming[Incoming Customer Message] --> Webhook[Webhook Gateway]
    Webhook --> Queue[Redis / BullMQ Queue]
    Queue --> Worker[AI Worker Thread]
    Worker --> Vector[Vector Search: pgvector / Pinecone]
    Vector --> LLM[LLM Context Generation: OpenAI]
    LLM --> Outgoing[Automated WhatsApp Message Sent]
```

---

## 🛠️ Step 1: AI Brain Credentials (OpenAI API Setup)

WhatsFlow AI uses OpenAI's high-speed GPT models to parse customer intent, perform semantic searches, and formulate friendly, context-aware responses.

### 📋 Actions Required on Your End:
1. **Create an OpenAI Developer Account:** Go to [OpenAI Platform](https://platform.openai.com/).
2. **Access API Keys:** Navigate to **API Keys** on the left-hand menu and click **"Create new secret key"**. Name it `WhatsFlow-Prod`.
3. **Fund Your Balance:** AI automation queries require prepayments. Go to **Settings > Billing** and add at least **$5.00** to your credit balance.
4. **Copy the Key to Environment Variables:** Add this key to your server `.env` file:
   ```env
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 🧠 Step 2: Knowledge Base & Vector Space Setup (RAG Engine)

To allow the AI to answer questions about your specific business (pricing, FAQs, refund policies) without hallucinating, we implement **RAG** (Retrieval-Augmented Generation). You have two choices for your vector database:

### Option A: Native Supabase Vector Space (Recommended)
This uses your existing Supabase database (saving costs and keeping queries simple).
1. Go to your **Supabase Dashboard > Database > Extensions**.
2. Search for **`vector`** (`pgvector`) and click **Enable**.
3. Create the document chunk database tables by running this in the Supabase SQL Editor:
   ```sql
   -- Create a table to store document embeddings
   CREATE EXTENSION IF NOT EXISTS vector;
   
   CREATE TABLE IF NOT EXISTS document_chunks (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id uuid REFERENCES profiles(tenant_id),
     document_name text NOT NULL,
     content text NOT NULL,
     embedding vector(1536), -- 1536 matches OpenAI text-embedding-3-small
     created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
   );
   ```

### Option B: Pinecone Vector Database (Enterprise Scale)
If you want to scale to millions of corporate files:
1. Create a free account at [Pinecone.io](https://www.pinecone.io/).
2. Create a **Serverless Index** named `whatsflow-knowledge-base` with **1536 Dimensions** (Cosine distance metric).
3. Copy your API Key and host URL to your environment:
   ```env
   PINECONE_API_KEY=xxxx-xxxx-xxxx
   PINECONE_INDEX=whatsflow-knowledge-base
   ```

---

## ⏳ Step 3: Redis & Background Job Worker Setup (BullMQ)

AI responses take 1 to 3 seconds. To prevent Meta Webhook timeouts, WhatsFlow AI queues incoming messages in Redis, returns a `200 OK` instantly to Meta, and processes the AI response asynchronously in the background.

### 📋 Actions Required on Your End:
* **For Local Development:** Install and run Redis locally on port `6379`.
* **For AWS Production hosting:** Set up an **AWS ElastiCache Redis** instance.
* **For Serverless/Cloud hosting (e.g. Render/Vercel):** Create a high-speed serverless Redis cluster in seconds using [Upstash Redis](https://upstash.com/) (they have a generous free tier).
* **Retrieve the Connection URL** and add it to your server `.env`:
  ```env
  REDIS_URL=rediss://default:your-password@your-upstash-endpoint.upstash.io:6379
  ```

---

## 🎛️ Step 4: Activating AI on Leads (Control Room)

Once Steps 1-3 are complete, you can toggle AI automation on or off instantly for any WhatsApp chat.

1. Navigate to your WhatsFlow AI **Dashboard > Conversations**.
2. Click on any active contact.
3. In the top-right header, click the **"Resume AI"** button.
   * This updates the lead's profile (`ai_active: true`) in your database.
4. When the customer texts your WhatsApp number:
   * The webhook captures it.
   * The BullMQ worker embeds the user's text and performs a similarity search on your `document_chunks`.
   * It feeds the closest FAQs to GPT-4o.
   * GPT-4o outputs a highly targeted reply and automatically sends it to the customer via WhatsApp!
