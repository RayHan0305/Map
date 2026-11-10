const sprite = new URL("./powerpuff.svg", import.meta.url).href;
const introLength = 1800;
let openIntro;

const girls = [
  { id: "buttercup", crop: "-71 -61 133 135" },
  { id: "bubbles", crop: "-83 -52 166 129" },
  { id: "blossom", crop: "-91 -72 149 152" },
];

const artwork = `
  <div class="travel-intro__scene" aria-hidden="true">
    <svg class="travel-intro__sky" viewBox="0 0 840 420" fill="none">
      <defs>
        <path id="travel-intro-star" d="M0-11C1.8-3.5 3.5-1.8 11 0 3.5 1.8 1.8 3.5 0 11-1.8 3.5-3.5 1.8-11 0-3.5-1.8-1.8-3.5 0-11Z"/>
        <path id="travel-intro-heart" d="M420 339C351 297 267 236 267 163c0-49 37-83 82-83 34 0 58 16 71 41 13-25 37-41 71-41 45 0 82 34 82 83 0 73-84 134-153 176Z"/>
      </defs>
      <g class="travel-intro__hearts" stroke="#fff2fa">
        <use href="#travel-intro-heart" transform="translate(-222 -110) scale(1.53)" stroke-width="10" opacity=".35"/>
        <use href="#travel-intro-heart" transform="translate(-92 -43) scale(1.22)" stroke-width="11" opacity=".48"/>
        <use href="#travel-intro-heart" stroke-width="12" opacity=".61"/>
      </g>
      <g class="travel-intro__trails" stroke-linecap="round">
        <path class="travel-intro__trail travel-intro__trail--lime" pathLength="1" d="M-46 344Q82 381 216 240" stroke="#a7ec7e" stroke-width="12"/>
        <path class="travel-intro__trail travel-intro__trail--blue" pathLength="1" d="M-11 306Q220 348 412 165" stroke="#78bcff" stroke-width="12"/>
        <path class="travel-intro__trail travel-intro__trail--pink" pathLength="1" d="M-12 255Q337 277 623 116" stroke="#ff8ab7" stroke-width="12"/>
      </g>
      <g class="travel-intro__stars" fill="#fff8de">
        <use href="#travel-intro-star" transform="translate(83 181) scale(.88)"/>
        <use href="#travel-intro-star" transform="translate(253 102) scale(.62)"/>
        <use href="#travel-intro-star" transform="translate(348 59) scale(.79)" fill="#fff4fd"/>
        <use href="#travel-intro-star" transform="translate(514 96) scale(.58)"/>
        <use href="#travel-intro-star" transform="translate(729 64) scale(1.17)"/>
        <use href="#travel-intro-star" transform="translate(738 205) scale(.7)"/>
        <use href="#travel-intro-star" transform="translate(543 285) scale(.73)" fill="#fff4fd"/>
        <use href="#travel-intro-star" transform="translate(333 298) scale(.53)"/>
        <circle cx="136" cy="117" r="3"/>
        <circle cx="183" cy="334" r="3.2"/>
        <circle cx="481" cy="300" r="2.7"/>
        <circle cx="770" cy="123" r="2.7"/>
      </g>
    </svg>
    ${girls.map(({ id, crop }) => `
      <svg class="travel-intro__girl travel-intro__girl--${id}" viewBox="${crop}" fill="none" focusable="false">
        <use href="${sprite}#${id}"/>
      </svg>
    `).join("")}
  </div>
  <p class="travel-intro__title" aria-hidden="true">贝Ki-Map</p>
  <button class="travel-intro__skip" type="button" autofocus>跳过动画 <span aria-hidden="true">›</span></button>
`;

export function showIntro() {
  if (openIntro?.isConnected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlay = document.createElement("dialog");
  if (typeof overlay.showModal !== "function") return;
  overlay.className = "travel-intro";
  overlay.setAttribute("aria-label", "贝Ki-Map 开场动画");
  overlay.innerHTML = artwork;
  document.body.append(overlay);
  openIntro = overlay;

  const timer = window.setTimeout(() => overlay.close(), introLength);
  overlay.addEventListener("close", () => {
    window.clearTimeout(timer);
    overlay.remove();
    if (openIntro === overlay) openIntro = undefined;
  }, { once: true });
  overlay.querySelector(".travel-intro__skip").addEventListener("click", () => overlay.close());
  overlay.showModal();
}