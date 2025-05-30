let selectedSounds = [];

chrome.storage.local.get("selectedSounds", (data) => {
  selectedSounds = data.selectedSounds || [];

  const observer = new MutationObserver(() => injectCheckboxes());
  observer.observe(document.body, { childList: true, subtree: true });

  injectCheckboxes();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.selectedSounds) {
    selectedSounds = changes.selectedSounds.newValue || [];
  }
});

function injectCheckboxes() {
  document
    .querySelectorAll("core-sample-asset-list-row")
    .forEach((row, index) => {
      if (row.querySelector(".splice-check")) return;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "splice-check";
      checkbox.style.position = "absolute";
      checkbox.style.padding = "2em";
      checkbox.style.right = "20%";
      checkbox.style.top = "50%";
      checkbox.style.transform = "translateY(-50%)";
      checkbox.style.zIndex = "9999";
      checkbox.style.display = "none";

      const rowId = `row-${index}`;
      const soundLabel = row.innerText.slice(0, 50);

      if (selectedSounds.find((s) => s.id === rowId)) {
        checkbox.checked = true;
      }

      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          selectedSounds.push({ id: rowId, label: soundLabel });
        } else {
          const i = selectedSounds.findIndex((s) => s.id === rowId);
          if (i !== -1) selectedSounds.splice(i, 1);
        }
        chrome.storage.local.set({ selectedSounds });
      });

      row.addEventListener("mouseenter", () => {
        checkbox.style.display = "block";
      });

      row.addEventListener("mouseleave", () => {
        if (!checkbox.checked) checkbox.style.display = "none";
      });

      row.style.position = "relative";
      row.appendChild(checkbox);
    });
}

// 💬 Handle download trigger from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_ZIP_DOWNLOAD") {
    console.log("📦 Starting ZIP download...");
    runZipDownload();
  }
});

// 📦 Load JSZip from your extension’s local file
function ensureJSZipLoaded() {
  return new Promise((resolve) => {
    if (window.JSZip) return resolve();
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("js/jszip.min.js"); // 🔥 LOCAL!
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

async function runZipDownload() {
  console.log("📦 Starting batch download...");

  const rows = document.querySelectorAll("core-sample-asset-list-row");

  // Soften the battlefield
  document.body.style.pointerEvents = "none";
  document.body.style.opacity = "0.1";

  for (const sound of selectedSounds) {
    const index = parseInt(sound.id.split("-")[1]);
    const row = rows[index];
    if (!row) continue;

    // Hover to reveal actions
    const event = new Event("mouseenter", { bubbles: true });
    row.dispatchEvent(event);
    await new Promise((r) => setTimeout(r, 150));

    // Open ellipsis menu
    const moreBtn = row.querySelector('button[aria-label="More actions"]');
    if (moreBtn) {
      moreBtn.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    // Click the actual download button
    const buttons = Array.from(
      document.querySelectorAll("button.ng-star-inserted")
    );
    const downloadBtn = buttons.find(
      (btn) => btn.textContent.trim() === "Download"
    );

    if (downloadBtn) {
      console.log(`⬇️ Triggering download for row ${index}`);
      downloadBtn.click();
    } else {
      console.warn(`⚠️ No download button found for row ${index}`);
    }

    // Small delay to let each download queue up
    await new Promise((r) => setTimeout(r, 300));
  }

  // Restore visibility
  document.body.style.pointerEvents = "";
  document.body.style.opacity = "";

  console.log("✅ All downloads triggered.");
}

// 🧹 Clean up
const remaining = selectedSounds.filter(
  (s) => !added.find((a) => a.id === s.id)
);
chrome.storage.local.set({ selectedSounds: remaining });

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim();
}
