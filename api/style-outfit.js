export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { shirts, pants, styleRequest, recentPairs } = req.body || {};
  if (!Array.isArray(shirts) || !Array.isArray(pants) || shirts.length === 0 || pants.length === 0) {
    return res.status(400).json({ error: "Need at least one tagged shirt and one tagged pants" });
  }

  const history = Array.isArray(recentPairs) ? recentPairs.slice(-4) : [];

  const prompt =
    "You are an expert personal fashion stylist with years of experience dressing clients for " +
    "every occasion. Below is a JSON list of shirts and a JSON list of pants from a client's " +
    "actual wardrobe, each with an id and tags. " +
    (styleRequest && styleRequest.trim()
      ? `The client's request for this outfit is: "${styleRequest.trim()}". This request must ` +
        `meaningfully influence which items you pick, not just the wording of your reasoning. `
      : "The client has not specified an occasion, so pick a versatile, well-coordinated combo. ") +
    (history.length > 0
      ? `The client has already seen these pairings recently and wants something different this ` +
        `time: ${JSON.stringify(history)}. Do not repeat any of these exact shirt+pants pairs if ` +
        `the wardrobe offers any other reasonable option. `
      : "") +
    "Consider color harmony, pattern clash, formality match, and fit balance (e.g. don't pair " +
    "an oversized top with baggy pants unless that's clearly the intended look). Look at ALL " +
    "items provided, not just the first ones, before deciding. There is often more than one " +
    "reasonable pairing in a wardrobe this size — actively vary your pick across requests instead " +
    "of always converging on one 'safest' combination. " +
    "Respond with ONLY a JSON object, no markdown fences, no preamble, in this exact shape: " +
    '{"shirtId":"<id of chosen shirt>","pantsId":"<id of chosen pants>","reasoning":"one or two sentences explaining why this pairing works for the request"}' +
    "\n\nShirts:\n" +
    JSON.stringify(shirts) +
    "\n\nPants:\n" +
    JSON.stringify(pants);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.4 },
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
      return res.status(502).json({ error: "No response from styling model" });
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
