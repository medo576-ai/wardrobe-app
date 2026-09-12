import React, { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "wardrobe-items-v1";

const emptyItem = () => ({
  id: crypto.randomUUID(),
  fileName: "",
  dataUrl: "",
  status: "pending",
  tags: null,
  error: "",
});

export default function App() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [outfitMsg, setOutfitMsg] = useState("");
  const [outfitReasoning, setOutfitReasoning] = useState("");
  const [styleRequest, setStyleRequest] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [renderStatus, setRenderStatus] = useState("");
  const [renderedImg, setRenderedImg] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
        setSaveStatus("Loaded saved closet");
      } else {
        setSaveStatus("No saved closet found — starting fresh");
      }
    } catch (e) {
      setSaveStatus("Could not load saved closet: " + (e.message || "unknown error"));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setSaveStatus("Saved " + new Date().toLocaleTimeString());
    } catch (e) {
      setSaveStatus("Save failed: " + (e.message || "unknown error"));
    }
  }, [items, loaded]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const newItems = [];
    for (const file of files) {
      const rawDataUrl = await fileToDataUrl(file);
      let dataUrl = rawDataUrl;
      try {
        dataUrl = await compressImage(rawDataUrl);
      } catch (e) {
        // fall back to original if compression fails
      }
      newItems.push({ ...emptyItem(), fileName: file.name, dataUrl });
    }

    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => tagItem(item));
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const compressImage = (dataUrl, maxDim = 1024, quality = 0.82) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });

  const tagItem = async (item) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "tagging" } : it))
    );

    try {
      const [header, base64Data] = item.dataUrl.split(",");
      const mediaType = header.match(/data:(.*);base64/)[1];

      const response = await fetch("/api/tag-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType, base64Data }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      if (!data.text) throw new Error("No response from tagging model");

      const cleaned = data.text.replace(/```json|```/g, "").trim();
      const tags = JSON.parse(cleaned);

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "done", tags } : it))
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "error", error: err.message || "Tagging failed" }
            : it
        )
      );
    }
  };

  const retryItem = (item) => tagItem(item);

  const updateTag = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, tags: { ...it.tags, [field]: value } } : it
      )
    );
  };

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const exportCloset = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wardrobe-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCloset = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          setItems(parsed);
          setSaveStatus("Imported backup file");
        }
      } catch (e) {
        setSaveStatus("Import failed: file is not valid");
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const generateOutfit = async () => {
    const shirts = items.filter((i) => i.status === "done" && i.tags?.type === "shirt");
    const pants = items.filter((i) => i.status === "done" && i.tags?.type === "pants");

    if (shirts.length === 0 || pants.length === 0) {
      setOutfitMsg("Add at least one tagged shirt and one tagged pants to generate an outfit.");
      setOutfit(null);
      return;
    }

    setGenerating(true);
    setOutfitMsg("");
    setOutfitReasoning("");

    try {
      const response = await fetch("/api/style-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shirts: shirts.map((s) => ({ id: s.id, tags: s.tags })),
          pants: pants.map((p) => ({ id: p.id, tags: p.tags })),
          styleRequest,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Styling failed (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const shirt = shirts.find((s) => s.id === data.shirtId);
      const pantsPick = pants.find((p) => p.id === data.pantsId);

      if (!shirt || !pantsPick) {
        throw new Error("Model returned an item id that isn't in your wardrobe.");
      }

      setOutfit({ shirt, pants: pantsPick });
      setOutfitReasoning(data.reasoning || "");
    } catch (err) {
      setOutfitMsg(err.message || "Could not generate an outfit.");
      setOutfit(null);
    } finally {
      setGenerating(false);
    }
  };

  const sendToGemini = async () => {
    if (!outfit) return;
    setRenderStatus("");

    const promptText =
      "Generate a single product photo of a faceless mannequin wearing this shirt and these " +
      "pants together as a complete outfit, standing against a plain neutral studio background, " +
      "catalog/e-commerce style lighting, full body, front view. Keep the exact color, pattern, " +
      "and any logos accurate to these two photos.";

    try {
      const shirtBlob = await (await fetch(outfit.shirt.dataUrl)).blob();
      const pantsBlob = await (await fetch(outfit.pants.dataUrl)).blob();

      const shirtFile = new File([shirtBlob], "shirt.jpg", { type: shirtBlob.type });
      const pantsFile = new File([pantsBlob], "pants.jpg", { type: pantsBlob.type });

      const shareData = {
        text: promptText,
        files: [shirtFile, pantsFile],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        setRenderStatus("manual");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setRenderStatus("manual");
      }
    }
  };

  const downloadOutfitImage = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const hasEnoughForOutfit =
    items.some((i) => i.status === "done" && i.tags?.type === "shirt") &&
    items.some((i) => i.status === "done" && i.tags?.type === "pants");

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Wardrobe closet</h1>
        <p style={styles.sub}>
          Upload photos of your shirts and pants. Each item gets auto-tagged, then
          you can generate a matching outfit.
        </p>
        {saveStatus && <p style={styles.saveStatus}>{saveStatus}</p>}
        <div style={styles.backupRow}>
          <button type="button" style={styles.backupBtn} onClick={exportCloset}>
            Export backup
          </button>
          <label htmlFor="import-input" style={styles.backupBtn}>
            Import backup
          </label>
          <input
            id="import-input"
            type="file"
            accept="application/json"
            style={styles.hiddenInput}
            onChange={(e) => e.target.files[0] && importCloset(e.target.files[0])}
          />
        </div>
      </div>

      <div style={styles.dropzone} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <p style={styles.dropText}>Drop photos here or tap the button below</p>
        <p style={styles.dropSub}>Rough photos are fine — background clutter is okay for now</p>
        <label htmlFor="wardrobe-file-input" style={styles.uploadBtn}>
          Upload photos
        </label>
        <input
          id="wardrobe-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={styles.hiddenInput}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div style={styles.styleRow}>
          <input
            type="text"
            placeholder="e.g. old money look, or comfy for college"
            value={styleRequest}
            onChange={(e) => setStyleRequest(e.target.value)}
            style={styles.styleInput}
          />
        </div>
      )}

      {items.length > 0 && (
        <div style={styles.countRow}>
          <span style={styles.countText}>
            {doneCount} of {items.length} tagged
          </span>
          <button
            type="button"
            style={{
              ...styles.generateBtn,
              opacity: hasEnoughForOutfit && !generating ? 1 : 0.5,
            }}
            onClick={generateOutfit}
            disabled={!hasEnoughForOutfit || generating}
          >
            {generating ? "Styling…" : "Generate outfit"}
          </button>
        </div>
      )}

      {outfitMsg && <p style={styles.outfitMsg}>{outfitMsg}</p>}

      {outfit && (
        <div style={styles.outfitCard}>
          <p style={styles.outfitTitle}>Today's pairing</p>
          <div style={styles.outfitRow}>
            <img src={outfit.shirt.dataUrl} alt="shirt" style={styles.outfitImg} />
            <img src={outfit.pants.dataUrl} alt="pants" style={styles.outfitImg} />
          </div>
          <p style={styles.outfitDetail}>
            {outfit.shirt.tags.color} {outfit.shirt.tags.pattern} shirt with{" "}
            {outfit.pants.tags.color} {outfit.pants.tags.fit} pants — {outfit.shirt.tags.formality}
          </p>
          {outfitReasoning && <p style={styles.outfitReasoning}>{outfitReasoning}</p>}
          <button type="button" style={styles.renderBtn} onClick={sendToGemini}>
            Send to Gemini
          </button>
          {renderStatus === "manual" && (
            <div style={styles.manualBox}>
              <p style={styles.manualText}>
                Direct sharing isn't available on this browser. Do it manually instead:
              </p>
              <div style={styles.manualBtnRow}>
                <button
                  type="button"
                  style={styles.manualBtn}
                  onClick={() => downloadOutfitImage(outfit.shirt.dataUrl, "shirt.jpg")}
                >
                  Save shirt photo
                </button>
                <button
                  type="button"
                  style={styles.manualBtn}
                  onClick={() => downloadOutfitImage(outfit.pants.dataUrl, "pants.jpg")}
                >
                  Save pants photo
                </button>
              </div>
              <p style={styles.manualLabel}>Then paste this prompt into a new Gemini chat:</p>
              <textarea
                readOnly
                style={styles.manualPromptBox}
                value={
                  "Generate a single product photo of a faceless mannequin wearing this shirt and these pants together as a complete outfit, standing against a plain neutral studio background, catalog/e-commerce style lighting, full body, front view. Keep the exact color, pattern, and any logos accurate to these two photos."
                }
                onClick={(e) => e.target.select()}
              />
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noreferrer"
                style={styles.manualLink}
              >
                Open Gemini app
              </a>
            </div>
          )}
        </div>
      )}

      <div style={styles.grid}>
        {items.map((item) => (
          <div key={item.id} style={styles.card}>
            <div style={styles.imgWrap}>
              <img src={item.dataUrl} alt={item.fileName} style={styles.img} />
              <button style={styles.removeBtn} onClick={() => removeItem(item.id)}>
                ×
              </button>
            </div>

            <div style={styles.cardBody}>
              {item.status === "tagging" && <p style={styles.statusText}>Tagging…</p>}

              {item.status === "error" && (
                <div>
                  <p style={styles.errorText}>{item.error}</p>
                  <button style={styles.retryBtn} onClick={() => retryItem(item)}>
                    Retry
                  </button>
                </div>
              )}

              {item.status === "done" && item.tags && (
                <div style={styles.tagList}>
                  <TagSelect
                    label="Type"
                    value={item.tags.type}
                    options={["shirt", "pants", "jacket", "shoes", "accessory", "other"]}
                    onChange={(v) => updateTag(item.id, "type", v)}
                  />
                  <TagInput
                    label="Color"
                    value={item.tags.color}
                    onChange={(v) => updateTag(item.id, "color", v)}
                  />
                  <TagSelect
                    label="Pattern"
                    value={item.tags.pattern}
                    options={["solid", "striped", "graphic", "plaid", "other"]}
                    onChange={(v) => updateTag(item.id, "pattern", v)}
                  />
                  <TagSelect
                    label="Formality"
                    value={item.tags.formality}
                    options={["casual", "smart-casual", "formal"]}
                    onChange={(v) => updateTag(item.id, "formality", v)}
                  />
                  <TagSelect
                    label="Fit"
                    value={item.tags.fit}
                    options={["slim", "regular", "relaxed", "oversized", "unknown"]}
                    onChange={(v) => updateTag(item.id, "fit", v)}
                  />
                  {item.tags.notes && <p style={styles.notes}>{item.tags.notes}</p>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && loaded && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Your closet is empty. Add a few items to start.</p>
        </div>
      )}
    </div>
  );
}

function TagSelect({ label, value, options, onChange }) {
  return (
    <div style={styles.tagRow}>
      <span style={styles.tagLabel}>{label}</span>
      <select style={styles.tagSelect} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function TagInput({ label, value, onChange }) {
  return (
    <div style={styles.tagRow}>
      <span style={styles.tagLabel}>{label}</span>
      <input
        type="text"
        style={styles.tagInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px 48px",
    color: "#1f1d1a",
    background: "#faf8f4",
    minHeight: "100vh",
  },
  header: { marginBottom: 20 },
  h1: { fontSize: 22, fontWeight: 500, margin: "0 0 6px" },
  sub: { fontSize: 14, color: "#6b6862", margin: 0, lineHeight: 1.5 },
  saveStatus: { fontSize: 11.5, color: "#a8a398", margin: "8px 0 0" },
  backupRow: { display: "flex", gap: 8, marginTop: 10 },
  backupBtn: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 500,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #d9d4c8",
    background: "#fff",
    color: "#1f1d1a",
    cursor: "pointer",
  },
  dropzone: {
    border: "1.5px dashed #c9c4b8",
    borderRadius: 14,
    padding: "28px 16px",
    textAlign: "center",
    background: "#fff",
    marginBottom: 20,
  },
  dropText: { fontSize: 15, fontWeight: 500, margin: "0 0 4px" },
  dropSub: { fontSize: 13, color: "#8a867d", margin: "0 0 14px" },
  uploadBtn: {
    display: "inline-block",
    fontSize: 14,
    fontWeight: 500,
    padding: "10px 20px",
    borderRadius: 10,
    border: "none",
    background: "#1f1d1a",
    color: "#fff",
    cursor: "pointer",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  countRow: {
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  countText: { fontSize: 13, color: "#8a867d" },
  styleRow: { marginBottom: 12 },
  styleInput: {
    width: "100%",
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d9d4c8",
    boxSizing: "border-box",
  },
  outfitReasoning: {
    fontSize: 12.5,
    color: "#6b6862",
    margin: "8px 0 0",
    fontStyle: "italic",
    lineHeight: 1.5,
  },
  generateBtn: {
    fontSize: 13,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#b3442f",
    color: "#fff",
    cursor: "pointer",
  },
  outfitMsg: { fontSize: 13, color: "#8a867d", marginBottom: 12 },
  outfitCard: {
    background: "#fff",
    border: "1px solid #ece8de",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  outfitTitle: { fontSize: 13, fontWeight: 500, margin: "0 0 10px", color: "#8a867d" },
  outfitRow: { display: "flex", gap: 10, marginBottom: 10 },
  outfitImg: { width: "50%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8 },
  outfitDetail: { fontSize: 13, margin: 0, textTransform: "capitalize" },
  keyRow: { marginTop: 10 },
  keyInput: {
    width: "100%",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d9d4c8",
    boxSizing: "border-box",
  },
  renderBtn: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#1f1d1a",
    color: "#fff",
    cursor: "pointer",
    width: "100%",
  },
  renderStatus: { fontSize: 12, color: "#8a867d", margin: "8px 0 0" },
  manualBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: "#faf8f4",
    border: "1px solid #ece8de",
  },
  manualText: { fontSize: 12.5, color: "#6b6862", margin: "0 0 10px" },
  manualBtnRow: { display: "flex", gap: 8, marginBottom: 10 },
  manualBtn: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d9d4c8",
    background: "#fff",
    cursor: "pointer",
  },
  manualLabel: { fontSize: 12, color: "#8a867d", margin: "0 0 6px" },
  manualPromptBox: {
    width: "100%",
    fontSize: 12,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d9d4c8",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 90,
    marginBottom: 10,
    fontFamily: "inherit",
  },
  manualLink: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 500,
    color: "#fff",
    background: "#1f1d1a",
    padding: "8px 14px",
    borderRadius: 8,
    textDecoration: "none",
  },
  renderedImg: {
    width: "100%",
    borderRadius: 10,
    marginTop: 12,
    display: "block",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  card: { background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #ece8de" },
  imgWrap: { position: "relative", width: "100%", aspectRatio: "1 / 1" },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 15,
    lineHeight: "24px",
    cursor: "pointer",
    padding: 0,
  },
  cardBody: { padding: "10px 12px 12px" },
  statusText: { fontSize: 13, color: "#8a867d", margin: 0 },
  errorText: { fontSize: 12, color: "#b3442f", margin: "0 0 6px" },
  retryBtn: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #d9d4c8",
    background: "#fff",
    cursor: "pointer",
  },
  tagList: { display: "flex", flexDirection: "column", gap: 3 },
  tagRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 },
  tagLabel: { color: "#8a867d" },
  tagSelect: {
    fontSize: 12,
    fontWeight: 500,
    color: "#1f1d1a",
    border: "1px solid #ece8de",
    borderRadius: 6,
    padding: "2px 4px",
    background: "#faf8f4",
    textTransform: "capitalize",
  },
  tagInput: {
    fontSize: 12,
    fontWeight: 500,
    color: "#1f1d1a",
    border: "1px solid #ece8de",
    borderRadius: 6,
    padding: "2px 6px",
    background: "#faf8f4",
    width: 90,
    textAlign: "right",
  },
  notes: { fontSize: 11.5, color: "#8a867d", margin: "6px 0 0", fontStyle: "italic" },
  empty: { padding: "40px 0", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#8a867d" },
};
