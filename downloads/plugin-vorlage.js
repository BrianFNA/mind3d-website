// plugin-vorlage.js – Ausgangspunkt für ein eigenes mind3D-Plugin.
// Kopieren, id/name anpassen, über 🧩 → "Plugin aus Datei installieren" laden.
// Doku: PLUGINS.md

mind3D.plugins.register({
  id: "vorlage",
  name: "Vorlage",
  version: "1.0.0",
  author: "",
  icon: "✨",
  description: "Hebt den ausgewählten Knoten mit einem Leuchten hervor.",
  apiVersion: 1,

  settings: [
    { key: "farbe", type: "color", label: "Leuchtfarbe", default: "#00d4ff" },
    { key: "staerke", type: "range", label: "Stärke", default: 18, min: 4, max: 40, step: 1 },
  ],

  activate(api) {
    // Nur auf der Mindmap-Seite gibt es etwas zu zeichnen
    if (api.page !== "map") return;

    api.render.nodeBefore((ctx, node, rect) => {
      if (!rect.selected) return;
      ctx.shadowColor = api.settings.get("farbe");
      ctx.shadowBlur  = api.settings.get("staerke");
      ctx.fillStyle   = api.settings.get("farbe");
      ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    });
  },
});
