function renderSoundList(sounds) {
  const existing = document.getElementById("soundListContainer");
  if (existing) existing.remove();

  const listContainer = document.createElement("div");
  listContainer.id = "soundListContainer";
  listContainer.style.maxHeight = "200px";
  listContainer.style.overflowY = "auto";
  listContainer.style.marginBottom = "10px";
  listContainer.style.padding = "8px";
  listContainer.style.borderRadius = "0.5rem";
  listContainer.style.border = "1px solid black";
  listContainer.style.backgroundColor = "white";

  if (!sounds || sounds.length === 0) {
    listContainer.textContent = "No sounds selected yet.";
  } else {
    const list = document.createElement("ul");
    list.style.paddingLeft = "16px";
    list.style.margin = "0";

    for (const sound of sounds) {
      const li = document.createElement("li");

      li.textContent = sound.label;
      li.dataset.label = sound.label;
      li.style.padding = "2px 0";

      const status = sound.status || "pending";
      li.classList.add(`status-${status}`);

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
          const labelNode = row.querySelector("h6.filename");
          const label = labelNode?.textContent?.trim() || `Sound_${index}`;

          selected.push({ id: `row-${index}`, label, status: "pending" });
        }
      });

      chrome.storage.local.set({ selectedSounds: selected });
    },
  });
});

async function clearAllSelectedSounds() {
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
}

document.getElementById("clearAll").addEventListener("click", () => {
  document.getElementById("clear-options").classList.toggle("hidden");
});

document.querySelectorAll(".clear-option").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.action;

    if (action === "all") {
      await clearAllSelectedSounds();
    } else if (action === "finished") {
      clearSoundRowsByStatus("✅");
    } else if (action === "errors") {
      clearSoundRowsByStatus("⚠️");
    }
  });
});

function clearSoundRowsByStatus(statusSymbol) {
  document.querySelectorAll(".sound-row").forEach((row) => {
    const status = row.querySelector(".status")?.textContent;
    if (status === statusSymbol) row.remove();
  });
}

document.getElementById("add-to-library").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "START_ADD_TO_LIBRARY" });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LIBRARY_STATUS") {
    const { label, status } = message;
    updateRowStatus(label, status);
  }
});

function updateRowStatus(label, status) {
  const li = document.querySelector(`li[data-label="${label}"]`);
  if (!li) return;

  li.classList.remove("status-pending", "status-done", "status-error");

  if (status === "success") {
    li.classList.add("status-done");
  } else if (status === "error") {
    li.classList.add("status-error");
  }
}

function renderSelectedSounds(sounds) {
  const container = document.getElementById("selected-sounds");
  container.innerHTML = ""; // clear old

  sounds.forEach((s) => {
    const row = document.createElement("div");
    row.className = "sound-row";
    row.dataset.label = s.label;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = s.label;

    const status = document.createElement("span");
    status.className = "spin"; // Add spin class for ⏳
    status.textContent = "⏳";

    row.appendChild(label);
    row.appendChild(status);
    container.appendChild(row);
  });
}

document.getElementById("clear-finished").addEventListener("click", () => {
  document.querySelectorAll(".sound-row .status").forEach((statusSpan) => {
    if (statusSpan.textContent === "✅") {
      statusSpan.parentElement.remove();
    }
  });
});
