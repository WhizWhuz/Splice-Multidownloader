function renderSoundList(sounds) {
  const existing = document.getElementById("soundListContainer");
  if (existing) existing.remove();

  const listContainer = document.createElement("div");
  listContainer.id = "soundListContainer";
  listContainer.style.maxHeight = "200px";
  listContainer.style.overflowY = "auto";
  listContainer.style.marginBottom = "10px";
  listContainer.style.padding = "4px";
  listContainer.style.border = "1px solid #ccc";
  listContainer.style.borderRadius = "4px";

  if (!sounds || sounds.length === 0) {
    listContainer.textContent = "No sounds selected yet.";
  } else {
    const list = document.createElement("ul");
    list.style.paddingLeft = "16px";
    list.style.margin = "0";

    for (const sound of sounds) {
      const li = document.createElement("li");
      li.textContent = sound.label;
      li.style.padding = "2px 0";
      list.appendChild(li);
    }

    listContainer.appendChild(list);
  }

  document.body.prepend(listContainer);
}

window.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("selectedSounds", (data) => {
    renderSoundList(data.selectedSounds || []);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.selectedSounds) {
      renderSoundList(changes.selectedSounds.newValue || []);
    }
  });
});

// 🗜️ Download all selected — triggers the zip download
document.getElementById("downloadSelected").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { action: "START_ZIP_DOWNLOAD" });
    console.log("📨 Sent START_ZIP_DOWNLOAD to content script.");
  });
});

// ✅ Select All
document.getElementById("selectAll").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const checkboxes = document.querySelectorAll(".splice-check");
      const selected = [];

      checkboxes.forEach((checkbox, index) => {
        checkbox.style.display = "block";
        if (!checkbox.checked) {
          checkbox.checked = true;
          const row = checkbox.closest("core-sample-asset-list-row");
          const label = row ? row.innerText.slice(0, 50) : `Sound ${index}`;
          selected.push({ id: `row-${index}`, label });
        }
      });

      chrome.storage.local.set({ selectedSounds: selected });
    },
  });
});

// 🧹 Clear All
document.getElementById("clearAll").addEventListener("click", async () => {
  chrome.storage.local.set({ selectedSounds: [] }, async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const checkboxes = document.querySelectorAll(".splice-check");
        checkboxes.forEach((cb) => {
          cb.checked = false;
          cb.style.display = "none";
        });

        sessionStorage.removeItem("selectedSounds");
      },
    });

    const container = document.getElementById("soundListContainer");
    if (container) container.remove();

    const msg = document.createElement("p");
    msg.textContent = "Selection cleared.";
    msg.style.color = "crimson";
    document.body.prepend(msg);
  });
});
