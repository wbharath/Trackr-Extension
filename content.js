function getPageText() {
  const clone = document.body.cloneNode(true)
  clone.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove())

  const text = clone.innerText
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 3000)

  return {
    text,
    url: window.location.href,
    title: document.title
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeJob') {
    sendResponse(getPageText())
  }
  return true
})
