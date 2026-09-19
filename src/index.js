document.addEventListener("DOMContentLoaded", main);

function main() {
  // Load Header
  loadHeader();

  // Load contents
  // -- // Not implemented yet

  // Load Categories
  loadCategories();
}

function loadHeader() {
  const header = document.querySelector("header");
  // -- // Clear header
  header.innerHTML = "";

  // -- // Import header js
  const lastHeader = "src/headers/260906/index.js";

  const script = document.createElement("script");
  script.type = "module";
  script.src = lastHeader;
  script.defer = true;

  // -- // Append header js to header
  header.appendChild(script);
}

function loadCategories() {
  const container = document.querySelector("#category-container");

  // -- // potato-server
  const categories = ["PHYSICS", "CIRCUITS", "CODES", "DRAWS", "F&B", "VIDEOS"];

  // -- // Create category element
  for (const category of categories) {
    const categoryElement = document.createElement("div");
    categoryElement.classList.add("category");
    categoryElement.textContent = category;

    // -- // Append category element to container
    container.appendChild(categoryElement);
  }
}

// If there's any error on js, show modal
window.onerror = function (message, source, lineno, colno, error) {
  const modal =
    document.getElementById("error-modal") || document.createElement("div");
  modal.id = "error-modal";
  modal.innerHTML += `
        <h2>Error</h2>
        <p>${message}</p>
        <p>at ${source}:${lineno}:${colno}</p>
    `;
  document.body.appendChild(modal);

  console.error(`Error: ${message} at ${source}:${lineno}:${colno}`);
};
