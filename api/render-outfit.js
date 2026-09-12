export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { shirt, pants } = req.body || {};
  if (!shirt?.data || !pants?.data) {
    return res.status(400).json({ error: "Missing shirt or pants image data" });
  }

  const prompt =
    "Using the two garment photos provided (a shirt and a pair of pants), " +
    "generate a single product photo of a faceless mannequin or dress form wearing " +
    "both items together as a complete outfit, standing against a plain neutral studio " +
    "background, catalog/e-commerce style lighting, full body, front view. Keep the exact " +
    "color, pattern, and any logos or text on each garment accurate to the source photos. " +
    "Do not add a face or head details beyond a simple mannequin form.";

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: shirt.mime, data: shirt.data } },
                { inline_data: { mime_type: pants.mime, data: pants.data } },
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
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart?.inlineData || imgPart?.inline_data;

    if (!inline) {
      return res.status(502).json({ error: "No image returned from Gemini" });
    }

    return res.status(200).json({
      image: inline.data,
      mime: inline.mimeType || inline.mime_type || "image/png",
    });
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

  const { shirt, pants } = req.body || {};
  if (!shirt?.data || !pants?.data) {
    return res.status(400).json({ error: "Missing shirt or pants image data" });
  }

  const prompt =
    "Using the two garment photos provided (a shirt and a pair of pants), " +
    "generate a single product photo of a faceless mannequin or dress form wearing " +
    "both items together as a complete outfit, standing against a plain neutral studio " +
    "background, catalog/e-commerce style lighting, full body, front view. Keep the exact " +
    "color, pattern, and any logos or text on each garment accurate to the source photos. " +
    "Do not add a face or head details beyond a simple mannequin form.";

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash-image:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: shirt.mime, data: shirt.data } },
                { inline_data: { mime_type: pants.mime, data: pants.data } },
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
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart?.inlineData || imgPart?.inline_data;

    if (!inline) {
      return res.status(502).json({ error: "No image returned from Gemini" });
    }

    return res.status(200).json({
      image: inline.data,
      mime: inline.mimeType || inline.mime_type || "image/png",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
fix model name
