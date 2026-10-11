const header = import("./headers/260906/index.js");
document.addEventListener("DOMContentLoaded", main);

function main() {
  loadCategories();

  // Load contents
  // -- // Not implemented yet

  // Load Header
  header.then((module) => {
    module.main();
  });
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
