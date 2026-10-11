let mouseX = 0;
let mouseY = 0;

let duringAnimation = false;
let mouseUpdateTime = performance.now();
export let touchCount = 0;

window.addEventListener(
  "touchmove",
  (event) => {
    // event.preventDefault(); // Stops native mobile scrolling/bouncing
  },
  // { passive: false },
); // Crucial: tells the browser you intend to block scrolling

window.addEventListener("pointermove", (event) => {
  if (!mouseX == event.clientX || mouseY != event.clientY) {
    mouseUpdateTime = performance.now();
    console.log("Pointer moved");
  }
  mouseX = event.clientX;
  mouseY = event.clientY;
});

// Click event
// const handlePressDown = (event) => {
//   duringAnimation = true;
//   ax = 300;
//   ay = 200;
//   setTimeout(() => {
//     if (duringAnimation) duringAnimation = false;
//     return;
//   }, 3000); // Animation lasts for 3 seconds
// };

let timeout;
const handlePressUp = (event) => {
  console.log("Pointer released");

  setTimeout(() => {
    touchCount++;
    console.log("Touch count incremented to:", touchCount);
  }, 250);

  clearTimeout(timeout);

  duringAnimation = true;
  ax = 300;
  ay = 150;

  timeout = setTimeout(() => {
    if (duringAnimation) duringAnimation = false;
    return;
  }, 1700); // Animation lasts for 3 seconds
};
// window.addEventListener("pointerdown", handlePressDown);
window.addEventListener("pointerup", handlePressUp);

// Crucial for mobile: handles when a gesture (like an OS popup or system gesture) interrupts the touch
// window.addEventListener("pointercancel", handlePressUp);

let rotationScale = 0.4;
const dt = 0.016; // Assuming 60 FPS, so dt is approximately 1/60
let rx, ry, vx, vy, ax, ay;
rx = ry = vx = vy = ax = ay = 0; // Initialize all to zero

export function getRotation() {
  // Normalize angles to stay within 0 to 2π
  rx = rx % (Math.PI * 2);
  ry = ry % (Math.PI * 2);

  // Adjust acceleration based on mouse position
  if (performance.now() - mouseUpdateTime < 3000 && !duringAnimation) {
    ax =
      ((mouseY / window.innerHeight - 0.5) * Math.PI * 2 * rotationScale - rx) *
      10.0;
    ay =
      ((mouseX / window.innerWidth - 0.5) * Math.PI * 2 * rotationScale - ry) *
      10.0;
  } else {
    ax = ax * 0.9 + (vx - 0.8) * 0.1; // Slowly return to center when no mouse movement
    ay = ay * 0.9 + (vy - 0.5) * 0.1; // Slowly return to center when no mouse movement
  }

  // Updating the physics
  rx += vx * dt;
  ry += vy * dt;
  vx += ax * dt;
  vy += ay * dt;

  // Damping to slow down the rotation over time
  const damping = 0.95;
  vx *= damping;
  vy *= damping;

  return [0, -rx, -ry];
}
