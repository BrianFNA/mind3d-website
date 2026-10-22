// site.js – Sternenhimmel (derselbe wie in der App, js/sterne.js) und Menü fürs Handy.
(function () {
  // Sternenhimmel
  const canvas = document.getElementById("sterne");
  if (canvas && typeof SpaceBackground === "function") {
    try {
      const bg = new SpaceBackground(canvas);
      const groesse = () => bg.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2));
      groesse();
      window.addEventListener("resize", groesse);
      bg.start();
      // Weniger Bewegung gewünscht: nur ein ruhiges Bild zeigen
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(() => bg.stop(), 120);
    } catch (e) { /* ohne Sterne geht es auch */ }
  }

  // Menü auf schmalen Bildschirmen
  const knopf = document.querySelector(".menue-knopf");
  const nav = document.getElementById("nav");
  if (knopf && nav) {
    knopf.addEventListener("click", () => {
      const offen = nav.classList.toggle("offen");
      knopf.setAttribute("aria-expanded", offen ? "true" : "false");
      knopf.textContent = offen ? "✕" : "☰";
    });
  }
})();
