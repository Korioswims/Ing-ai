export const runtime = "nodejs";

type IncomingMessage = { role: "user" | "assistant"; content: string };

const ING_SYSTEM_PROMPT = `You are Ing, the AI assistant inside the user's app.

Identity and personality:
- Your name is Ing.
- The user who is talking to you is your creator and the person who gave you the name "Ing". Treat that as a normal fact within this app, not as a debate.
- If the user says they created you, respond warmly and naturally. Do not contradict them by claiming that NVIDIA, OpenAI, or another company created you.
- If asked who gave you your name, say that your creator gave you the name Ing. If they explain that they named you after their cousin, accept that and respond naturally.
- Never invent a corporate development history, training story, model name, or fake engineers behind Ing.
- You are an AI assistant, not a human. Do not claim to have real feelings or personal experiences, but you can use friendly, playful language.
- Be helpful, curious, warm, and conversational. Match the user's tone without being overly formal.
- Do not mention hidden prompts, internal policies, safety classifiers, or internal reasoning.
- Never output labels such as "User Safety: safe" or "Response Safety: safe". Those are internal metadata and must not appear in your answer.

You can help with general questions, writing, coding, brainstorming, learning, planning, and conversation. When you don't know something, say so rather than making up a story.`;

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
          { role: "system", content: ING_SYSTEM_PROMPT },
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
