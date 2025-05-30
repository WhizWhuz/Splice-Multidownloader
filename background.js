// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_ZIP_BLOB") {
    const blobUrl = message.blobUrl;

    chrome.downloads.download({
      url: blobUrl,
      filename: "splice_sounds.zip",
      saveAs: true, // 💾 show the "Save As" dialog once
    });

    sendResponse({ status: "started" });
    return true;
  }
});
