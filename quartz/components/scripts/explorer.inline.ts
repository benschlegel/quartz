// const observerExplorer = new IntersectionObserver((entries) => {
//   for (const entry of entries) {
//     const slug = entry.target.id
//     const tocEntryElement = document.querySelector(`a[data-for="${slug}"]`)
//     const windowHeight = entry.rootBounds?.height
//     if (windowHeight && tocEntryElement) {
//       if (entry.boundingClientRect.y < windowHeight) {
//         tocEntryElement.classList.add("in-view")
//       } else {
//         tocEntryElement.classList.remove("in-view")
//       }
//     }
//   }
// })

function toggleExplorer(this: HTMLElement) {
  this.classList.toggle("collapsed")
  const content = this.nextElementSibling as HTMLElement
  content.classList.toggle("collapsed")
  content.style.maxHeight = content.style.maxHeight === "0px" ? content.scrollHeight + "px" : "0px"
}

function setupExplorer() {
  const toc = document.getElementById("explorer")
  if (toc) {
    const content = toc.nextElementSibling as HTMLElement
    content.style.maxHeight = content.scrollHeight + "px"
    toc.removeEventListener("click", toggleExplorer)
    toc.addEventListener("click", toggleExplorer)
  }
}

window.addEventListener("resize", setupExplorer)
document.addEventListener("nav", () => {
  setupExplorer()
})
