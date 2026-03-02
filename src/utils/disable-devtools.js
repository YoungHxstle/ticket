const STORAGE_KEY = 'allowDevtools'; // "1" = allow, "0" or null = block

function isAllowed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setAllowed(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch { }
}

// Detect mobile để tránh false positive trên điện thoại
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function keydownHandler(e) {
  if (isAllowed()) return;

  // F12
  if (e.keyCode === 123) {
    e.preventDefault();
    return false;
  }
  // Ctrl+Shift+I
  if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
    e.preventDefault();
    return false;
  }
  // Ctrl+U (view source)
  if (e.ctrlKey && e.keyCode === 85) {
    e.preventDefault();
    return false;
  }
  // Ctrl+S (save)
  if (e.ctrlKey && e.keyCode === 83) {
    e.preventDefault();
    return false;
  }
}

function contextmenuHandler(e) {
  if (isAllowed()) return;
  e.preventDefault();
}

function detectDevtools() {
  const threshold = 150;

  const isDevtoolsOpen =
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold;

  if (isDevtoolsOpen) {
    // Cách 1: Đóng tab
    window.close();

    // Cách 2 fallback: Redirect về trang khác nếu tab không cho phép đóng
    setTimeout(() => {
      window.location.href = "https://google.com";
    }, 100);
  }
}

// 🟢 Tạo nút bật/tắt hiển thị góc màn hình
function createToggleButton() {
  const btn = document.createElement("button");

  btn.innerText = isAllowed() ? "DevTools: ON" : "DevTools: OFF";
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    padding: 8px 12px;
    background: #222;
    color: #fff;
    border-radius: 6px;
    border: 1px solid #555;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.7;
  `;

  btn.onclick = () => {
    const newVal = !isAllowed();
    setAllowed(newVal);
    btn.innerText = newVal ? "DevTools: ON" : "DevTools: OFF";
    window.location.reload();
  };

  document.body.appendChild(btn);
}

export function setupDisableDevtools({ enableDetector = false, showToggle = false } = {}) {
  document.addEventListener('keydown', keydownHandler, true);
  document.addEventListener('contextmenu', contextmenuHandler, true);

  let detectorInterval = null;
  if (enableDetector && !isMobile()) {
    detectDevtools();
    detectorInterval = setInterval(detectDevtools, 500);
  }

  // 🟢 Tạo nút bật tắt DevTools nếu muốn
  if (showToggle) {
    window.addEventListener("DOMContentLoaded", createToggleButton);
  }

  return function cleanup() {
    document.removeEventListener('keydown', keydownHandler, true);
    document.removeEventListener('contextmenu', contextmenuHandler, true);
    if (detectorInterval) clearInterval(detectorInterval);
  };
}

export default setupDisableDevtools;
