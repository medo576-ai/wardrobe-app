export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });
  }

  const { mediaType, base64Data } = req.body || {};
  if (!mediaType || !base64Data) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Data },
              },
              {
                type: "text",
                text:
                  "You are a fashion cataloguer. Look at this single garment photo and respond with ONLY a JSON object, no markdown fences, no preamble, in this exact shape: " +
                  '{"type":"shirt|pants|jacket|shoes|accessory|other","color":"primary color in plain words","pattern":"solid|striped|graphic|plaid|other","formality":"casual|smart-casual|formal","fit":"slim|regular|relaxed|oversized|unknown","notes":"one short phrase on anything distinctive like a logo or text"}',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText.slice(0, 500) });
    }

    const data = await response.json();
    const textBlock = data?.content?.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "No text response from model" });
    }

    return res.status(200).json({ text: textBlock.text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
