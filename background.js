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

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"), // can be any HTML you want
    type: "popup",
    width: 400,
    height: 400,
  });
});
