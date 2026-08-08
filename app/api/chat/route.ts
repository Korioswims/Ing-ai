import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured in Vercel." }, { status: 500 });
    }

    const body = await request.json();
    const messages = body.messages as IncomingMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Please send a message." }, { status: 400 });
    }

    const input = messages.slice(-30).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions: "You are Ing, a friendly, capable general-purpose AI assistant. Be helpful, accurate, concise when possible, and explain things clearly.",
      input,
    });

    return Response.json({ text: response.output_text || "I couldn't generate a response." });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Ing couldn't answer right now. Check your API key and model settings." }, { status: 500 });
  }
}
