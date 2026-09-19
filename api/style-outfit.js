export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { shirts, pants, belts, watches, shoes, styleRequest, usedCombos } = req.body || {};

  if (!Array.isArray(shirts) || !Array.isArray(pants) || shirts.length === 0 || pants.length === 0) {
    return res.status(400).json({ error: "Need at least one tagged shirt and one tagged pants" });
  }

  const belt = Array.isArray(belts) ? belts : [];
  const watch = Array.isArray(watches) ? watches : [];
  const shoe = Array.isArray(shoes) ? shoes : [];
  const history = Array.isArray(usedCombos) ? usedCombos.slice(-40) : [];

  const optionalLine = (label, list) =>
    list.length > 0
      ? `\n\n${label} (optional — include one only if it genuinely improves the outfit):\n` +
        JSON.stringify(list)
      : "";

  const prompt =
    "You are an expert personal fashion stylist with years of experience dressing clients for " +
    "every occasion. Below are JSON lists of items from a client's actual wardrobe, each with an " +
    "id and tags. You must pick one shirt and one pair of pants. You may also pick one belt, one " +
    "watch, and one pair of shoes if those lists are provided and the item improves the look. " +
    (styleRequest && styleRequest.trim()
      ? `The client's request for this outfit is: "${styleRequest.trim()}". This request must ` +
        `meaningfully influence which items you pick, not just the wording of your reasoning. `
      : "The client has not specified an occasion, so pick a versatile, well-coordinated combo. ") +
    (history.length > 0
      ? `IMPORTANT: the client has already been shown these exact combinations before and never ` +
        `wants to see them again: ${JSON.stringify(history)}. You must pick a combination that ` +
        `does not match any of these. If literally every possible shirt+pants pairing in the ` +
        `wardrobe already appears in that list, then pick the best one anyway but set ` +
        `"exhausted" to true in your response. `
      : "") +
    "Consider color harmony, pattern clash, formality match, and fit balance. Leather colors " +
    "should generally coordinate (belt and shoes), and a dressy watch suits formal looks while a " +
    "sportier one suits casual. Look at ALL items provided, not just the first ones. " +
    "Respond with ONLY a JSON object, no markdown fences, no preamble, in this exact shape " +
    "(use null for any optional item you choose not to include):\n" +
    '{"shirtId":"<id>","pantsId":"<id>","beltId":<id or null>,"watchId":<id or null>,' +
    '"shoesId":<id or null>,"exhausted":false,' +
    '"reasoning":"one or two sentences explaining why this outfit works for the request"}' +
    "\n\nShirts:\n" +
    JSON.stringify(shirts) +
    "\n\nPants:\n" +
    JSON.stringify(pants) +
    optionalLine("Belts", belt) +
    optionalLine("Watches", watch) +
    optionalLine("Shoes", shoe);

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
