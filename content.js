// content.js
function injectScriptIntoPage(filePath) {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(filePath);
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

injectScriptIntoPage("js/injected-sniffer.js");

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
      const downloadButton = row.querySelector(
        'button[aria-label="More actions"]'
      );
      const labelNode = downloadButton
        ?.closest("core-sample-asset-list-row")
        ?.querySelector(".sample-name");

      let soundLabel = labelNode?.textContent?.trim() || `Sound_${index}`;

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_ZIP_DOWNLOAD") {
    console.log("📦 Starting ZIP...");
    ensureJSZipLoaded().then(runZipDownload);
  }

  if (request.action === "SELECT_ALL") {
    console.log("✅ Selecting all...");
    selectAllCheckboxes(); // make sure this function exists
  }
});

function ensureJSZipLoaded() {
  return new Promise((resolve) => {
    if (window.JSZip) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("js/jszip.min.js");
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

async function waitForCapturedUrls() {
  console.log("🕐 Waiting for Splice to serve audio URLs...");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  let attempts = 0;
  while (attempts < 10) {
    const ready = selectedSounds.every((s) => {
      const label = sanitize(s.label);
      return window.__labelToUrlMap?.[label];
    });

    if (ready) break;

    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }

  console.log("✅ Proceeding with ZIP after waiting.");
}

async function runZipDownload() {
  await waitForCapturedUrls();

  console.log("📦 Preparing to scout and collect...");

  const rows = document.querySelectorAll("core-sample-asset-list-row");
  const added = [];

  document.body.style.pointerEvents = "none";
  document.body.style.opacity = "0.1";

  for (const sound of selectedSounds) {
    const index = parseInt(sound.id.split("-")[1]);
    const row = rows[index];
    if (!row) continue;

    const event = new Event("mouseenter", { bubbles: true });
    row.dispatchEvent(event);
    await new Promise((r) => setTimeout(r, 150));

    const moreBtn = row.querySelector('button[aria-label="More actions"]');
    if (moreBtn) {
      moreBtn.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    const buttons = Array.from(
      document.querySelectorAll("button.ng-star-inserted")
    );
    const downloadBtn = buttons.find(
      (btn) => btn.textContent.trim() === "Download"
    );

    if (downloadBtn) {
      const labelOnly = sound.label.split("\n")[0].trim();
      const safeLabel = sanitize(labelOnly);
      window.__pendingLabel = sound.label;

      console.log(`⬇️ Clicking download for: ${sound.label}`);
      downloadBtn.setAttribute("data-download-label", safeLabel);
      downloadBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      await new Promise((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
          const url = window.__labelToUrlMap?.[safeLabel];
          if (url) {
            console.log(`🔗 Matched: ${safeLabel} -> ${url}`);
            clearInterval(interval);
            resolve();
          } else if (count++ > 20) {
            console.warn(`⏳ Timeout waiting for: ${safeLabel}`);
            clearInterval(interval);
            resolve();
          }
        }, 300);
      });
    } else {
      console.warn(`⚠️ No download button found for row ${index}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  document.body.style.pointerEvents = "";
  document.body.style.opacity = "";

  const zip = new JSZip();
  const labelMap = window.__labelToUrlMap || {};

  for (const sound of selectedSounds) {
    const label = sanitize(sound.label);
    const url = labelMap[label];

    if (!url) {
      console.warn("❌ No captured URL for:", label);
      continue;
    }

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      zip.file(`${label}.wav`, blob);
      added.push(sound);
      console.log(`✅ Added: ${label}`);
    } catch (err) {
      console.error(`⚠️ Failed to fetch: ${label}`, err);
    }
  }

  if (added.length === 0) {
    console.warn("⚠️ No files zipped. Aborting.");
    return;
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = "splice_sounds.zip";
  a.click();

  const remaining = selectedSounds.filter(
    (s) => !added.some((a) => a.id === s.id)
  );
  chrome.storage.local.set({ selectedSounds: remaining });

  console.log("🎉 ZIP download triggered.");
}

function sanitize(name) {
  return name.replace(/[\/:*?"<>|]+/g, "").trim();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_ZIP_DOWNLOAD") {
    ensureJSZipLoaded().then(runZipDownload);
  }

  if (request.action === "SELECT_ALL") {
    document.querySelectorAll(".splice-check").forEach((checkbox) => {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("click")); // triggers logic
    });
  }

  if (request.action === "DESELECT_ALL") {
    document.querySelectorAll(".splice-check").forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event("click"));
    });
  }
});
