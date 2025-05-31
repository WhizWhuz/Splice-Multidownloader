// injectors/interceptor.js
console.log("🌀 Interceptor loader executing...");

function injectScriptIntoPage(filePath) {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(filePath);
  script.onload = () => script.remove(); // 🧼 Clean up after self
  (document.head || document.documentElement).appendChild(script);
}

// Inject our true sniffer into the page context
injectScriptIntoPage("js/injected-sniffer.js");
