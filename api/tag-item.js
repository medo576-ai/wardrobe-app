export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { mediaType, base64Data } = req.body || {};
  if (!mediaType || !base64Data) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const prompt =
    "You are a fashion cataloguer. Look at this single garment photo and respond with ONLY a JSON object, no markdown fences, no preamble, in this exact shape: " +
    '{"type":"shirt|pants|jacket|shoes|accessory|other","color":"primary color in plain words","pattern":"solid|striped|graphic|plaid|other","formality":"casual|smart-casual|formal","fit":"slim|regular|relaxed|oversized|unknown","notes":"one short phrase on anything distinctive like a logo or text"}';

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mediaType, data: base64Data } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText.slice(0, 500) });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) {
      return res.status(502).json({ error: "No text response from model" });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { mediaType, base64Data } = req.body || {};
  if (!mediaType || !base64Data) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const prompt =
    "You are a fashion cataloguer. Look at this single garment photo and respond with ONLY a JSON object, no markdown fences, no preamble, in this exact shape: " +
    '{"type":"shirt|pants|jacket|shoes|accessory|other","color":"primary color in plain words","pattern":"solid|striped|graphic|plaid|other","formality":"casual|smart-casual|formal","fit":"slim|regular|relaxed|oversized|unknown","notes":"one short phrase on anything distinctive like a logo or text"}';

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mediaType, data: base64Data } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText.slice(0, 500) });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) {
      return res.status(502).json({ error: "No text response from model" });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
fix model name
