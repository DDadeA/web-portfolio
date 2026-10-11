import * as twgl from "../../modules/twgl-full.module.js";

// Image preparation
const negx = new Image();
negx.src = "src/headers/260906/texture/cm/negx.png"; // Load the negative X face image

const imgWidth = 2048; // Width of the image
const imgHeight = 2048; // Height of the image

const animCanvas = document.createElement("canvas");
animCanvas.width = imgWidth;
animCanvas.height = imgHeight;
const ctx = animCanvas.getContext("2d");

export function updateAnimatedFace(gl, cubeMapTexture, t) {
  // Clear / Background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 2048, 2048);
  // Clear with the image
  ctx.drawImage(negx, 0, 0, 2048, 2048);

  // Pulsing & orbiting circle loop
  const radius = 80;
  const x = imgWidth / 2 + Math.cos(t) * 800;
  const y = imgHeight / 2;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  // Text
  let text = "Creativity";
  const properFontSize = Math.floor((imgWidth / text.length) * 1.7);
  const aspectRatio = gl.canvas.width / gl.canvas.height;

  ctx.font = `${properFontSize}px Gloock, serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // if aspect ratio is less than 1, rotate the text 90 degrees
  if (aspectRatio < 1) {
    ctx.save();
    ctx.translate(imgWidth / 2, imgHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(text, imgWidth / 2, imgHeight / 2);
  }

  // ctx.fillText(text, imgWidth / 2, imgHeight / 2);

  // Push directly to the wall the camera looks at (-X)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
  gl.texSubImage2D(
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    0,
    0,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    animCanvas,
  );
}
