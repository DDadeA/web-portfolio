import * as twgl from "../../modules/twgl-full.module.js";
import { getRotation, touchCount } from "./elementAnimation.js";
import { updateAnimatedFace } from "./backgroundTexture.js";

async function getFile(file) {
  return fetch(file).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load file: ${file}`);
    }

    return response.text();
  });
}

const header = document.querySelector("header");
if (!header) throw new Error("Header element not found in the DOM.");

const text = "Hand-written shader.";
const textElement = document.createElement("div");
textElement.textContent = text;
textElement.style.font = "1.0rem DM Serif Display, Source Code Pro, serif";
textElement.style.position = "absolute";
textElement.style.top = "calc(100% - 1.0rem * 3)";
textElement.style.left = "2.0rem";
textElement.style.color = "white";
textElement.style.zIndex = "1000";
header.appendChild(textElement);

const width = window.innerWidth;
const height = window.innerHeight * 1.0;

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
header.appendChild(canvas);

export const gl = canvas.getContext("webgl2");
const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
  throw new Error(
    "32-bit float render targets are not supported on this GPU/browser.",
  );
}
const betterRGBA = {
  internalFormat: gl.RGBA32F,
  min: gl.NEAREST,
  mag: gl.NEAREST,
  attachmentPoint: gl.COLOR_ATTACHMENT0,
};
const vs = `#version 300 es

  uniform vec2 u_resolution;

  in vec2 position;
  out vec2 uv;
  
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;
const planeQuad = {
  position: {
    data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
    numComponents: 2,
  },
};
const QuadBufferInfo = twgl.createBufferInfoFromArrays(gl, planeQuad);
function drawPass(
  programInfo,
  uniforms,
  fbo = null,
  bufferInfo = QuadBufferInfo,
) {
  twgl.bindFramebufferInfo(gl, fbo);
  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
}
const rayMarcherBufferUpscale = 1.0;
const rayMarcherBuffer = twgl.createFramebufferInfo(
  gl,
  [
    betterRGBA, // 3D Ray Direction and material ID
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT1 }, // Superfical Normal, object hit
    {
      internalFormat: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      min: gl.NEAREST,
      mag: gl.NEAREST,
      attachmentPoint: gl.COLOR_ATTACHMENT2,
    },
  ],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);
const rayMarcherBuffer2 = twgl.createFramebufferInfo(
  gl,
  [
    betterRGBA, // 3D Ray Direction and material ID
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT1 }, // Superfical Normal, object hit
    {
      internalFormat: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      min: gl.NEAREST,
      mag: gl.NEAREST,
      attachmentPoint: gl.COLOR_ATTACHMENT2,
    },
  ],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);
const ppBuffers = [twgl.createFramebufferInfo(gl, [betterRGBA])];
const renderBuffer = twgl.createFramebufferInfo(
  gl,
  [
    { format: gl.RGBA, attachmentPoint: gl.COLOR_ATTACHMENT0 },
    { format: gl.RGBA, attachmentPoint: gl.COLOR_ATTACHMENT1 },
  ],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);
const finalBuffer = twgl.createFramebufferInfo(
  gl,
  [{ format: gl.RGBA, attachmentPoint: gl.COLOR_ATTACHMENT0 }],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);

const pi_rayMarcher = twgl.createProgramInfo(gl, [
  vs,
  await getFile("src/headers/260906/shaders/rayMarcher.frag"),
]);
const pi_postprocess = twgl.createProgramInfo(gl, [
  vs,
  await getFile("src/headers/260906/shaders/postProcess.frag"),
]);
const pi_showBuffer = twgl.createProgramInfo(gl, [
  vs,
  `#version 300 es
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform sampler2D u_sampler;

  in vec2 uv;
  out vec4 fragColor;
  
  void main() {
    vec4 c = texture(u_sampler, uv);
    // fragColor = vec4(log(c.rgb + 1.0)/2.7/3.0, 1.0);
    fragColor = abs(c) + 0.01;
    // fragColor = vec4(c.rgb, 1.0);
  }`,
]);

// single color
// const mcmt = twgl.createTexture(gl, {
//   target: gl.TEXTURE_CUBE_MAP,
//   // width: 1,
//   // height: 1,
//   src: [
//     [255, 0, 0, 255], // Red for positive X
//     [0, 255, 0, 255], // Green for negative X
//     [0, 0, 255, 255], // Blue for positive Y
//     [255, 255, 0, 255], // Yellow for negative Y
//     [0, 255, 255, 255], // Cyan for positive Z
//     [255, 0, 255, 255], // Magenta for negative Z
//   ],
// });

export const cubeMapTexture = twgl.createTexture(gl, {
  target: gl.TEXTURE_CUBE_MAP,
  min: gl.LINEAR,
  max: gl.LINEAR,
  src: [
    "src/headers/260906/texture/cm/posx.png",
    "src/headers/260906/texture/cm/negx.png",
    "src/headers/260906/texture/cm/posy.png",
    "src/headers/260906/texture/cm/negy.png",
    "src/headers/260906/texture/cm/posz.png",
    "src/headers/260906/texture/cm/negz.png",
  ],
});
gl.texParameteri(
  gl.TEXTURE_CUBE_MAP,
  gl.TEXTURE_MIN_FILTER,
  gl.LINEAR_MIPMAP_LINEAR,
);

const objectNormalTexture = twgl.createTexture(gl, {
  target: gl.TEXTURE_2D,
  min: gl.LINEAR,
  mag: gl.LINEAR,
  wrap: gl.REPEAT,
  src: "src/headers/260906/texture/normalMap2.jpg",
});
const roughNormalTexture = twgl.createTexture(gl, {
  target: gl.TEXTURE_2D,
  min: gl.LINEAR,
  mag: gl.LINEAR,
  wrap: gl.REPEAT,
  src: "src/headers/260906/texture/roughNormalMap.jpg",
});

const outputBuffer = {
  "final render": renderBuffer.attachments[0],
  "dispersion difference map": renderBuffer.attachments[1],
  "RMB uv": rayMarcherBuffer.attachments[0],
  "RMB superfical normal": rayMarcherBuffer.attachments[1],
  "RMB depth": rayMarcherBuffer.attachments[2],
  // "RMB 2 uv": rayMarcherBuffer2.attachments[0],
  // "RMB 2 superficial normal": rayMarcherBuffer2.attachments[1],
  // "RMB 2 depth": rayMarcherBuffer2.attachments[2],
};
// Make floating options for the user to select which buffer to view
const bufferSelect = document.createElement("select");
bufferSelect.style.position = "absolute";
bufferSelect.style.top = "10px";
bufferSelect.style.left = "10px";
bufferSelect.style.zIndex = "1000";
for (const key in outputBuffer) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = key;
  bufferSelect.appendChild(option);
}
document.body.appendChild(bufferSelect);

let lastFrame = 0;
let avgFPS = 0;

export function render() {
  // Initialize per frame
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Update animated face
  updateAnimatedFace(gl, cubeMapTexture, performance.now() * 0.001);

  // Drawcalls
  const aspectRatio = gl.canvas.width / gl.canvas.height;
  const uniform = {
    u_cameraPos: [10, 0, 0], // xyz, z is the height
    u_fov: 25 + (55.0 * aspectRatio) / 3, // Adjust FOV based on aspect ratio
    u_pointing: [0, 0, 0],
    u_aspectRatio: aspectRatio,
    u_time: performance.now() * 0.001,
    u_touchCount: touchCount,

    u_objectRotation: getRotation(),
    u_objectScale: 0.7,
    u_objectPosition: [0, 0, 0],

    u_eps: 5e-5,
    u_IOR: 1.1,

    u_normalMapSampler: objectNormalTexture,
    u_roughNormalMapSampler: roughNormalTexture,
  };

  drawPass(pi_rayMarcher, uniform, rayMarcherBuffer);
  drawPass(pi_rayMarcher, { ...uniform, u_IOR: 1.089 }, rayMarcherBuffer2);

  drawPass(
    pi_postprocess,
    {
      u_resolution: [gl.canvas.width, gl.canvas.height],
      u_time: performance.now() * 0.001,

      backgroundSampler: cubeMapTexture,
      highIORSampler: rayMarcherBuffer.attachments[0],
      lowIORSampler: rayMarcherBuffer2.attachments[0],
      superficalNormalSampler: rayMarcherBuffer.attachments[1],
      // lowIORSampler: rayMarcherBuffer_lights[0].attachments[0],

      // prevFrameSampler: finalBuffer.attachments[0],
    },
    renderBuffer,
  );

  // Store past frame.
  // drawPass(
  //   pi_showBuffer,
  //   {
  //     u_resolution: [gl.canvas.width, gl.canvas.height],
  //     u_time: performance.now() * 0.001,
  //     u_sampler: renderBuffer.attachments[0],
  //   },
  //   finalBuffer,
  // );

  // Show the framebuffer on the screen
  drawPass(pi_showBuffer, {
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_time: performance.now() * 0.001,
    // u_sampler: renderBuffers[0].attachments[0],
    // u_sampler: rayMarcherBuffer.attachments[0],
    u_sampler: outputBuffer[bufferSelect.value],
  });

  // avgFPS = 0.9 * avgFPS + 0.1 * (1000 / (performance.now() - lastFrame));
  // document.title = `${avgFPS.toFixed(1)} FPS`;
  // lastFrame = performance.now();
  // Recurse
  requestAnimationFrame(render);
}
