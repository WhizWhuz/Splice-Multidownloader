(() => {
  const originalFetch = window.fetch;
  window.__capturedAudioUrls = {};
  window.__labelToUrlMap = {};

  window.fetch = async function (...args) {
    const url = args[0];
    const isAudio = typeof url === "string" && url.includes("/audio_samples/");
    const res = await originalFetch.apply(this, args);

    if (isAudio && res.ok) {
      const pending = window.__pendingLabel || window.__lastClickedLabel;
      const label =
        pending || "Sound_" + Object.keys(window.__capturedAudioUrls).length;

      if (pending) {
        window.__labelToUrlMap[pending] = url;
        console.log("🔗 [PAGE] Mapped label to URL:", pending, url);
        delete window.__pendingLabel;
        delete window.__lastClickedLabel;
      }

      console.log("🎯 [PAGE] CAPTURED (fetch):", label, url);
    }

    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      const isAudio = this._url?.includes("/audio_samples/");
      if (isAudio && this.status === 200) {
        const url = this._url;

        const pending = window.__pendingLabel;
        const label =
          pending || "Sound_" + Object.keys(window.__capturedAudioUrls).length;

        window.__capturedAudioUrls[label] = url;
        if (pending) {
          window.__labelToUrlMap[pending] = url;
          delete window.__pendingLabel;
        }

        console.log("🎯 [PAGE] CAPTURED (xhr):", label, url);
      }
    });

    return send.apply(this, arguments);
  };
})();
