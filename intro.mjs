const sprite = new URL("./powerpuff.svg", import.meta.url).href;
const introLength = 1800;
const birthdayLength = 2800;
const birthdayPreference = "beiki-map-birthday-intro";
let openIntro;
let birthdayEnabled;

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
`;

const birthdayArtwork = `
  <svg class="travel-intro__fireworks" viewBox="0 0 840 420" aria-hidden="true" focusable="false">
    <defs>
      <g id="travel-intro-burst" stroke="currentColor" stroke-linecap="round" fill="none">
        <path d="M0-24V-59M0 24v35M-24 0h-35M24 0h35M-17-17l-23-23m57 57 23 23m-57-23-23 23m57-57 23-23" stroke-width="3"/>
        <path d="M0-72v1m0 143v1M-72 0h1m143 0h1M-51-51l1 1m101 101 1 1m-103-1 1-1m101-101 1-1" stroke-width="5"/>
        <circle r="4" fill="currentColor" stroke="none"/>
      </g>
    </defs>
    <g transform="translate(175 168) scale(1.13)">
      <use class="travel-intro__burst travel-intro__burst--pink" href="#travel-intro-burst"/>
    </g>
    <g transform="translate(661 150) scale(.87)">
      <use class="travel-intro__burst travel-intro__burst--blue" href="#travel-intro-burst"/>
    </g>
    <g transform="translate(605 307) scale(.96)">
      <use class="travel-intro__burst travel-intro__burst--gold" href="#travel-intro-burst"/>
    </g>
    <g transform="translate(230 321) scale(.54)">
      <use class="travel-intro__burst travel-intro__burst--blue" href="#travel-intro-burst"/>
    </g>
  </svg>
  <h2 class="travel-intro__greeting">生日快乐</h2>
`;

export function isBirthdayIntroEnabled() {
  if (birthdayEnabled !== undefined) return birthdayEnabled;
  try {
    return window.localStorage.getItem(birthdayPreference) !== "off";
  } catch {
    return true;
  }
}

function setBirthdayIntroEnabled(enabled) {
  birthdayEnabled = enabled;
  try {
    if (enabled) window.localStorage.removeItem(birthdayPreference);
    else window.localStorage.setItem(birthdayPreference, "off");
  } catch {
    // Keep the preference available for this page when browser storage is unavailable.
  }
  window.dispatchEvent(new Event("birthday-intro-change"));
}

export function enableBirthdayIntro() {
  setBirthdayIntroEnabled(true);
}

export function showIntro() {
  if (openIntro?.isConnected) return;
  const birthday = isBirthdayIntroEnabled();
  if (!birthday && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlay = document.createElement("dialog");
  if (typeof overlay.showModal !== "function") return;
  overlay.className = birthday ? "travel-intro travel-intro--birthday" : "travel-intro";
  overlay.setAttribute("aria-label", birthday ? "贝Ki-Map 生日开场" : "贝Ki-Map 开场动画");
  overlay.innerHTML = `
    ${birthday ? birthdayArtwork : ""}
    ${artwork}
    <p class="travel-intro__title" aria-hidden="true">贝Ki-Map</p>
    <div class="travel-intro__controls">
      <button class="travel-intro__skip" type="button" autofocus>跳过本次 <span aria-hidden="true">›</span></button>
      ${birthday ? '<button class="travel-intro__disable" type="button">关闭生日版</button>' : ""}
    </div>
  `;
  document.body.append(overlay);
  openIntro = overlay;

  overlay.querySelector(".travel-intro__skip").addEventListener("click", () => overlay.close());
  overlay.querySelector(".travel-intro__disable")?.addEventListener("click", () => {
    setBirthdayIntroEnabled(false);
    overlay.close();
  });
  return new Promise((resolve) => {
    overlay.showModal();
    const timer = window.setTimeout(() => overlay.close(), birthday ? birthdayLength : introLength);
    overlay.addEventListener("close", () => {
      window.clearTimeout(timer);
      overlay.remove();
      if (openIntro === overlay) openIntro = undefined;
      resolve();
    }, { once: true });
  });
}
