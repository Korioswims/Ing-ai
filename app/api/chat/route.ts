export const runtime = "nodejs";

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENROUTER_API_KEY is not configured. Add it to Vercel → Settings → Environment Variables, then redeploy." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const messages = body.messages as IncomingMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Please send a message." }, { status: 400 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://ing-ai.vercel.app",
        "X-Title": "Ing AI",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages: [
          {
            role: "system",
            content:
              "You are Ing, a friendly, capable general-purpose AI assistant. Be helpful, accurate, concise when possible, and explain things clearly.",
          },
          ...messages.slice(-30),
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || `OpenRouter returned ${response.status}`;
      return Response.json({ error: `Ing couldn't answer right now (${message})` }, { status: 502 });
    }

    const text = data?.choices?.[0]?.message?.content;
    return Response.json({ text: text || "I couldn't generate a response." });
  } catch (error: unknown) {
    console.error("Ing OpenRouter error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Ing couldn't answer right now (${message})` }, { status: 500 });
  }
}
